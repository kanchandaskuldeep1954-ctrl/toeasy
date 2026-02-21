# Toeasy Real Full-Proof App Plan
## Correct Track: Hybrid BI + Execution, Simplicity First, Reliability Moat

## Summary
1. Build Toeasy as a **Decision Execution BI** product: easy visuals/tables/dashboards plus evidence-backed approvals/actions.
2. Keep scope locked to the **RevOps weekly operating loop** until PMF proof is complete.
3. Make UX default to **Simple Mode**, preserve **Pro Mode** for analyst depth.
4. Use a **24-month moat strategy** with **70% reliability / 30% UX** execution allocation.
5. Scale only when hard gates pass; otherwise stay narrow and fix.

## Strategy Lock (Non-Negotiable)
1. Dominance horizon: 24-month moat.
2. Primary moat: execution reliability and trust.
3. GTM motion: narrow wedge, deep win.
4. Initial wedge: SMB RevOps weekly decision cycle.
5. Pricing: value-based premium, not BI seat parity undercut.
6. Expansion path: adjacent Ops teams after wedge proof.
7. AI policy: assistive only, never forced, human-gated for mutating/publish actions.

## Real Product Definition
1. Category: Decision Execution BI for RevOps.
2. Core value: one room where teams go from data to decision to owned follow-through.
3. Core loop: `Connect -> Analyze -> Visualize -> Brief -> Approve -> Assign -> Sync -> Status -> Outcome`.
4. Winning claim: faster weekly decisions with lower coordination overhead and higher evidence trust.

## Target Customers and Users
1. Primary ICP: 20–200 employee companies with RevOps ownership and 1–5 analysts/operators.
2. Buyer: Head of RevOps / Ops Manager.
3. Daily users: Analyst and Manager.
4. Weekly consumers: Executive stakeholders.
5. Secondary channel: RevOps/data agencies operating recurring client reviews.
6. Individual entry: Solo Analyst plan for acquisition and expansion signal.

## In Scope and Out of Scope
1. In scope: Sheets + Postgres/MySQL + Slack.
2. In scope: Studio-first workflows, Report V2, approvals, action sync, status automation, reliability scorecards.
3. In scope: Simple Mode dashboard/table/report convenience.
4. Out of scope: connector explosion, enterprise compliance overbuild, autonomous high-risk AI actions, full Tableau parity race.

## Product Architecture Shape
1. Primary shell: Studio.
2. Modes: `simple` and `pro`.
3. Canonical context: `workspace`, `dataset`, `project`, `room`, `panel`.
4. Artifact-first system: every output persisted and lineage-linked.
5. Governance layer: evidence contract, metric policy, publish gates, approval gates.
6. Ops layer: schedules, retries, dedupe, incidents, readiness decisioning.

## Core UX Blueprint
1. Simple Mode is default for all users.
2. Pro Mode is one-click accessible from any Simple Mode screen.
3. Simple Home has three actions:
`Build Weekly Dashboard`, `Run Weekly Brief`, `Review Actions`.
4. Every screen shows:
`What this is`, `What to do next`, `What blocks publish`.
5. Context rail supports overlay/docked/focus modes and user preference persistence.
6. Communication is first-class via Comms panel and workspace chat.

## Capability Map (What Ships)
1. Data and analysis: Sheets table operations, SQL/NL runs, pivot compute, saved query versions.
2. Visual layer: template-first visual builder, drill, cross-filter, annotations, pinned insights.
3. Dashboard layer: room-scoped dashboards, filterable tiles, evidence badges.
4. Reporting: Report V2 generation, quality checks, publish gating, review lane.
5. Execution: evidence-linked actions, Slack sync, status drafts, accountability board.
6. Collaboration: threads, mentions, approvals, checkpoints, resolution timeline.
7. Reliability ops: automation schedules, queue state, failure taxonomy, incident SLA lifecycle.
8. Commercial: plans/subscription/checkout with pilot-ready packaging.

## Implementation Plan (16 Weeks, Decision Complete)
### Phase 1 (Weeks 1–2): Simple Mode Foundation
1. Add mode persistence and routing defaults.
2. Create Simple Home API and screen with next-step cards.
3. Add panel clarity cards across Studio.
4. Add workflow health summary per room.

### Phase 2 (Weeks 3–4): Easy Visuals and Dashboards
1. Introduce Dashboard entity and CRUD.
2. Add template-first visual flow with 8 RevOps templates.
3. Add dashboard tile evidence badges and freshness indicators.
4. Add room-level dashboard filters and saved views.

### Phase 3 (Weeks 5–6): Table Convenience and Pivot Speed
1. Add saved table view presets.
2. Add fast grouping/sorting/top-N flows in Simple Mode.
3. Add one-click pivot-to-visual and visual-to-report paths.
4. Add explicit “why blocked” diagnostics for missing required artifacts.

### Phase 4 (Weeks 7–8): Weekly Brief Wizard
1. Build guided weekly brief run flow using Report V2 backend.
2. Show quality gate blockers inline with corrective actions.
3. Add role-aware mention presets and reviewer suggestions.
4. Add manager quick approve/reject actions in same flow.

### Phase 5 (Weeks 9–12): Reliability and Governance Hardening
1. Finalize idempotency on all mutating sync/publish/schedule paths.
2. Expand incident and runbook diagnostics in manager surfaces.
3. Add deterministic actor resolution and replay-safe execution logs.
4. Add readiness go/no-go card in Simple Mode manager view.

### Phase 6 (Weeks 13–16): Pilot Proof and Conversion Readiness
1. Run 3 paid pilots through weekly cycles.
2. Operate weekly KPI + reliability + incident review.
3. Execute day-60 conversion motion for accounts with gate pass.
4. Produce end-of-phase go/no-go package for scale decision.

## Public APIs / Interfaces / Types
## Keep Stable
1. Existing Studio run/artifact/report/action/comms/reliability/readiness/pilot/billing endpoints remain backward compatible.

## Additive APIs
1. `GET /api/workspaces/:id/mode`
2. `POST /api/workspaces/:id/mode`
3. `GET /api/workspaces/:id/rooms/:roomId/simple/home`
4. `POST /api/workspaces/:id/rooms/:roomId/dashboards`
5. `GET /api/workspaces/:id/rooms/:roomId/dashboards`
6. `POST /api/workspaces/:id/rooms/:roomId/dashboards/:dashboardId/tiles`
7. `POST /api/workspaces/:id/rooms/:roomId/tables/view`
8. `GET /api/workspaces/:id/rooms/:roomId/workflow/health`
9. `GET /api/workspaces/:id/rooms/:roomId/adoption/friction`
10. `POST /api/workspaces/:id/rooms/:roomId/assistant/recommend-next`
11. `GET /api/workspaces/:id/rooms/:roomId/templates/revops`
12. `GET /api/workspaces/:id/rooms/:roomId/simple/manager-summary`

## Type Additions
1. `UxMode { mode: 'simple' | 'pro', updatedAt, updatedBy }`
2. `Dashboard { id, roomId, name, timeframeDays, filters, tileIds, createdAt, updatedAt }`
3. `DashboardTile { id, dashboardId, artifactId, tileType, title, config, evidenceIds }`
4. `TableViewPreset { id, roomId, name, filters, grouping, sorting, visibleColumns }`
5. `WorkflowHealth { completionPct, blockers, missingRequiredArtifacts, stageLatency }`
6. `FrictionSignal { stage, dropoffRate, topErrors, topAbandons }`
7. `NextActionRecommendation { id, panel, reason, requiredInputs, confidence }`
8. `SimpleHomeState { nextStep, blockers, kpiSnapshot, pendingApprovals, overdueActions }`

## Data Model and Migration Plan
1. Additive migrations only.
2. Add tables: `dashboards`, `dashboard_tiles`, `table_view_presets`, optional `room_workflow_health_snapshots`.
3. Add indexes on room/time/status for retrieval and manager views.
4. Keep existing artifact and lineage model as source of truth.
5. No destructive schema changes during PMF window.

## Reliability and Security Requirements
1. RBAC enforced for all mutating routes.
2. Idempotency keys required on publish/sync/schedule/execute/share.
3. Retry/backoff with terminal failure classification.
4. Incident lifecycle and SLA timestamps mandatory.
5. Workspace isolation validated across all new endpoints.
6. Audit logs for approvals, review transitions, publish, sync, and incident resolution.

## Test Cases and Scenarios
1. Functional e2e:
connect -> query -> pivot -> visuals -> dashboard -> report -> review -> publish -> action sync -> status draft.
2. Simple Mode usability:
new user completes first dashboard and first brief without Pro Mode.
3. Evidence gate:
unsupported claims block publish with actionable blockers.
4. Reliability:
duplicate trigger replay yields zero duplicate side effects.
5. Recovery:
failed automation resumes without duplicate action creation.
6. Permission:
viewer cannot mutate dashboards/reports/actions/reviews/incidents.
7. Isolation:
cross-workspace access to dashboards/tiles/incidents is blocked.
8. Billing:
plan limits and checkout/subscription states enforced correctly.
9. Performance:
large row rendering, dashboard load, and report generation latency under target.
10. Regression:
existing Studio and Report V2 contracts remain compatible.

## PMF and Dominance Gates
1. Scheduled automation reliability `>=99.5%`.
2. Report publish reliability `>=98%`.
3. Duplicate side effects `=0 unresolved`.
4. Evidence coverage on published claims `>=90%`.
5. Median time-to-insight `<30 minutes`.
6. Median insight-to-assigned-action `<24 hours`.
7. Manual status update reduction `>=50%`.
8. Pilot proof: 3 paid pilots complete cycle, at least 2 hit KPI targets with renewal intent.

## Rollout Plan
1. Stage 1: internal dogfood with Simple Mode + Pro Mode flags.
2. Stage 2: 3 paid design-partner pilots.
3. Stage 3: no broad rollout until gate package says `go`.
4. Stage 4: scale to adjacent Ops teams only after RevOps wedge proof.
5. Weekly operating cadence: KPI scorecard, reliability incidents, renewal-risk review.

## Commercial Plan
1. Solo Analyst: `$49/month` (`$39` annual equivalent) as feeder.
2. Team pilot: `$2k/month` target band `$1.5k–$3k` + optional onboarding.
3. Annual conversion: `$15k–$24k/year` by seats and automation volume.
4. Pricing basis: measurable execution savings and decision reliability, not visualization seat count.

## Assumptions and Defaults Chosen
1. PMF geography: US-first.
2. Segment: SMB RevOps teams.
3. Deployment: cloud SaaS.
4. Connector lock: Sheets + Postgres/MySQL + Slack.
5. AI policy: assistive + human-gated execution.
6. Product default: Simple Mode first, Pro Mode preserved.
7. Scale policy: hard gate pass required; if two consecutive cycles fail, pause scale and narrow scope.
