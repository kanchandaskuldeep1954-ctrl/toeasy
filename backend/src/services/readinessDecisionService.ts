export interface GateResult {
  key: string;
  label: string;
  threshold: string;
  actual: number | string | null;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  note?: string;
}

export interface PilotKpiSnapshot {
  timeToInsightMin: number | null;
  insightToActionMin: number | null;
  manualUpdateReductionPct: number;
  evidenceCoverageRatio: number;
}

export interface ReliabilityScorecardForReadiness {
  scheduledRunSuccessRate: number | null;
  publishSuccessRate: number | null;
  duplicateSideEffects: number;
  consecutiveWeeklyReliabilityFailures?: number;
}

export interface ManagerSummaryForReadiness {
  pendingApprovals: number;
  blockedPublishes: number;
}

export interface ReadinessDecision {
  gateResults: GateResult[];
  overall: 'go' | 'no_go';
  blockers: string[];
  checkedAt: string;
  snapshot: PilotKpiSnapshot;
  reliability: ReliabilityScorecardForReadiness;
}

export function evaluateReadinessGates(input: {
  snapshot: PilotKpiSnapshot;
  reliability: ReliabilityScorecardForReadiness;
  managerSummary: ManagerSummaryForReadiness;
  checkedAt?: string;
}): ReadinessDecision {
  const consecutiveReliabilityFailures = Math.max(
    0,
    Number(input.reliability.consecutiveWeeklyReliabilityFailures || 0)
  );
  const scheduledReliabilityPassed =
    input.reliability.scheduledRunSuccessRate !== null &&
    (
      input.reliability.scheduledRunSuccessRate >= 0.995 ||
      consecutiveReliabilityFailures < 2
    );

  const gateResults: GateResult[] = [
    {
      key: 'scheduled_automation_reliability',
      label: 'Scheduled automation reliability',
      threshold: '>= 99.5%',
      actual: input.reliability.scheduledRunSuccessRate,
      passed: scheduledReliabilityPassed,
      severity: 'critical',
      note:
        input.reliability.scheduledRunSuccessRate === null
          ? 'No resolved scheduled runs in selected period.'
          : input.reliability.scheduledRunSuccessRate < 0.995 && consecutiveReliabilityFailures < 2
            ? `Below 99.5% this period, but not a 2-week consecutive failure (current streak: ${consecutiveReliabilityFailures}).`
            : input.reliability.scheduledRunSuccessRate < 0.995 && consecutiveReliabilityFailures >= 2
              ? `Below 99.5% for ${consecutiveReliabilityFailures} consecutive week(s).`
          : undefined
    },
    {
      key: 'report_publish_reliability',
      label: 'Report publish reliability',
      threshold: '>= 98%',
      actual: input.reliability.publishSuccessRate,
      passed:
        input.reliability.publishSuccessRate !== null &&
        input.reliability.publishSuccessRate >= 0.98,
      severity: 'critical',
      note:
        input.reliability.publishSuccessRate === null
          ? 'No publish attempts observed in selected period.'
          : undefined
    },
    {
      key: 'duplicate_side_effects',
      label: 'Duplicate side effects',
      threshold: '0 duplicates',
      actual: input.reliability.duplicateSideEffects,
      passed: input.reliability.duplicateSideEffects === 0,
      severity: 'critical'
    },
    {
      key: 'evidence_trust',
      label: 'Evidence coverage on published claims',
      threshold: '>= 90%',
      actual: input.snapshot.evidenceCoverageRatio,
      passed: input.snapshot.evidenceCoverageRatio >= 0.9,
      severity: 'high',
      note:
        input.snapshot.evidenceCoverageRatio <= 0
          ? 'No evidence-backed publish history found yet.'
          : undefined
    },
    {
      key: 'time_to_insight',
      label: 'Median time to insight',
      threshold: '< 30 minutes',
      actual: input.snapshot.timeToInsightMin,
      passed:
        input.snapshot.timeToInsightMin !== null &&
        input.snapshot.timeToInsightMin < 30,
      severity: 'high',
      note:
        input.snapshot.timeToInsightMin === null
          ? 'No query_run artifact captured yet.'
          : undefined
    },
    {
      key: 'insight_to_action',
      label: 'Median insight to assigned action',
      threshold: '< 24 hours',
      actual: input.snapshot.insightToActionMin,
      passed:
        input.snapshot.insightToActionMin !== null &&
        input.snapshot.insightToActionMin < 24 * 60,
      severity: 'high',
      note:
        input.snapshot.insightToActionMin === null
          ? 'No action_item artifact captured after insight yet.'
          : undefined
    },
    {
      key: 'manual_status_reduction',
      label: 'Manual status-update reduction',
      threshold: '>= 50%',
      actual: input.snapshot.manualUpdateReductionPct,
      passed: input.snapshot.manualUpdateReductionPct >= 50,
      severity: 'medium'
    }
  ];

  const blockers = gateResults
    .filter((gate) => !gate.passed)
    .map((gate) => {
      const actual = gate.actual === null ? 'n/a' : String(gate.actual);
      const suffix = gate.note ? ` ${gate.note}` : '';
      return `${gate.label} failed (${actual}).${suffix}`;
    });

  if (input.managerSummary.blockedPublishes > 0) {
    blockers.push(
      `${input.managerSummary.blockedPublishes} blocked publish attempt(s) require claim/evidence fixes.`
    );
  }
  if (input.managerSummary.pendingApprovals > 0) {
    blockers.push(
      `${input.managerSummary.pendingApprovals} pending approval(s) are still open.`
    );
  }

  return {
    gateResults,
    overall: blockers.length === 0 ? 'go' : 'no_go',
    blockers,
    checkedAt: input.checkedAt || new Date().toISOString(),
    snapshot: input.snapshot,
    reliability: input.reliability
  };
}
