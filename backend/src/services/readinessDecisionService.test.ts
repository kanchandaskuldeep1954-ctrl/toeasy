import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReadinessGates } from './readinessDecisionService.js';

test('returns go when all hard gates pass and no manager blockers', () => {
  const decision = evaluateReadinessGates({
    snapshot: {
      timeToInsightMin: 18,
      insightToActionMin: 320,
      manualUpdateReductionPct: 64,
      evidenceCoverageRatio: 0.94
    },
    reliability: {
      scheduledRunSuccessRate: 0.998,
      publishSuccessRate: 0.99,
      duplicateSideEffects: 0
    },
    managerSummary: {
      pendingApprovals: 0,
      blockedPublishes: 0
    },
    checkedAt: '2026-02-19T00:00:00.000Z'
  });

  assert.equal(decision.overall, 'go');
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.gateResults.filter((gate) => gate.passed).length, 7);
  assert.equal(decision.checkedAt, '2026-02-19T00:00:00.000Z');
});

test('returns no_go when reliability and manager control gates fail', () => {
  const decision = evaluateReadinessGates({
    snapshot: {
      timeToInsightMin: 42,
      insightToActionMin: 2400,
      manualUpdateReductionPct: 31,
      evidenceCoverageRatio: 0.45
    },
    reliability: {
      scheduledRunSuccessRate: 0.92,
      publishSuccessRate: 0.73,
      duplicateSideEffects: 3
    },
    managerSummary: {
      pendingApprovals: 2,
      blockedPublishes: 1
    }
  });

  assert.equal(decision.overall, 'no_go');
  assert.equal(decision.gateResults.some((gate) => gate.key === 'duplicate_side_effects' && !gate.passed), true);
  assert.equal(decision.blockers.some((item) => item.includes('pending approval')), true);
  assert.equal(decision.blockers.some((item) => item.includes('blocked publish attempt')), true);
});

test('includes explanatory notes when no reliability or artifact timing data exists', () => {
  const decision = evaluateReadinessGates({
    snapshot: {
      timeToInsightMin: null,
      insightToActionMin: null,
      manualUpdateReductionPct: 0,
      evidenceCoverageRatio: 0
    },
    reliability: {
      scheduledRunSuccessRate: null,
      publishSuccessRate: null,
      duplicateSideEffects: 0
    },
    managerSummary: {
      pendingApprovals: 0,
      blockedPublishes: 0
    }
  });

  const scheduledGate = decision.gateResults.find((gate) => gate.key === 'scheduled_automation_reliability');
  const insightGate = decision.gateResults.find((gate) => gate.key === 'time_to_insight');
  assert.equal(decision.overall, 'no_go');
  assert.ok(scheduledGate?.note);
  assert.ok(insightGate?.note);
  assert.equal(decision.blockers.length >= 3, true);
});

test('enforces scheduled reliability failure only after two consecutive bad weeks', () => {
  const tolerated = evaluateReadinessGates({
    snapshot: {
      timeToInsightMin: 20,
      insightToActionMin: 200,
      manualUpdateReductionPct: 60,
      evidenceCoverageRatio: 0.95
    },
    reliability: {
      scheduledRunSuccessRate: 0.992,
      publishSuccessRate: 0.99,
      duplicateSideEffects: 0,
      consecutiveWeeklyReliabilityFailures: 1
    },
    managerSummary: {
      pendingApprovals: 0,
      blockedPublishes: 0
    }
  });

  const strictFailure = evaluateReadinessGates({
    snapshot: {
      timeToInsightMin: 20,
      insightToActionMin: 200,
      manualUpdateReductionPct: 60,
      evidenceCoverageRatio: 0.95
    },
    reliability: {
      scheduledRunSuccessRate: 0.992,
      publishSuccessRate: 0.99,
      duplicateSideEffects: 0,
      consecutiveWeeklyReliabilityFailures: 2
    },
    managerSummary: {
      pendingApprovals: 0,
      blockedPublishes: 0
    }
  });

  const scheduledGateTolerated = tolerated.gateResults.find((gate) => gate.key === 'scheduled_automation_reliability');
  const scheduledGateStrict = strictFailure.gateResults.find((gate) => gate.key === 'scheduled_automation_reliability');

  assert.equal(scheduledGateTolerated?.passed, true);
  assert.equal(scheduledGateStrict?.passed, false);
  assert.equal(strictFailure.overall, 'no_go');
});
