import { query } from '../db.js';
import { emitToDecisionRoom } from '../realtime.js';

export type AutomationExecutionSource = 'manual' | 'schedule' | 'retry';

export interface ExecuteAutomationPolicyInput {
  workspaceId: number;
  automationId: number;
  actorUserId: number;
  inputPayload?: Record<string, any>;
  reason?: string | null;
  source?: AutomationExecutionSource;
}

export interface ExecuteAutomationPolicyResult {
  run: any;
  approvalRequest: any | null;
  policy: any;
}

export class AutomationExecutionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toFiniteNumber(value: any): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonMaybe<T>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

async function insertRunEvent(input: {
  workspaceId: number;
  roomId: number | null;
  runId: number;
  eventType: string;
  status: string;
  attempt?: number;
  error?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    await query(
      `
      INSERT INTO automation_run_events (
        workspace_id,
        room_id,
        automation_run_id,
        event_type,
        status,
        attempt,
        error,
        metadata,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      `,
      [
        input.workspaceId,
        input.roomId,
        input.runId,
        input.eventType,
        input.status,
        Math.max(1, Number(input.attempt || 1)),
        input.error || null,
        JSON.stringify(input.metadata || {})
      ]
    );
  } catch (err) {
    // Keep automation execution resilient even when event table migration is not yet present.
    console.warn('Automation run event insert skipped:', err);
  }
}

export async function resolveAutomationActorUserId(workspaceId: number, preferredUserId?: number | null): Promise<number | null> {
  const preferred = toFiniteNumber(preferredUserId);
  if (preferred) {
    return preferred;
  }

  const memberResult = await query(
    `
    SELECT wm.user_id
    FROM workspace_members wm
    WHERE wm.workspace_id = $1
    ORDER BY
      CASE wm.role
        WHEN 'admin' THEN 0
        WHEN 'editor' THEN 1
        ELSE 2
      END ASC,
      wm.created_at ASC
    LIMIT 1
    `,
    [workspaceId]
  );

  if (memberResult.rows.length > 0) {
    return Number(memberResult.rows[0].user_id);
  }

  const ownerResult = await query(
    `
    SELECT user_id
    FROM workspaces
    WHERE id = $1
    LIMIT 1
    `,
    [workspaceId]
  );
  if (ownerResult.rows.length > 0) {
    return Number(ownerResult.rows[0].user_id);
  }

  return null;
}

export async function executeAutomationPolicy(input: ExecuteAutomationPolicyInput): Promise<ExecuteAutomationPolicyResult> {
  const workspaceId = Number(input.workspaceId);
  const automationId = Number(input.automationId);
  const actorUserId = Number(input.actorUserId);
  const source = input.source || 'manual';
  const inputPayload = input.inputPayload || {};

  if (!Number.isFinite(workspaceId) || !Number.isFinite(automationId) || !Number.isFinite(actorUserId)) {
    throw new AutomationExecutionError('Invalid automation execution input', 400);
  }

  const policyResult = await query(
    `
    SELECT *
    FROM automation_policies
    WHERE id = $1
      AND workspace_id = $2
      AND is_active = true
    LIMIT 1
    `,
    [automationId, workspaceId]
  );
  if (policyResult.rows.length === 0) {
    throw new AutomationExecutionError('Automation policy not found', 404);
  }

  const policy = policyResult.rows[0];
  const roomId = toFiniteNumber(policy.room_id);
  const normalizedRisk = String(policy.risk_level || 'medium');

  const runInsert = await query(
    `
    INSERT INTO automation_runs (
      workspace_id,
      room_id,
      automation_policy_id,
      status,
      risk_level,
      input,
      created_by,
      started_at
    )
    VALUES ($1,$2,$3,'running',$4,$5,$6,NOW())
    RETURNING *
    `,
    [
      workspaceId,
      roomId,
      automationId,
      normalizedRisk,
      JSON.stringify(inputPayload),
      actorUserId
    ]
  );
  const run = runInsert.rows[0];
  const runId = Number(run.id);

  await insertRunEvent({
    workspaceId,
    roomId,
    runId,
    eventType: 'execution_started',
    status: 'running',
    attempt: 1,
    metadata: {
      automationId,
      source,
      inputProvided: Object.keys(inputPayload).length > 0
    }
  });

  if (normalizedRisk === 'low') {
    const completed = await query(
      `
      UPDATE automation_runs
      SET status = 'completed',
          output = $1,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [
        JSON.stringify({
          status: 'auto_applied',
          note: 'Low-risk automation auto-approved.',
          source
        }),
        runId
      ]
    );

    await insertRunEvent({
      workspaceId,
      roomId,
      runId,
      eventType: 'execution_completed',
      status: 'completed',
      attempt: 1,
      metadata: {
        source,
        autoApproved: true
      }
    });

    return {
      run: completed.rows[0],
      approvalRequest: null,
      policy
    };
  }

  const approvalInsert = await query(
    `
    INSERT INTO approval_requests (
      workspace_id,
      room_id,
      automation_run_id,
      requested_by,
      risk_level,
      status,
      reason
    )
    VALUES ($1,$2,$3,$4,$5,'pending',$6)
    RETURNING *
    `,
    [
      workspaceId,
      roomId,
      runId,
      actorUserId,
      normalizedRisk,
      input.reason || null
    ]
  );
  const approvalRequest = approvalInsert.rows[0];

  const awaiting = await query(
    `
    UPDATE automation_runs
    SET status = 'awaiting_approval',
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [runId]
  );

  await insertRunEvent({
    workspaceId,
    roomId,
    runId,
    eventType: 'awaiting_approval',
    status: 'awaiting_approval',
    attempt: 1,
    metadata: {
      source,
      approvalRequestId: approvalRequest?.id || null
    }
  });

  if (approvalRequest && roomId) {
    emitToDecisionRoom(workspaceId, roomId, 'decision-room:approval-created', {
      roomId,
      approval: approvalRequest
    });
  }

  return {
    run: awaiting.rows[0],
    approvalRequest,
    policy
  };
}

export function parseAutomationRetryPolicy(input: any): { maxAttempts: number; backoffMs: number } {
  const parsed = parseJsonMaybe(input, input);
  const maxAttemptsRaw = Number(parsed?.maxAttempts);
  const backoffMsRaw = Number(parsed?.backoffMs);
  return {
    maxAttempts: Number.isFinite(maxAttemptsRaw) ? Math.max(1, Math.min(20, Math.floor(maxAttemptsRaw))) : 3,
    backoffMs: Number.isFinite(backoffMsRaw) ? Math.max(50, Math.min(120000, Math.floor(backoffMsRaw))) : 300
  };
}

