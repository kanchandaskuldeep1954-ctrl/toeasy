import { query } from "../db.js";

interface Alert {
    id: number;
    workspace_id: number;
    metric_id?: number;
    condition_type: 'GT' | 'LT' | 'EQ';
    threshold_value: number;
    name: string;
    owner_id: number;
}

export class AlertService {
    /**
     * Evaluates a specific alert against current data.
     * This logic assumes we can fetch the "current value" of a metric.
     * For this MVP, we might fetch from a 'metrics' table or execute a saved SQL query.
     */
    static async checkAlert(alertId: number): Promise<boolean> {
        try {
            // 1. Fetch Alert Definition
            const alertRes = await query(`SELECT * FROM alerts WHERE id = $1`, [alertId]);
            if (alertRes.rows.length === 0) return false;
            const alert = alertRes.rows[0] as Alert;

            // 2. Fetch Current Value
            // TODO: In a real system, this would be dynamic based on metric_id or a query_id.
            // For MVP, we'll simulate or use a placeholder 'metrics' table if it exists.
            // If metric_id is null, we might be checking a system stat.

            let currentValue = 0;
            if (alert.metric_id) {
                const metricRes = await query(`SELECT value FROM metrics WHERE id = $1 ORDER BY created_at DESC LIMIT 1`, [alert.metric_id]);
                if (metricRes.rows.length > 0) {
                    currentValue = metricRes.rows[0].value;
                }
            } else {
                // Fallback or specific logic
                return false;
            }

            // 3. Compare
            let triggered = false;
            if (alert.condition_type === 'GT' && currentValue > alert.threshold_value) triggered = true;
            if (alert.condition_type === 'LT' && currentValue < alert.threshold_value) triggered = true;
            if (alert.condition_type === 'EQ' && currentValue === alert.threshold_value) triggered = true;

            // 4. Action if Triggered
            if (triggered) {
                await this.triggerAlert(alert, currentValue);
                return true;
            }

            return false;
        } catch (err) {
            console.error(`Error checking alert ${alertId}:`, err);
            return false;
        }
    }

    private static async triggerAlert(alert: Alert, value: number) {
        // A. Record History
        await query(
            `INSERT INTO alert_history (alert_id, value_at_trigger) VALUES ($1, $2)`,
            [alert.id, value]
        );

        // B. Create Notification
        const message = `Alert "${alert.name}" triggered! Current value: ${value} is ${alert.condition_type} ${alert.threshold_value}`;
        await query(
            `INSERT INTO notifications (user_id, workspace_id, title, message, type) VALUES ($1, $2, $3, $4, 'alert')`,
            [alert.owner_id, alert.workspace_id, 'Alert Triggered', message]
        );
    }

    /**
     * Check all active alerts for a workspace.
     * Can be called by a cron job or manual refresh.
     */
    static async checkAllWorkspaceAlerts(workspaceId: number) {
        const alerts = await query(`SELECT id FROM alerts WHERE workspace_id = $1 AND is_active = true`, [workspaceId]);
        for (const row of alerts.rows) {
            await this.checkAlert(row.id);
        }
    }
}
