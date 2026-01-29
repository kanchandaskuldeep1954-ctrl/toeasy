# Phase 3: Smart Alerts & Notifications Implementation Plan

## Goal
Implement a robust alerting system that allows users to set data-driven thresholds on their metrics and receive notifications when those thresholds are breached.

## User Review Required
> [!IMPORTANT]
> This feature requires new database tables (`alerts`, `notifications`, `alert_history`) and a background job scheduler (or triggered check mechanism) to evaluate alerts.
> For this MVP, we will implement **Triggered Checks** (checking alerts when data is refreshed or via a periodic API call) rather than a separate always-on worker process, to keep deployment simple.

## Proposed Changes

### Database Schema
We need to add the following tables:
1.  **alerts**
    - `id`, `workspace_id`, `metric_id`, `name`, `condition_type` (GT, LT, EQ), `threshold_value`, `frequency` (daily, hourly, realtime), `owner_id`, `is_active`.
2.  **notifications**
    - `id`, `user_id`, `workspace_id`, `title`, `message`, `type` (alert, system, info), `is_read`, `created_at`.
3.  **alert_history**
    - `id`, `alert_id`, `value_at_trigger`, `triggered_at`.

### Backend (`backend/src`)
#### [NEW] `services/alertInfo.ts`
- Logic to evaluate a metric against a threshold.
- Function to generate notification records.

#### [NEW] `routes/alerts.ts`
- `GET /` - List alerts
- `POST /` - Create alert
- `PUT /:id` - Update alert
- `DELETE /:id` - Delete alert
- `POST /:id/check` - Manually trigger a check (for testing)

#### [NEW] `routes/notifications.ts`
- `GET /` - List unread notifications
- `POST /:id/read` - Mark as read
- `POST /read-all` - Mark all as read

#### [MODIFY] `index.ts`
- Register new routes.

### Frontend (`src`)
#### [NEW] `components/Alerts/AlertsManager.tsx`
- Dashboard for managing alert rules.

#### [NEW] `components/Alerts/CreateAlertModal.tsx`
- Form to define conditions (e.g., "Gross Revenue < 5000").

#### [NEW] `components/Notifications/NotificationCenter.tsx`
- Bell icon in the top navbar.
- Dropdown showing recent alerts.

#### [MODIFY] `services/api.ts`
- Add `alertsAPI` and `notificationsAPI`.

## Verification Plan
1.  **Database**: Verify tables are created (via SQL execution or migration).
2.  **API**: Test creating an alert, checking it (mocking data breach), and receiving a notification.
3.  **UI**: Verify Notification Center shows the badge and list.
