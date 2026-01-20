
/**
 * Predictive Analytics Engine
 * Provides statistical forecasting and anomaly detection.
 */
export class PredictiveAnalytics {

    /**
     * Simple Linear Regression (Least Squares)
     * Returns the slope (m), intercept (b), and R-squared.
     * Predicts next N values.
     */
    static performLinearRegression(data: { x: number; y: number }[], forecastSteps: number = 3): {
        slope: number;
        intercept: number;
        rSquared: number;
        forecast: { x: number; y: number }[];
        trendLine: { x: number; y: number }[];
    } {
        const n = data.length;
        if (n < 2) return { slope: 0, intercept: 0, rSquared: 0, forecast: [], trendLine: [] };

        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        data.forEach(p => {
            sumX += p.x;
            sumY += p.y;
            sumXY += p.x * p.y;
            sumXX += p.x * p.x;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R-Squared
        const meanY = sumY / n;
        let ssTot = 0, ssRes = 0;
        data.forEach(p => {
            const predictedY = slope * p.x + intercept;
            ssTot += Math.pow(p.y - meanY, 2);
            ssRes += Math.pow(p.y - predictedY, 2);
        });
        const rSquared = 1 - (ssRes / ssTot);

        // Generate Trend Line Points
        const trendLine = data.map(p => ({ x: p.x, y: slope * p.x + intercept }));

        // Forecast
        const forecast: { x: number; y: number }[] = [];
        const lastX = data[n - 1].x;
        // Assume x interval is roughly constant, use average dx
        const avgDx = (data[n - 1].x - data[0].x) / (n - 1);

        for (let i = 1; i <= forecastSteps; i++) {
            const nextX = lastX + (avgDx * i);
            forecast.push({ x: nextX, y: slope * nextX + intercept });
        }

        return { slope, intercept, rSquared, forecast, trendLine };
    }

    /**
     * Simple Moving Average Forecasting to smooth data
     */
    static forecastMovingAverage(values: number[], window: number = 3, forecastSteps: number = 3): number[] {
        if (values.length < window) return [];

        const result: number[] = [];
        // Helper to get SMA at index
        const getSMA = (arr: number[], idx: number) => {
            if (idx < window - 1) return arr[idx];
            let sum = 0;
            for (let i = 0; i < window; i++) sum += arr[idx - i];
            return sum / window;
        };

        // Forecast: Use last known SMA as the projection (naive) 
        // OR better: use linear regression on the SMA trend
        // Simple approach: Weighted average of last window
        const lastWindow = values.slice(-window);
        const avg = lastWindow.reduce((a, b) => a + b, 0) / window;

        // Return baseline forecast (flat)
        for (let i = 0; i < forecastSteps; i++) {
            result.push(avg);
        }

        return result;
    }

    /**
     * Detect Anomalies using Z-Score (Standard deviation from mean)
     * Sensitivity: 2 = 95%, 3 = 99.7% confidence
     */
    static detectAnomaliesZScore(values: number[], sensitivity: number = 2.5): { index: number; value: number; zScore: number }[] {
        if (values.length < 5) return [];

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return [];

        const anomalies: { index: number; value: number; zScore: number }[] = [];
        values.forEach((v, i) => {
            const zScore = Math.abs((v - mean) / stdDev);
            if (zScore > sensitivity) {
                anomalies.push({ index: i, value: v, zScore });
            }
        });

        return anomalies;
    }

    /**
     * Attempts to find a seasonal pattern index (e.g., peak on Fridays)
     * Returns the index in the cycle (0-6 for weekly) that is highest.
     */
    static detectSeasonality(data: { date: Date; value: number }[]): { cycle: 'weekly' | 'monthly' | 'none', peakIndex: number, strength: number } {
        if (data.length < 14) return { cycle: 'none', peakIndex: -1, strength: 0 };

        // Test Weekly (7 days)
        const daySums = new Array(7).fill(0);
        const dayCounts = new Array(7).fill(0);

        data.forEach(d => {
            const day = d.date.getDay(); // 0 (Sun) - 6 (Sat)
            daySums[day] += d.value;
            dayCounts[day]++;
        });

        const dayAvgs = daySums.map((s, i) => dayCounts[i] ? s / dayCounts[i] : 0);
        const globalAvg = dayAvgs.reduce((a, b) => a + b, 0) / 7;

        // Calculate variance of the distinct day averages
        const variance = dayAvgs.reduce((a, b) => a + Math.pow(b - globalAvg, 2), 0) / 7;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / (globalAvg || 1);

        // Find peak day
        let maxVal = -1;
        let peakIndex = -1;
        dayAvgs.forEach((v, i) => {
            if (v > maxVal) {
                maxVal = v;
                peakIndex = i;
            }
        });

        // Coefficient of Variation > 0.1 implies some structure
        if (cv > 0.1) {
            return { cycle: 'weekly', peakIndex, strength: cv };
        }

        return { cycle: 'none', peakIndex: -1, strength: 0 };
    }
}
