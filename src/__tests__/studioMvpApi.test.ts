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

  it('calls outcomes attribution endpoint', () => {
    studioAPI.getOutcomeAttribution('12', '77', { persist: true });
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/outcomes/attribution', {
      params: { persist: true }
    });
  });

  it('calls playbook recommendations endpoint', () => {
    studioAPI.getPlaybookRecommendations('12', '77');
    expect(mockGet).toHaveBeenCalledWith('/workspaces/12/rooms/77/playbooks/recommendations');
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
