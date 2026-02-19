import { classifyAutomationFailure } from './automationFailureTaxonomy.js';

export interface MttrRunSample {
  automationPolicyId: number;
  status: string;
  ts: string | Date | null;
}

export interface FailureEventSample {
  eventType?: string | null;
  status?: string | null;
  error?: string | null;
  metadata?: Record<string, any> | string | null;
}

export interface FailureBucket {
  code: string;
  count: number;
  terminalCount: number;
  retryableCount: number;
  operatorAction?: string;
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

function toBooleanValue(value: any, fallback: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function toRounded(value: number, digits: number = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function computeMttrMinutesFromRuns(samples: MttrRunSample[]): number | null {
  const normalized = samples
    .map((sample) => ({
      automationPolicyId: Number(sample.automationPolicyId || 0),
      status: String(sample.status || '').toLowerCase(),
      tsMs: sample.ts ? new Date(sample.ts).getTime() : NaN
    }))
    .filter((sample) => Number.isFinite(sample.automationPolicyId) && sample.automationPolicyId > 0)
    .filter((sample) => Number.isFinite(sample.tsMs))
    .sort((a, b) => a.automationPolicyId - b.automationPolicyId || a.tsMs - b.tsMs);

  const failedByPolicy = new Map<number, number>();
  const mttrSamples: number[] = [];

  normalized.forEach((sample) => {
    if (sample.status === 'failed') {
      failedByPolicy.set(sample.automationPolicyId, sample.tsMs);
      return;
    }

    if (sample.status === 'completed') {
      const failedAt = failedByPolicy.get(sample.automationPolicyId);
      if (failedAt !== undefined && sample.tsMs >= failedAt) {
        mttrSamples.push((sample.tsMs - failedAt) / 60000);
        failedByPolicy.delete(sample.automationPolicyId);
      }
    }
  });

  if (mttrSamples.length === 0) return null;
  const average = mttrSamples.reduce((sum, value) => sum + value, 0) / mttrSamples.length;
  return toRounded(average, 2);
}

export function buildFailureBucketsFromEvents(samples: FailureEventSample[]): FailureBucket[] {
  const buckets = new Map<string, FailureBucket>();

  samples.forEach((sample) => {
    const metadata = parseJsonMaybe<Record<string, any>>(sample.metadata, {});
    const message = String(sample.error || metadata.message || '');
    const classified = classifyAutomationFailure({
      message: message || 'unknown failure',
      attemptsMade: Number(metadata.queueAttempt || metadata.attempt || 1),
      maxAttempts: Number(metadata.queueMaxAttempts || metadata.maxAttempts || 1)
    });

    const code = String(metadata.failureCode || classified.code || 'unknown');
    const terminal = toBooleanValue(
      metadata.failureTerminal,
      classified.terminal || String(sample.eventType || '').toLowerCase().includes('terminal')
    );
    const retryable = toBooleanValue(metadata.failureRetryable, classified.retryable);

    const bucket = buckets.get(code) || {
      code,
      count: 0,
      terminalCount: 0,
      retryableCount: 0,
      operatorAction:
        (typeof metadata.failureOperatorAction === 'string' && metadata.failureOperatorAction.trim()) ||
        classified.operatorAction
    };
    bucket.count += 1;
    if (terminal) bucket.terminalCount += 1;
    if (retryable) bucket.retryableCount += 1;
    if (!bucket.operatorAction && classified.operatorAction) {
      bucket.operatorAction = classified.operatorAction;
    }
    buckets.set(code, bucket);
  });

  return Array.from(buckets.values()).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}
