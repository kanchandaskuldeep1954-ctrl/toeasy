export type AutomationFailureCode =
  | 'connector_auth'
  | 'connector_unreachable'
  | 'query_syntax'
  | 'rate_limited'
  | 'permission_denied'
  | 'invalid_input'
  | 'timeout'
  | 'approval_timeout'
  | 'unknown';

export type AutomationFailureCategory =
  | 'connector'
  | 'query'
  | 'platform'
  | 'permission'
  | 'validation'
  | 'workflow'
  | 'unknown';

export type AutomationFailureSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AutomationFailureClassification {
  code: AutomationFailureCode;
  category: AutomationFailureCategory;
  severity: AutomationFailureSeverity;
  retryable: boolean;
  terminal: boolean;
  operatorAction: string;
  matchedSignals: string[];
}

export interface AutomationFailureClassificationInput {
  message: string;
  attemptsMade?: number;
  maxAttempts?: number;
}

interface FailureRule {
  code: AutomationFailureCode;
  category: AutomationFailureCategory;
  severity: AutomationFailureSeverity;
  retryable: boolean;
  operatorAction: string;
  signals: RegExp[];
}

const FAILURE_RULES: FailureRule[] = [
  {
    code: 'connector_auth',
    category: 'connector',
    severity: 'high',
    retryable: false,
    operatorAction: 'Re-authenticate the connector or rotate credentials.',
    signals: [
      /password authentication failed/i,
      /invalid credentials?/i,
      /token expired/i,
      /\bunauthorized\b/i,
      /authentication failed/i
    ]
  },
  {
    code: 'connector_unreachable',
    category: 'connector',
    severity: 'high',
    retryable: true,
    operatorAction: 'Check network reachability and connector host availability.',
    signals: [
      /\beconnrefused\b/i,
      /\benotfound\b/i,
      /connection.*(refused|reset|closed|failed|timeout)/i,
      /socket hang up/i,
      /network error/i
    ]
  },
  {
    code: 'query_syntax',
    category: 'query',
    severity: 'medium',
    retryable: false,
    operatorAction: 'Fix SQL or script syntax and rerun.',
    signals: [
      /syntax error/i,
      /parse error/i,
      /unexpected token/i,
      /unterminated/i
    ]
  },
  {
    code: 'rate_limited',
    category: 'platform',
    severity: 'medium',
    retryable: true,
    operatorAction: 'Lower run frequency or raise provider quota limits.',
    signals: [
      /\b429\b/i,
      /rate limit/i,
      /too many requests/i,
      /throttl/i
    ]
  },
  {
    code: 'permission_denied',
    category: 'permission',
    severity: 'high',
    retryable: false,
    operatorAction: 'Grant required role/permission for the executing actor.',
    signals: [
      /permission denied/i,
      /\bforbidden\b/i,
      /insufficient privilege/i,
      /not authorized/i
    ]
  },
  {
    code: 'invalid_input',
    category: 'validation',
    severity: 'medium',
    retryable: false,
    operatorAction: 'Correct invalid input payload or required fields.',
    signals: [
      /invalid input/i,
      /validation failed/i,
      /required field/i,
      /must be/i
    ]
  },
  {
    code: 'approval_timeout',
    category: 'workflow',
    severity: 'medium',
    retryable: true,
    operatorAction: 'Route approval to a designated approver and retry.',
    signals: [
      /approval.*timeout/i,
      /approver.*timeout/i,
      /awaiting approval timed out/i
    ]
  },
  {
    code: 'timeout',
    category: 'platform',
    severity: 'medium',
    retryable: true,
    operatorAction: 'Increase timeout or reduce workload size.',
    signals: [
      /\btimeout\b/i,
      /timed out/i,
      /operation exceeded/i
    ]
  }
];

const SEVERITY_ORDER: Record<AutomationFailureSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

function escalateSeverity(
  severity: AutomationFailureSeverity,
  terminal: boolean
): AutomationFailureSeverity {
  if (!terminal) return severity;
  if (severity === 'critical') return 'critical';
  const nextLevel = Math.min(SEVERITY_ORDER[severity] + 1, 3);
  return (Object.entries(SEVERITY_ORDER).find(([, value]) => value === nextLevel)?.[0] ||
    'critical') as AutomationFailureSeverity;
}

function pickRule(message: string): { rule: FailureRule | null; matchedSignals: string[] } {
  const matched = FAILURE_RULES.find((candidate) =>
    candidate.signals.some((signal) => signal.test(message))
  );
  if (!matched) {
    return { rule: null, matchedSignals: [] };
  }

  const matchedSignals = matched.signals
    .filter((signal) => signal.test(message))
    .map((signal) => signal.source);
  return { rule: matched, matchedSignals };
}

export function classifyAutomationFailure(
  input: AutomationFailureClassificationInput
): AutomationFailureClassification {
  const message = String(input.message || '');
  const attemptsMade = Math.max(1, Number(input.attemptsMade || 1));
  const maxAttempts = Math.max(1, Number(input.maxAttempts || 1));
  const terminal = attemptsMade >= maxAttempts;
  const picked = pickRule(message);

  if (!picked.rule) {
    return {
      code: 'unknown',
      category: 'unknown',
      severity: escalateSeverity('high', terminal),
      retryable: true,
      terminal,
      operatorAction: terminal
        ? 'Inspect run logs and retry manually after root-cause review.'
        : 'Observe next retry; escalate if the failure repeats.',
      matchedSignals: []
    };
  }

  const actionPrefix = terminal ? 'Terminal failure. ' : '';
  return {
    code: picked.rule.code,
    category: picked.rule.category,
    severity: escalateSeverity(picked.rule.severity, terminal),
    retryable: picked.rule.retryable,
    terminal,
    operatorAction: `${actionPrefix}${picked.rule.operatorAction}`,
    matchedSignals: picked.matchedSignals
  };
}
