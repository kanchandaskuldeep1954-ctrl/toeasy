import axios from 'axios';
import { analyticsAPI, initializeAPIClient, studioAPI } from '../services/api';

jest.mock('axios');

describe('Studio MVP API Contracts', () => {
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  const mockClient = {
    get: mockGet,
    post: mockPost,
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(mockClient);
    initializeAPIClient('test-token');
  });

  it('calls room guide endpoint', () => {
    studioAPI.getGuide('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/guide');
  });

  it('calls guide complete-step endpoint', () => {
    studioAPI.completeGuideStep('12', '77', 'analyze_data');
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/guide/complete-step', { stepId: 'analyze_data' });
  });

  it('calls status draft endpoint', () => {
    studioAPI.generateStatusDraft('12', '77', { persist: true });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/status/draft', { persist: true });
  });

  it('calls data profile generation endpoint', () => {
    studioAPI.generateDataProfile('12', '77', { datasetVersionId: 9, minQualityScore: 0.7 });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/data/profile', {
      datasetVersionId: 9,
      minQualityScore: 0.7
    });
  });

  it('calls room trust endpoint', () => {
    studioAPI.getRoomTrust('12', '77', { threshold: 0.65 });
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/data/trust', {
      params: { threshold: 0.65 }
    });
  });

  it('calls Report V2 generate endpoint', () => {
    studioAPI.generateReportV2('12', '77', { timeframeDays: 7, compareMode: 'previous_period', focus: 'revops_weekly' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/reports/v2/generate', {
      timeframeDays: 7,
      compareMode: 'previous_period',
      focus: 'revops_weekly'
    });
  });

  it('calls Report V2 latest endpoint', () => {
    studioAPI.getLatestReportV2('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/reports/v2/latest');
  });

  it('calls Report V2 quality endpoint', () => {
    studioAPI.getReportV2Quality('12', '77', 'bundle_1');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/reports/v2/bundle_1/quality');
  });

  it('calls Report V2 publish endpoint', () => {
    studioAPI.publishReportV2('12', '77', 'bundle_1', { channel: 'slack', mentionTokens: ['@ops'] });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/reports/v2/bundle_1/publish', {
      channel: 'slack',
      mentionTokens: ['@ops']
    });
  });

  it('calls room threads endpoint', () => {
    studioAPI.listThreads('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/threads');
  });

  it('calls create thread endpoint', () => {
    studioAPI.createThread('12', '77', { artifactId: 11, content: 'Need review @ops' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/threads', { artifactId: 11, content: 'Need review @ops' });
  });

  it('calls thread comment endpoint', () => {
    studioAPI.addThreadComment('12', '77', 99, { content: 'Approved' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/threads/99/comments', { content: 'Approved' });
  });

  it('calls thread resolve endpoint', () => {
    studioAPI.resolveThread('12', '77', 99, { status: 'resolved', resolutionNote: 'Addressed in report v2' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/comments/99/resolve', {
      status: 'resolved',
      resolutionNote: 'Addressed in report v2'
    });
  });

  it('calls room approvals endpoint', () => {
    studioAPI.listApprovals('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/approvals');
  });

  it('calls decision checkpoints endpoint', () => {
    studioAPI.listDecisionCheckpoints('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/decision-checkpoints');
  });

  it('calls create decision checkpoint endpoint', () => {
    studioAPI.createDecisionCheckpoint('12', '77', { decision: 'Approve plan', artifactId: 55 });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/decision-checkpoints', { decision: 'Approve plan', artifactId: 55 });
  });

  it('calls respond decision checkpoint endpoint', () => {
    studioAPI.respondDecisionCheckpoint('12', '77', 5, { decision: 'approved' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/decision-checkpoints/5/respond', { decision: 'approved' });
  });

  it('calls metrics catalog endpoint', () => {
    studioAPI.getMetricsCatalog('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/metrics/catalog');
  });

  it('calls metric owner assignment endpoint', () => {
    studioAPI.assignMetricOwner('12', '77', 9, { ownerId: 15 });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/metrics/9/owner', { ownerId: 15 });
  });

  it('calls metrics validate endpoint', () => {
    studioAPI.validateMetrics('12', '77', { metricIds: [1, 2] });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/metrics/validate', { metricIds: [1, 2] });
  });

  it('calls visual build endpoint', () => {
    studioAPI.buildVisual('12', '77', {
      name: 'Weekly Pipeline Trend',
      spec: {
        chartType: 'line',
        dimensions: ['date'],
        measures: ['amount'],
        drillPath: ['date', 'owner']
      }
    });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/visuals/build', {
      name: 'Weekly Pipeline Trend',
      spec: {
        chartType: 'line',
        dimensions: ['date'],
        measures: ['amount'],
        drillPath: ['date', 'owner']
      }
    });
  });

  it('calls visual drill endpoint', () => {
    studioAPI.drillVisual('12', '77', 200, { level: 1, pathValues: { date: '2026-02-18' } });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/visuals/200/drill', {
      level: 1,
      pathValues: { date: '2026-02-18' }
    });
  });

  it('calls visual annotation endpoint', () => {
    studioAPI.annotateVisual('12', '77', 200, { text: 'Owner concentration spike', anchor: { rowKey: 'owner=Alex' } });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/visuals/200/annotate', {
      text: 'Owner concentration spike',
      anchor: { rowKey: 'owner=Alex' }
    });
  });

  it('calls visual annotations list endpoint', () => {
    studioAPI.listVisualAnnotations('12', '77', 200);
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/visuals/200/annotations');
  });

  it('calls query version save endpoint', () => {
    studioAPI.saveQueryVersion('12', '77', {
      queryId: 5,
      sqlTemplate: 'select * from deals where owner = :owner',
      parametersSchema: { owner: { type: 'string' } }
    });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/queries/save-version', {
      queryId: 5,
      sqlTemplate: 'select * from deals where owner = :owner',
      parametersSchema: { owner: { type: 'string' } }
    });
  });

  it('calls query versions list endpoint', () => {
    studioAPI.listQueryVersions('12', '77', 5);
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/queries/5/versions');
  });

  it('calls pivot compute endpoint', () => {
    studioAPI.computePivot('12', '77', {
      name: 'Weekly owner pivot',
      spec: {
        dimensions: ['owner'],
        measures: [{ field: 'amount', agg: 'sum', as: 'amount_sum' }],
        calculations: [{ type: 'rank', sourceField: 'amount_sum', as: 'amount_rank', order: 'desc' }]
      }
    });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/pivots/compute', {
      name: 'Weekly owner pivot',
      spec: {
        dimensions: ['owner'],
        measures: [{ field: 'amount', agg: 'sum', as: 'amount_sum' }],
        calculations: [{ type: 'rank', sourceField: 'amount_sum', as: 'amount_rank', order: 'desc' }]
      }
    });
  });

  it('calls outcomes attribution endpoint', () => {
    studioAPI.getOutcomeAttribution('12', '77', { persist: true });
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/outcomes/attribution', {
      params: { persist: true }
    });
  });

  it('calls evidence coverage trend endpoint', () => {
    studioAPI.getEvidenceCoverageTrend('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/evidence/coverage-trend');
  });

  it('calls room ROI endpoint', () => {
    studioAPI.getRoomRoi('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/roi');
  });

  it('calls reliability scorecard endpoint', () => {
    studioAPI.getReliabilityScorecard('12', '77', { periodDays: 14 });
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/reliability/scorecard', {
      params: { periodDays: 14 }
    });
  });

  it('calls manager summary endpoint', () => {
    studioAPI.getManagerSummary('12', '77', { periodDays: 7 });
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/manager/summary', {
      params: { periodDays: 7 }
    });
  });

  it('calls go/no-go readiness endpoint', () => {
    studioAPI.getReadinessDecision('12', '77', { periodDays: 30 });
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/readiness/go-no-go', {
      params: { periodDays: 30 }
    });
  });

  it('calls persona profile get endpoint', () => {
    studioAPI.getPersonaProfile('12');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/preferences/profile');
  });

  it('calls persona profile update endpoint', () => {
    studioAPI.updatePersonaProfile('12', { persona: 'manager', uiMode: 'guided' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/preferences/profile', {
      persona: 'manager',
      uiMode: 'guided'
    });
  });

  it('calls review submit endpoint', () => {
    studioAPI.submitReview('12', '77', { bundleId: 'bundle_7', reviewerId: 13, stage: 'manager_review' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/review/submit', {
      bundleId: 'bundle_7',
      reviewerId: 13,
      stage: 'manager_review'
    });
  });

  it('calls review respond endpoint', () => {
    studioAPI.respondReview('12', '77', { submissionId: 10, decision: 'approved', responseNote: 'Ship it' });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/review/respond', {
      submissionId: 10,
      decision: 'approved',
      responseNote: 'Ship it'
    });
  });

  it('calls review submissions list endpoint', () => {
    studioAPI.listReviewSubmissions('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/review/submissions');
  });

  it('calls playbook recommendations endpoint', () => {
    studioAPI.getPlaybookRecommendations('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/playbooks/recommendations');
  });

  it('calls onboarding playbook endpoint', () => {
    studioAPI.getOnboardingPlaybook('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/playbooks/onboarding');
  });

  it('calls SQL connect endpoint with validation toggle', () => {
    studioAPI.connectSQL('12', {
      provider: 'postgres',
      name: 'Primary Postgres',
      validateConnection: false,
      credentials: {
        host: 'localhost',
        port: 5432,
        database: 'analytics',
        user: 'analyst'
      }
    });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/integrations/sql/connect', {
      provider: 'postgres',
      name: 'Primary Postgres',
      validateConnection: false,
      credentials: {
        host: 'localhost',
        port: 5432,
        database: 'analytics',
        user: 'analyst'
      }
    });
  });

  it('calls SQL profile list endpoint', () => {
    studioAPI.listSqlProfiles('12');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/integrations/sql/profiles');
  });

  it('calls schedule automation endpoint', () => {
    studioAPI.scheduleAutomation('12', '77', {
      policyId: 4,
      cron: '0 9 * * 1',
      timezone: 'UTC',
      dedupeKey: 'weekly_revops',
      retryPolicy: { maxAttempts: 4, backoffMs: 500 },
      isActive: true
    });
    expect(mockPost).toHaveBeenCalledWith('/workspaces/12/rooms/77/automations/schedule', {
      policyId: 4,
      cron: '0 9 * * 1',
      timezone: 'UTC',
      dedupeKey: 'weekly_revops',
      retryPolicy: { maxAttempts: 4, backoffMs: 500 },
      isActive: true
    });
  });

  it('calls automation runs endpoint', () => {
    studioAPI.listAutomationRuns('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/automations/runs');
  });

  it('calls automation queue state endpoint', () => {
    studioAPI.getAutomationQueueState('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/automations/queue-state');
  });

  it('calls MVP KPI snapshot endpoint', () => {
    analyticsAPI.getMvpKpis('12', 45);
    expect(mockGet).toHaveBeenCalledWith('/analytics/workspaces/12/mvp-kpis', { params: { days: 45 } });
  });

  it('tracks analytics events through analytics API', () => {
    analyticsAPI.trackEvent('decision_room_test_event', { workspaceId: 12 });
    expect(mockPost).toHaveBeenCalledWith('/analytics/events', {
      event: 'decision_room_test_event',
      metadata: { workspaceId: 12 }
    });
  });
});
