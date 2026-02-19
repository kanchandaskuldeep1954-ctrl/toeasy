import { Queue, Worker, JobsOptions } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { query } from '../db.js';
import { logger } from '../utils/logger.js';
import {
  executeAutomationPolicy,
  parseAutomationRetryPolicy,
  resolveAutomationActorContext,
  recordAutomationRunEvent
} from './automationExecutionService.js';

interface DispatchJobPayload {
  reason?: string;
}

interface ExecuteScheduledJobPayload {
  workspaceId: number;
  roomId: number | null;
  automationPolicyId: number;
  actorUserId: number;
  actorResolutionStrategy: string;
  scheduleId: number;
  source: 'schedule';
  scheduledFor: string;
  dispatchReason: string | null;
  retryPolicy: { maxAttempts: number; backoffMs: number };
  reason?: string;
}

interface QueueJobCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: number;
}

interface QueueRuntimeState {
  initialized: boolean;
  enabled: boolean;
  dispatchInvocations: number;
  executeFailures: number;
  executeRetriesScheduled: number;
  executeTerminalFailures: number;
  lastDispatchAt: string | null;
  lastDispatchReason: string | null;
  lastDispatchError: string | null;
  lastDispatchResult: {
    scanned: number;
    queued: number;
    skipped: number;
    duplicates: number;
    failedEnqueue: number;
  } | null;
  queues: {
    dispatch: QueueJobCounts;
    execute: QueueJobCounts;
  };
}

const DISPATCH_QUEUE_NAME = 'automation-dispatch-queue';
const EXECUTE_QUEUE_NAME = 'automation-execute-queue';
const DISPATCH_REPEAT_JOB_ID = 'scan-due-schedules';
const DEFAULT_DISPATCH_INTERVAL_MS = 60_000;

let redisConnectionOptions: Record<string, any> | null = null;
let dispatchQueue: Queue<DispatchJobPayload> | null = null;
let executeQueue: Queue<ExecuteScheduledJobPayload> | null = null;
let dispatchWorker: Worker<DispatchJobPayload> | null = null;
let executeWorker: Worker<ExecuteScheduledJobPayload> | null = null;
const queueState: QueueRuntimeState = {
  initialized: false,
  enabled: false,
  dispatchInvocations: 0,
  executeFailures: 0,
  executeRetriesScheduled: 0,
  executeTerminalFailures: 0,
  lastDispatchAt: null,
  lastDispatchReason: null,
  lastDispatchError: null,
  lastDispatchResult: null,
  queues: {
    dispatch: {
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: 0
    },
    execute: {
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: 0
    }
  }
};

function normalizeQueueError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err || 'unknown queue error');
}

function isDuplicateJobError(err: unknown): boolean {
  const message = normalizeQueueError(err).toLowerCase();
  return message.includes('jobid') && message.includes('exists');
}

async function refreshQueueCounts(): Promise<void> {
  const fallback = {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
    paused: 0
  };
  if (!queueState.enabled || !dispatchQueue || !executeQueue) {
    queueState.queues.dispatch = { ...fallback };
    queueState.queues.execute = { ...fallback };
    return;
  }

  try {
    const [dispatchCounts, executeCounts] = await Promise.all([
      dispatchQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused'),
      executeQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused')
    ]);
    queueState.queues.dispatch = {
      waiting: Number(dispatchCounts.waiting || 0),
      active: Number(dispatchCounts.active || 0),
      delayed: Number(dispatchCounts.delayed || 0),
      failed: Number(dispatchCounts.failed || 0),
      completed: Number(dispatchCounts.completed || 0),
      paused: Number(dispatchCounts.paused || 0)
    };
    queueState.queues.execute = {
      waiting: Number(executeCounts.waiting || 0),
      active: Number(executeCounts.active || 0),
      delayed: Number(executeCounts.delayed || 0),
      failed: Number(executeCounts.failed || 0),
      completed: Number(executeCounts.completed || 0),
      paused: Number(executeCounts.paused || 0)
    };
  } catch (err) {
    logger.warn('[AutomationQueue] Failed to refresh queue counts', err);
  }
}

function computeNextRunAt(cron: string, timezone: string): Date {
  try {
    const expression = CronExpressionParser.parse(cron, {
      currentDate: new Date(),
      tz: timezone || 'UTC'
    });
    return expression.next().toDate();
  } catch (err) {
    logger.warn('[AutomationQueue] Invalid cron expression, falling back to +1 hour', {
      cron,
      timezone,
      error: err instanceof Error ? err.message : String(err)
    });
    return new Date(Date.now() + 60 * 60 * 1000);
  }
}

function buildQueueConnectionOptions(redisUrl: string): Record<string, any> {
  const parsed = new URL(redisUrl);
  const dbPath = String(parsed.pathname || '').replace('/', '');
  const db = dbPath ? Number(dbPath) : undefined;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null
  };
}

async function enqueueDueSchedules(): Promise<{ scanned: number; queued: number; skipped: number; duplicates: number; failedEnqueue: number }> {
  if (!executeQueue) {
    return { scanned: 0, queued: 0, skipped: 0, duplicates: 0, failedEnqueue: 0 };
  }

  const dueSchedules = await query(
    `
    SELECT
      s.id,
      s.workspace_id,
      s.room_id,
      s.automation_policy_id,
      s.cron,
      s.timezone,
      s.retry_policy,
      s.next_run_at,
      s.last_run_at,
      s.created_by,
      p.created_by AS policy_created_by
    FROM automation_schedules s
    JOIN automation_policies p
      ON p.id = s.automation_policy_id
     AND p.workspace_id = s.workspace_id
    WHERE s.is_active = true
      AND p.is_active = true
      AND s.next_run_at IS NOT NULL
      AND s.next_run_at <= NOW()
    ORDER BY s.next_run_at ASC
    LIMIT 50
    `
  );

  let queued = 0;
  let skipped = 0;
  let duplicates = 0;
  let failedEnqueue = 0;
  for (const row of dueSchedules.rows) {
    const scheduleId = Number(row.id);
    const workspaceId = Number(row.workspace_id);
    const roomId = row.room_id ? Number(row.room_id) : null;
    const automationPolicyId = Number(row.automation_policy_id);
    const cron = String(row.cron || '');
    const timezone = String(row.timezone || 'UTC');
    const nextRunAt = computeNextRunAt(cron, timezone);
    const scheduledFor = new Date(row.next_run_at).toISOString();

    const actorResolution = await resolveAutomationActorContext(
      workspaceId,
      Number(row.created_by || row.policy_created_by || 0) || null
    );
    const actorUserId = actorResolution.userId;
    if (!actorUserId) {
      logger.warn('[AutomationQueue] Skipping schedule with no actor user', {
        scheduleId,
        workspaceId,
        automationPolicyId,
        resolutionStrategy: actorResolution.strategy
      });
      skipped += 1;
      continue;
    }

    // Claim this schedule row atomically to avoid duplicate queuing across app instances.
    const claim = await query(
      `
      UPDATE automation_schedules
      SET last_run_at = NOW(),
          next_run_at = $1,
          updated_at = NOW()
      WHERE id = $2
        AND is_active = true
        AND next_run_at <= NOW()
        AND next_run_at = $3
      RETURNING id
      `,
      [nextRunAt.toISOString(), scheduleId, row.next_run_at]
    );
    if (claim.rows.length === 0) {
      skipped += 1;
      continue;
    }

    const retryPolicy = parseAutomationRetryPolicy(row.retry_policy);
    const runTimestamp = new Date(row.next_run_at).getTime();
    const jobId = `schedule-${scheduleId}-${runTimestamp}`;
    const options: JobsOptions = {
      jobId,
      attempts: retryPolicy.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: retryPolicy.backoffMs
      },
      removeOnComplete: 200,
      removeOnFail: 500
    };

    try {
      await executeQueue.add(
        'execute-scheduled-automation',
        {
          workspaceId,
          roomId,
          automationPolicyId,
          actorUserId,
          actorResolutionStrategy: actorResolution.strategy,
          scheduleId,
          source: 'schedule',
          scheduledFor,
          dispatchReason: 'dispatch_scan',
          retryPolicy,
          reason: `Scheduled execution from schedule #${scheduleId}`
        },
        options
      );
      queued += 1;
    } catch (err) {
      if (isDuplicateJobError(err)) {
        duplicates += 1;
        logger.warn('[AutomationQueue] Duplicate execute job skipped', {
          scheduleId,
          workspaceId,
          automationPolicyId,
          jobId
        });
        continue;
      }

      failedEnqueue += 1;
      logger.error('[AutomationQueue] Failed to enqueue execute job, reverting schedule claim', {
        scheduleId,
        workspaceId,
        automationPolicyId,
        error: normalizeQueueError(err)
      });
      try {
        await query(
          `
          UPDATE automation_schedules
          SET next_run_at = $1,
              last_run_at = $2,
              updated_at = NOW()
          WHERE id = $3
          `,
          [row.next_run_at, row.last_run_at || null, scheduleId]
        );
      } catch (revertErr) {
        logger.error('[AutomationQueue] Failed to revert schedule claim after enqueue failure', {
          scheduleId,
          workspaceId,
          error: normalizeQueueError(revertErr)
        });
      }
    }
  }

  return {
    scanned: dueSchedules.rows.length,
    queued,
    skipped,
    duplicates,
    failedEnqueue
  };
}

export async function initializeAutomationQueue(redisUrl?: string): Promise<void> {
  if (queueState.initialized) {
    return;
  }
  queueState.initialized = true;

  if (!redisUrl) {
    logger.info('[AutomationQueue] REDIS_URL not configured, queue workers disabled');
    queueState.enabled = false;
    return;
  }

  try {
    redisConnectionOptions = buildQueueConnectionOptions(redisUrl);

    dispatchQueue = new Queue<DispatchJobPayload>(DISPATCH_QUEUE_NAME, {
      connection: redisConnectionOptions
    });
    executeQueue = new Queue<ExecuteScheduledJobPayload>(EXECUTE_QUEUE_NAME, {
      connection: redisConnectionOptions
    });

    dispatchWorker = new Worker<DispatchJobPayload>(
      DISPATCH_QUEUE_NAME,
      async () => enqueueDueSchedules(),
      {
        connection: redisConnectionOptions,
        concurrency: 1
      }
    );

    executeWorker = new Worker<ExecuteScheduledJobPayload>(
      EXECUTE_QUEUE_NAME,
      async (job) => {
        const data = job.data;
        const queueAttempt = Math.max(1, Number(job.attemptsMade || 0) + 1);
        const queueMaxAttempts = Math.max(1, Number(job.opts?.attempts || data.retryPolicy?.maxAttempts || 1));
        const backoffDelay = typeof job.opts?.backoff === 'number'
          ? Number(job.opts.backoff)
          : Number((job.opts?.backoff as any)?.delay || data.retryPolicy?.backoffMs || 0);

        const result = await executeAutomationPolicy({
          workspaceId: data.workspaceId,
          automationId: data.automationPolicyId,
          actorUserId: data.actorUserId,
          inputPayload: {
            scheduleId: data.scheduleId,
            queueJobId: job.id || null,
            scheduledFor: data.scheduledFor || null
          },
          reason: data.reason || null,
          source: data.source,
          executionAttempt: queueAttempt,
          executionContext: {
            queueName: EXECUTE_QUEUE_NAME,
            queueJobId: job.id || null,
            queueAttempt,
            queueMaxAttempts,
            queueBackoffMs: Number.isFinite(backoffDelay) ? Math.max(0, backoffDelay) : 0,
            scheduleId: data.scheduleId,
            dispatchReason: data.dispatchReason || null,
            actorResolutionStrategy: data.actorResolutionStrategy || null,
            scheduledFor: data.scheduledFor || null
          }
        });
        return {
          runId: Number(result.run?.id || 0) || null,
          approvalRequestId: Number(result.approvalRequest?.id || 0) || null,
          workspaceId: data.workspaceId,
          roomId: data.roomId
        };
      },
      {
        connection: redisConnectionOptions,
        concurrency: 2
      }
    );

    dispatchWorker.on('failed', (job, err) => {
      queueState.lastDispatchAt = new Date().toISOString();
      queueState.lastDispatchReason = job?.data?.reason || null;
      queueState.lastDispatchError = err.message;
      logger.error('[AutomationQueue] Dispatch worker failed', {
        jobId: job?.id || null,
        error: err.message
      });
    });

    dispatchWorker.on('completed', async (job, result) => {
      queueState.dispatchInvocations += 1;
      queueState.lastDispatchAt = new Date().toISOString();
      queueState.lastDispatchReason = job?.data?.reason || null;
      queueState.lastDispatchError = null;
      queueState.lastDispatchResult = {
        scanned: Number(result?.scanned || 0),
        queued: Number(result?.queued || 0),
        skipped: Number(result?.skipped || 0),
        duplicates: Number(result?.duplicates || 0),
        failedEnqueue: Number(result?.failedEnqueue || 0)
      };
      await refreshQueueCounts();
    });

    executeWorker.on('failed', async (job, err) => {
      queueState.executeFailures += 1;
      const attemptsMade = Math.max(1, Number(job?.attemptsMade || 1));
      const maxAttempts = Math.max(1, Number(job?.opts?.attempts || job?.data?.retryPolicy?.maxAttempts || 1));
      const retriesRemaining = attemptsMade < maxAttempts;
      if (retriesRemaining) {
        queueState.executeRetriesScheduled += 1;
      } else {
        queueState.executeTerminalFailures += 1;
      }
      logger.error('[AutomationQueue] Execute worker failed', {
        jobId: job?.id || null,
        scheduleId: job?.data?.scheduleId || null,
        automationPolicyId: job?.data?.automationPolicyId || null,
        attemptsMade,
        maxAttempts,
        retriesRemaining,
        error: err.message
      });

      try {
        if (!job?.data?.workspaceId || !job?.data?.automationPolicyId || !job?.id) {
          await refreshQueueCounts();
          return;
        }
        const runLookup = await query(
          `
          SELECT id, room_id, status
          FROM automation_runs
          WHERE workspace_id = $1
            AND automation_policy_id = $2
            AND COALESCE(input->>'queueJobId', '') = $3
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [job.data.workspaceId, job.data.automationPolicyId, String(job.id)]
        );
        if (runLookup.rows.length > 0) {
          const run = runLookup.rows[0];
          const runId = Number(run.id);
          const roomId = run.room_id ? Number(run.room_id) : (job.data.roomId || null);
          await recordAutomationRunEvent({
            workspaceId: Number(job.data.workspaceId),
            roomId,
            runId,
            eventType: retriesRemaining ? 'execution_retry_scheduled' : 'execution_failed_terminal',
            status: retriesRemaining ? 'retrying' : 'failed',
            attempt: attemptsMade,
            error: err.message,
            metadata: {
              queueName: EXECUTE_QUEUE_NAME,
              queueJobId: job.id || null,
              queueAttempt: attemptsMade,
              queueMaxAttempts: maxAttempts,
              scheduleId: job.data.scheduleId || null,
              actorResolutionStrategy: job.data.actorResolutionStrategy || null,
              retryBackoffMs: job.data.retryPolicy?.backoffMs || null,
              retriesRemaining
            }
          });

          if (!retriesRemaining) {
            await query(
              `
              UPDATE automation_runs
              SET status = CASE WHEN status IN ('completed', 'awaiting_approval') THEN status ELSE 'failed' END,
                  error = COALESCE(error, $1),
                  completed_at = CASE WHEN status IN ('completed', 'awaiting_approval') THEN completed_at ELSE NOW() END,
                  updated_at = NOW()
              WHERE id = $2
              `,
              [err.message, runId]
            );
          }
        }
      } catch (eventErr) {
        logger.warn('[AutomationQueue] Failed to append execute failure run-event', eventErr);
      }
      await refreshQueueCounts();
    });

    executeWorker.on('completed', async () => {
      await refreshQueueCounts();
    });

    await dispatchQueue.add(
      'scan-due-schedules',
      { reason: 'startup' },
      {
        jobId: `${DISPATCH_REPEAT_JOB_ID}:startup:${Date.now()}`,
        removeOnComplete: 5,
        removeOnFail: 20
      }
    );

    await dispatchQueue.add(
      'scan-due-schedules',
      { reason: 'interval' },
      {
        jobId: DISPATCH_REPEAT_JOB_ID,
        repeat: {
          every: DEFAULT_DISPATCH_INTERVAL_MS
        },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    queueState.enabled = true;
    await refreshQueueCounts();
    logger.info('[AutomationQueue] Initialized');
  } catch (err) {
    queueState.enabled = false;
    logger.warn('[AutomationQueue] Initialization failed, continuing without queue workers', err);
  }
}

export async function requestAutomationDispatch(reason: string = 'manual_nudge'): Promise<boolean> {
  if (!dispatchQueue || !queueState.enabled) {
    return false;
  }
  try {
    const bucket = Math.floor(Date.now() / 15_000);
    await dispatchQueue.add(
      'scan-due-schedules',
      { reason },
      {
        jobId: `${DISPATCH_REPEAT_JOB_ID}:${reason}:${bucket}`,
        removeOnComplete: 20,
        removeOnFail: 20
      }
    );
    await refreshQueueCounts();
    return true;
  } catch (err) {
    logger.warn('[AutomationQueue] Failed to enqueue dispatch nudge', err);
    return false;
  }
}

export async function closeAutomationQueue(): Promise<void> {
  const closers: Array<() => Promise<void>> = [];
  if (dispatchWorker) closers.push(() => dispatchWorker!.close());
  if (executeWorker) closers.push(() => executeWorker!.close());
  if (dispatchQueue) closers.push(() => dispatchQueue!.close());
  if (executeQueue) closers.push(() => executeQueue!.close());

  for (const close of closers) {
    try {
      await close();
    } catch (err) {
      logger.warn('[AutomationQueue] Error closing queue resource', err);
    }
  }

  dispatchWorker = null;
  executeWorker = null;
  dispatchQueue = null;
  executeQueue = null;
  redisConnectionOptions = null;
  queueState.initialized = false;
  queueState.enabled = false;
  queueState.dispatchInvocations = 0;
  queueState.executeFailures = 0;
  queueState.executeRetriesScheduled = 0;
  queueState.executeTerminalFailures = 0;
  queueState.lastDispatchAt = null;
  queueState.lastDispatchReason = null;
  queueState.lastDispatchError = null;
  queueState.lastDispatchResult = null;
  queueState.queues.dispatch = {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
    paused: 0
  };
  queueState.queues.execute = {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
    paused: 0
  };
}

export function getAutomationQueueState(): QueueRuntimeState {
  return {
    initialized: queueState.initialized,
    enabled: queueState.enabled,
    dispatchInvocations: queueState.dispatchInvocations,
    executeFailures: queueState.executeFailures,
    executeRetriesScheduled: queueState.executeRetriesScheduled,
    executeTerminalFailures: queueState.executeTerminalFailures,
    lastDispatchAt: queueState.lastDispatchAt,
    lastDispatchReason: queueState.lastDispatchReason,
    lastDispatchError: queueState.lastDispatchError,
    lastDispatchResult: queueState.lastDispatchResult,
    queues: {
      dispatch: { ...queueState.queues.dispatch },
      execute: { ...queueState.queues.execute }
    }
  };
}
