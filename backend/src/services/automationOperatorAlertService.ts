import { query } from '../db.js';
import { emitToUser } from '../realtime.js';
import type { AutomationFailureClassification } from './automationFailureTaxonomy.js';

interface OperatorAlertInput {
  workspaceId: number;
  roomId: number | null;
  runId: number | null;
  scheduleId: number | null;
  automationPolicyId: number | null;
  jobId: string | null;
  errorMessage: string;
  classification: AutomationFailureClassification;
}

async function resolveOperatorUserIds(workspaceId: number): Promise<number[]> {
  const result = await query(
    `
    SELECT DISTINCT user_id
    FROM (
      SELECT wm.user_id
      FROM workspace_members wm
      WHERE wm.workspace_id = $1
        AND wm.role IN ('admin', 'editor')
      UNION
      SELECT w.user_id
      FROM workspaces w
      WHERE w.id = $1
    ) recipients
    WHERE user_id IS NOT NULL
    `,
    [workspaceId]
  );

  return result.rows
    .map((row) => Number(row.user_id))
    .filter((value) => Number.isFinite(value) && value > 0);
}

async function hasRecentDuplicateAlert(params: {
  workspaceId: number;
  userId: number;
  title: string;
}): Promise<boolean> {
  const duplicateCheck = await query(
    `
    SELECT id
    FROM notifications
    WHERE workspace_id = $1
      AND user_id = $2
      AND type = 'automation_failure'
      AND title = $3
      AND created_at >= NOW() - INTERVAL '30 minutes'
    LIMIT 1
    `,
    [params.workspaceId, params.userId, params.title]
  );
  return duplicateCheck.rows.length > 0;
}

export async function notifyOperatorsForAutomationFailure(input: OperatorAlertInput): Promise<number> {
  const recipients = await resolveOperatorUserIds(input.workspaceId);
  if (!recipients.length) return 0;

  const title = input.classification.terminal
    ? `Automation terminal failure (${input.classification.code})`
    : `Automation failure retrying (${input.classification.code})`;
  const message = [
    `Policy #${input.automationPolicyId ?? 'n/a'} | Run #${input.runId ?? 'n/a'} | Schedule #${input.scheduleId ?? 'n/a'}`,
    `Severity: ${input.classification.severity} | Retryable: ${input.classification.retryable ? 'yes' : 'no'}`,
    `Action: ${input.classification.operatorAction}`,
    `Error: ${input.errorMessage}`
  ].join('\n');

  let createdCount = 0;
  for (const userId of recipients) {
    const duplicate = await hasRecentDuplicateAlert({
      workspaceId: input.workspaceId,
      userId,
      title
    });
    if (duplicate) continue;

    const inserted = await query(
      `
      INSERT INTO notifications (user_id, workspace_id, title, message, type, is_read, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'automation_failure', false, NOW(), NOW())
      RETURNING *
      `,
      [userId, input.workspaceId, title, message]
    );

    if (inserted.rows[0]) {
      createdCount += 1;
      emitToUser(userId, 'notification-created', {
        ...inserted.rows[0],
        roomId: input.roomId,
        runId: input.runId,
        scheduleId: input.scheduleId,
        automationPolicyId: input.automationPolicyId,
        queueJobId: input.jobId,
        failureCode: input.classification.code,
        severity: input.classification.severity
      });
    }
  }

  return createdCount;
}
