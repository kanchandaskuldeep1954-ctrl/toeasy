import { Queue, Worker, JobsOptions } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { query } from '../db.js';
import { logger } from '../utils/logger.js';
import {
  executeAutomationPolicy,
  parseAutomationRetryPolicy,
  resolveAutomationActorUserId
} from './automationExecutionService.js';

interface DispatchJobPayload {
  reason?: string;
}

interface ExecuteScheduledJobPayload {
  workspaceId: number;
  roomId: number | null;
  automationPolicyId: number;
  actorUserId: number;
  scheduleId: number;
  source: 'schedule';
  reason?: string;
}

interface QueueRuntimeState {
  initialized: boolean;
  enabled: boolean;
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
  enabled: false
};

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

async function enqueueDueSchedules(): Promise<{ scanned: number; queued: number; skipped: number }> {
  if (!executeQueue) {
    return { scanned: 0, queued: 0, skipped: 0 };
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
  for (const row of dueSchedules.rows) {
    const scheduleId = Number(row.id);
    const workspaceId = Number(row.workspace_id);
    const roomId = row.room_id ? Number(row.room_id) : null;
    const automationPolicyId = Number(row.automation_policy_id);
    const cron = String(row.cron || '');
    const timezone = String(row.timezone || 'UTC');
    const nextRunAt = computeNextRunAt(cron, timezone);

    // Claim this schedule row atomically to avoid duplicate queuing across app instances.
    const claim = await query(
      `
      UPDATE automation_schedules
      SET last_run_at = NOW(),
          next_run_at = $1,
          updated_at = NOW()
      WHERE id = $2
        AND next_run_at = $3
      RETURNING id
      `,
      [nextRunAt.toISOString(), scheduleId, row.next_run_at]
    );
    if (claim.rows.length === 0) {
      skipped += 1;
      continue;
    }

    const actorUserId = await resolveAutomationActorUserId(
      workspaceId,
      Number(row.created_by || row.policy_created_by || 0) || null
    );
    if (!actorUserId) {
      logger.warn('[AutomationQueue] Skipping schedule with no actor user', {
        scheduleId,
        workspaceId,
        automationPolicyId
      });
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

    await executeQueue.add(
      'execute-scheduled-automation',
      {
        workspaceId,
        roomId,
        automationPolicyId,
        actorUserId,
        scheduleId,
        source: 'schedule',
        reason: `Scheduled execution from schedule #${scheduleId}`
      },
      options
    );
    queued += 1;
  }

  return {
    scanned: dueSchedules.rows.length,
    queued,
    skipped
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
        const result = await executeAutomationPolicy({
          workspaceId: data.workspaceId,
          automationId: data.automationPolicyId,
          actorUserId: data.actorUserId,
          inputPayload: {
            scheduleId: data.scheduleId,
            queueJobId: job.id || null
          },
          reason: data.reason || null,
          source: data.source
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
      logger.error('[AutomationQueue] Dispatch worker failed', {
        jobId: job?.id || null,
        error: err.message
      });
    });

    executeWorker.on('failed', (job, err) => {
      logger.error('[AutomationQueue] Execute worker failed', {
        jobId: job?.id || null,
        scheduleId: job?.data?.scheduleId || null,
        automationPolicyId: job?.data?.automationPolicyId || null,
        error: err.message
      });
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
    await dispatchQueue.add(
      'scan-due-schedules',
      { reason },
      {
        jobId: `${DISPATCH_REPEAT_JOB_ID}:${reason}:${Date.now()}`,
        removeOnComplete: 20,
        removeOnFail: 20
      }
    );
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
}

export function getAutomationQueueState(): QueueRuntimeState {
  return {
    initialized: queueState.initialized,
    enabled: queueState.enabled
  };
}
