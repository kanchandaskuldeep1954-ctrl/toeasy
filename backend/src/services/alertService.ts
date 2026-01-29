
import { query } from '../db.js';

export class AlertService {
    /**
     * Check all active alerts for a workspace.
     * This is a simplified implementation. In a real system, this would:
     * 1. Resolve the metric's data source.
     * 2. Execute the aggregation query.
     * 3. Compare the result.
     */
    static async checkAlerts(workspaceId: string) {
        console.log(`Checking alerts for workspace ${workspaceId}...`);

        // 1. Fetch active alerts
        const alertsResult = await query(`
      SELECT a.*, m.name as metric_name 
      FROM alerts a
      JOIN metrics m ON a.metric_id = m.id
      WHERE a.workspace_id = $1 AND a.is_active = true
    `, [workspaceId]);

        const alerts = alertsResult.rows;
        const notifications: any[] = [];

        for (const alert of alerts) {
            // 2. Calculate Metric Value
            // TODO: Connect this to the actual Analytics Engine using alert.metric_id
            // For MVP demo, we simulate a value between 0 and 10000
            const calculatedValue = Math.floor(Math.random() * 10000);

            // 3. Evaluate Condition
            let triggered = false;
            switch (alert.condition_type) {
                case 'GT': triggered = calculatedValue > Number(alert.threshold_value); break;
                case 'LT': triggered = calculatedValue < Number(alert.threshold_value); break;
                case 'EQ': triggered = calculatedValue === Number(alert.threshold_value); break;
            }

            if (triggered) {
                // 4. Create Notification
                console.log(`Alert triggered: ${alert.name} (Value: ${calculatedValue})`);

                await query(`
          INSERT INTO alert_history (alert_id, value_at_trigger)
          VALUES ($1, $2)
        `, [alert.id, calculatedValue]);

                const message = `Alert "${alert.name}" triggered! Value ${calculatedValue} is ${alert.condition_type} ${alert.threshold_value}.`;

                await query(`
          INSERT INTO notifications (user_id, workspace_id, title, message, type)
          VALUES ($1, $2, $3, $4, 'alert')
        `, [alert.owner_id, workspaceId, 'Metric Alert', message]);

                notifications.push({ alert: alert.name, value: calculatedValue });
            }
        }

        return notifications;
    }
}
