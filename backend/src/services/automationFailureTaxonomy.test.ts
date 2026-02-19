import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAutomationFailure } from './automationFailureTaxonomy.js';

test('classifies authentication failures as connector_auth', () => {
  const classification = classifyAutomationFailure({
    message: 'password authentication failed for user "analyst"',
    attemptsMade: 1,
    maxAttempts: 3
  });

  assert.equal(classification.code, 'connector_auth');
  assert.equal(classification.category, 'connector');
  assert.equal(classification.retryable, false);
  assert.equal(classification.terminal, false);
});

test('classifies rate limit failures as retryable platform failures', () => {
  const classification = classifyAutomationFailure({
    message: 'HTTP 429 too many requests from provider',
    attemptsMade: 1,
    maxAttempts: 3
  });

  assert.equal(classification.code, 'rate_limited');
  assert.equal(classification.category, 'platform');
  assert.equal(classification.retryable, true);
  assert.equal(classification.terminal, false);
});

test('classifies terminal syntax failures with escalated severity', () => {
  const classification = classifyAutomationFailure({
    message: 'syntax error at or near "FROMM"',
    attemptsMade: 3,
    maxAttempts: 3
  });

  assert.equal(classification.code, 'query_syntax');
  assert.equal(classification.terminal, true);
  assert.equal(classification.severity, 'high');
  assert.match(classification.operatorAction, /terminal failure/i);
});

test('classifies unknown failures safely', () => {
  const classification = classifyAutomationFailure({
    message: 'unexpected issue with custom provider',
    attemptsMade: 1,
    maxAttempts: 2
  });

  assert.equal(classification.code, 'unknown');
  assert.equal(classification.category, 'unknown');
  assert.equal(classification.retryable, true);
});
