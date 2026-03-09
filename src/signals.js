/**
 * Signal definitions and parser.
 * JS port of signals.py for OpenCode SDK integration.
 */

const SIGNALS = {
    '@@ESCALATE': {
        description: 'Needs a more capable model',
        severity: 'high',
    },
    '@@CHECKPOINT': {
        description: 'Context degrading or session is long',
        severity: 'high',
    },
    '@@DOCUMENT': {
        description: 'Important finding occurred',
        severity: 'medium',
    },
    '@@CONFIRM': {
        description: 'About to do something irreversible',
        severity: 'high',
    },
    '@@UNKNOWN': {
        description: 'Cannot determine with available information',
        severity: 'low',
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