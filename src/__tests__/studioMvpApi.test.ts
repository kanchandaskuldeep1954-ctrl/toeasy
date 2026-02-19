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
