/**
 * Session metrics tracker. JS port of metrics.py.
 */

class SessionMetrics {
    constructor() {
        this.signalCounts = {};
        this.signalHistory = []; // [{timestamp, signal}]
        this.sessionStart = new Date();
        this.thresholds = {
            '@@UNKNOWN': 3,
            '@@ESCALATE': 5,
            total: 15,
        };
    }

    record(signal) {
        this.signalCounts[signal] = (this.signalCounts[signal] || 0) + 1;
        this.signalHistory.push({ timestamp: new Date(), signal });
    }

    checkDegradation() {
        const warnings = [];
        const total = Object.values(this.signalCounts).reduce((a, b) => a + b, 0);

        if (total >= this.thresholds.total) {
            warnings.push(`High signal volume: ${total} total signals`);
        }

        for (const [signal, threshold] of Object.entries(this.thresholds)) {
            if (signal === 'total') continue;
            if ((this.signalCounts[signal] || 0) >= threshold) {
                warnings.push(
                    `${signal} threshold exceeded: ${this.signalCounts[signal]} times`
                );
            }
        }

        return warnings;
    }

    consecutiveUnknowns() {
        let count = 0;
        for (let i = this.signalHistory.length - 1; i >= 0; i--) {
            if (this.signalHistory[i].signal === '@@UNKNOWN') count++;
            else break;
        }
        return count;
    }

    summary(compact = false) {
        const duration = Math.floor((new Date() - this.sessionStart) / 60000);
        if (compact) {
            const total = Object.values(this.signalCounts).reduce((a, b) => a + b, 0);
            return `${duration}min, ${total} signals`;
        }
        const lines = [`Duration: ${duration} minutes`];
        for (const [signal, count] of Object.entries(this.signalCounts)) {
            lines.push(`  ${signal}: ${count}`);
        }
        return lines.join('\n');
    }
}

module.exports = { SessionMetrics };