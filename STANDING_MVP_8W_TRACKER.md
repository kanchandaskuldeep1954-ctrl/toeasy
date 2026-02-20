# Toeasy Standing-MVP Tracker (8 Weeks)

Last updated: 2026-02-20
Scope: RevOps weekly Decision Room standing MVP
Execution mode: 80% reliability/QA, 20% manager UX clarity

## 1) Hard Gates (Go/No-Go)

| Gate | Target | Current status |
|---|---|---|
| Scheduled automation reliability | >= 99.5% per week | Instrumented (`/reliability/scorecard`), needs pilot telemetry run |
| Report publish reliability | >= 98% | Instrumented (`/reliability/scorecard`), needs pilot telemetry run |
| Duplicate side effects | 0 | Instrumented (task + publish duplicate checks), needs pilot telemetry run |
| Evidence coverage | >= 90% | Instrumented (`/readiness/go-no-go`, Report V2 quality), needs pilot telemetry run |
| Time to insight | median < 30 min | Instrumented (`snapshot.timeToInsightMin`), needs pilot telemetry run |
| Insight to action | median < 24h | Instrumented (`snapshot.insightToActionMin`), needs pilot telemetry run |
| Manual status reduction | >= 50% | Instrumented (`snapshot.manualUpdateReductionPct`), needs pilot telemetry run |
| Pilot proof | 3 paid pilots, >=2 hit KPIs | Not started in code, GTM execution pending |

## 2) Week-by-Week Execution

### Weeks 1-2: Reliability Foundation Closure
- [x] Reliability scorecard endpoint.
- [x] Manager summary endpoint.
- [x] Readiness go/no-go endpoint.
- [x] Workspace pilot scorecard endpoint.
- [x] Workspace pilot go/no-go endpoint.
- [x] Pilot incident SLA endpoints (list/ack/resolve).
- [x] Failure taxonomy incorporated in score math output.
- [x] Consecutive weekly reliability streak rule support.
- [x] Go/No-Go + Reliability + Manager cards in Studio right rail.

### Weeks 3-4: Test Depth Closure
- [x] Frontend API contract tests for readiness endpoints.
- [x] Backend unit tests for readiness gate decisioning.
- [x] Backend unit tests for reliability score internals (MTTR + failure buckets).
- [x] Backend integration tests for visuals/metrics/attribution.
- [x] Backend integration tests for profile/query-version/review/idempotency paths.
- [x] Queue retry/backoff + duplicate prevention integration tests.
- [x] Weekly full-flow E2E automation test.
- [x] Failed schedule recovery integration scenario.

### Weeks 5-6: Manager Control Tower V1
- [x] Pending approvals + blocked publishes + overdue actions + automation failure summary.
- [x] Recommended manager actions in summary payload.
- [x] Dedicated manager-mode screen (`/app/control-tower`) with direct nav access.
- [x] Incident SLA lane with acknowledge/resolve actions in manager surface.
- [x] Context-aware chat handoff from active room (`/app/chat?workspace&project&room`) with room-state summary and one-click context update publish.

### Weeks 7-8: Pilot Proof + Conversion Readiness
- [ ] 3 paid pilot telemetry review loop.
- [ ] Incident review runbook cadence and SLA scoreboard.
- [ ] Hard end-of-window Go/No-Go decision against gates.

## 3) Newly Added APIs

- [x] `GET /api/workspaces/:id/rooms/:roomId/reliability/scorecard`
- [x] `GET /api/workspaces/:id/rooms/:roomId/manager/summary`
- [x] `GET /api/workspaces/:id/rooms/:roomId/readiness/go-no-go`
- [x] `GET /api/workspaces/:id/pilot/scorecard`
- [x] `GET /api/workspaces/:id/pilot/readiness/go-no-go`
- [x] `GET /api/workspaces/:id/pilot/incidents`
- [x] `POST /api/workspaces/:id/pilot/incidents/:incidentId/ack`
- [x] `POST /api/workspaces/:id/pilot/incidents/:incidentId/resolve`
- [x] `POST /api/workspaces/:id/rooms/:roomId/bi-bridge/export`
- [x] `POST /api/workspaces/:id/rooms/:roomId/bi-bridge/share`
- [x] `GET /api/billing/plans`
- [x] `GET /api/billing/subscription`
- [x] `POST /api/billing/checkout`

## 4) Validation Log

- [x] Backend build passes (`npm run build`).
- [x] Backend test suite passes (`npm test`).
- [x] Frontend Studio API contract test suite passes (`src/__tests__/studioMvpApi.test.ts`).
- [x] Frontend production build passes (`npm run build`).

## 5) Next Concrete Build Slice

1. Keep hard-gate telemetry collection running in pilot workspaces for two consecutive weekly cycles.
2. Run reliability incident review cadence and close unresolved critical incidents within SLA.
3. Run 3 paid pilot accounts through weekly scorecard + incident review cycle and capture conversion readiness evidence.
