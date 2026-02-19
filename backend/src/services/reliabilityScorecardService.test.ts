import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFailureBucketsFromEvents,
  computeMttrMinutesFromRuns
} from './reliabilityScorecardService.js';

test('computes MTTR average from failed-to-completed run pairs', () => {
  const mttr = computeMttrMinutesFromRuns([
    { automationPolicyId: 1, status: 'failed', ts: '2026-02-19T10:00:00.000Z' },
    { automationPolicyId: 1, status: 'completed', ts: '2026-02-19T10:08:00.000Z' },
    { automationPolicyId: 2, status: 'failed', ts: '2026-02-19T11:00:00.000Z' },
    { automationPolicyId: 2, status: 'completed', ts: '2026-02-19T11:22:00.000Z' }
  ]);

  assert.equal(mttr, 15);
});

test('returns null MTTR when no failed run is recovered', () => {
  const mttr = computeMttrMinutesFromRuns([
    { automationPolicyId: 3, status: 'completed', ts: '2026-02-19T10:00:00.000Z' },
    { automationPolicyId: 3, status: 'running', ts: '2026-02-19T10:05:00.000Z' }
  ]);

  assert.equal(mttr, null);
});

test('builds failure buckets with terminal and retryable counters', () => {
  const buckets = buildFailureBucketsFromEvents([
    {
      eventType: 'execution_failed',
      error: 'HTTP 429 too many requests',
      metadata: { queueAttempt: 1, queueMaxAttempts: 3 }
    },
    {
      eventType: 'execution_failed_terminal',
      error: 'permission denied on connector',
      metadata: { failureTerminal: true, failureRetryable: false, failureCode: 'permission_denied' }
    },
    {
      eventType: 'execution_retry_scheduled',
      error: 'HTTP 429 too many requests',
      metadata: { queueAttempt: 2, queueMaxAttempts: 3 }
    }
  ]);

  const rateLimited = buckets.find((bucket) => bucket.code === 'rate_limited');
  const permissionDenied = buckets.find((bucket) => bucket.code === 'permission_denied');

  assert.equal(rateLimited?.count, 2);
  assert.equal(rateLimited?.retryableCount, 2);
  assert.equal(Boolean(rateLimited?.operatorAction), true);
  assert.equal(permissionDenied?.count, 1);
  assert.equal(permissionDenied?.terminalCount, 1);
});
