/**
 * Notification system for signal-controller.
 * Handles desktop (Windows toast) and mobile (Ntfy) notifications.
 * Priority levels: critical, high, normal, silent
 */

const { execSync } = require('child_process');

const NTFY_SERVER = process.env.SIGNAL_CONTROLLER_NTFY_SERVER || 'https://ntfy.sh';
const NTFY_CHANNEL = process.env.SIGNAL_CONTROLLER_NTFY_CHANNEL || 'signal-controller';

const PRIORITY = {
    critical: 5,
    high: 4,
    normal: 3,
    low: 2,
    silent: 1,
};

const SIGNAL_CONFIG = {
    '@@ESCALATE:CRITICAL':   { priority: 'critical', pause: true,  ntfy: true,  desktop: true,  commands: false },
    '@@ESCALATE:QUESTION':   { priority: 'normal',   pause: false, ntfy: true,  desktop: true,  commands: true  },
    '@@CHECKPOINT:AUTO':     { priority: 'high',     pause: true,  ntfy: true,  desktop: true,  commands: false },
    '@@CHECKPOINT:MANUAL':   { priority: 'normal',   pause: false, ntfy: true,  desktop: true,  commands: true  },
    '@@DOCUMENT':            { priority: 'silent',   pause: false, ntfy: false, desktop: true,  commands: false },
    '@@CONFIRM':             { priority: 'critical', pause: true,  ntfy: true,  desktop: true,  commands: false },
    '@@UNKNOWN:ANALYSIS':    { priority: 'silent',   pause: false, ntfy: false, desktop: false, commands: false },
    '@@UNKNOWN:ACTION':      { priority: 'critical', pause: true,  ntfy: true,  desktop: true,  commands: false },
    '@@READY:NEXT_PHASE':    { priority: 'normal',   pause: true,  ntfy: true,  desktop: true,  commands: true  },
};

async function sendNtfy({ title, message, priority = 'normal', tags = [], actions = [] }) {
    const headers = {
        'Content-Type': 'application/json',
        'Title': title,
        'Priority': String(PRIORITY[priority] || 3),
    };

    if (tags.length > 0) headers['Tags'] = tags.join(',');

    const body = { topic: NTFY_CHANNEL, message };
    if (actions.length > 0) body.actions = actions;

    try {
        const response = await fetch(`${NTFY_SERVER}/${NTFY_CHANNEL}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            console.error(`Ntfy error: ${response.status}`);
        }
    } catch (e) {
        console.error(`Ntfy unreachable: ${e.message}`);
    }
}

function sendDesktop(title, message) {
    try {
        // Windows toast via PowerShell
        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            $notify = New-Object System.Windows.Forms.NotifyIcon
            $notify.Icon = [System.Drawing.SystemIcons]::Information
            $notify.Visible = $true
            $notify.ShowBalloonTip(5000, '${title.replace(/'/g, '')}', '${message.replace(/'/g, '')}', 'Info')
        `;
        execSync(`powershell -Command "${script}"`, { stdio: 'ignore' });
    } catch (e) {
        // Silently fail if not on Windows
    }
}

function getSignalConfig(signal) {
    return SIGNAL_CONFIG[signal] || {
        priority: 'normal',
        pause: false,
        ntfy: true,
        desktop: true,
        commands: false,
    };
}

module.exports = { sendNtfy, sendDesktop, getSignalConfig, SIGNAL_CONFIG };