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

