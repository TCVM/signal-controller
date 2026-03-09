/**
 * Signal definitions and parser.
 */

const SIGNALS = {
    '@@ESCALATE:CRITICAL': {
        description: 'Needs more capable model — CRITICAL, pause and wait',
        severity: 'critical',
        baseSignal: '@@ESCALATE',
    },
    '@@ESCALATE:QUESTION': {
        description: 'Has a question for more capable model — can continue',
        severity: 'medium',
        baseSignal: '@@ESCALATE',
    },
    '@@CHECKPOINT:AUTO': {
        description: 'Context degraded, auto checkpoint and new session',
        severity: 'high',
        baseSignal: '@@CHECKPOINT',
    },
    '@@CHECKPOINT:MANUAL': {
        description: 'Long session, suggests manual checkpoint',
        severity: 'low',
        baseSignal: '@@CHECKPOINT',
    },
    '@@DOCUMENT': {
        description: 'Important finding, log it',
        severity: 'low',
        baseSignal: '@@DOCUMENT',
    },
    '@@CONFIRM': {
        description: 'About to do something irreversible, pause and confirm',
        severity: 'critical',
        baseSignal: '@@CONFIRM',
    },
    '@@UNKNOWN:ANALYSIS': {
        description: 'Does not know what something is — observing only, continue',
        severity: 'low',
        baseSignal: '@@UNKNOWN',
    },
    '@@UNKNOWN:ACTION': {
        description: 'Does not know if action is safe — STOP immediately',
        severity: 'critical',
        baseSignal: '@@UNKNOWN',
    },
};

function parseOutput(output) {
    const lines = output.trim().split('\n');
    let signal = null;
    const contentLines = [];

    for (const line of lines) {
        const stripped = line.trim();
        if (SIGNALS[stripped]) {
            signal = stripped;
        } else {
            contentLines.push(line);
        }
    }

    return {
        signal,
        content: contentLines.join('\n').trim(),
    };
}

module.exports = { SIGNALS, parseOutput };