/**
 * Notification system for signal-controller.
 * Handles desktop (Windows toast) and mobile (Ntfy) notifications.
 * Priority levels: critical, high, normal, silent
 */

const { execSync } = require('child_process');

const NTFY_SERVER = process.env.SIGNAL_CONTROLLER_NTFY_SERVER || 'https://ntfy.sh';
const NTFY_CHANNEL = process.env.SIGNAL_CONTROLLER_NTFY_CHANNEL;
const NTFY_REPLIES_CHANNEL = `${NTFY_CHANNEL}-replies`;

if (!NTFY_CHANNEL) {
    console.warn('⚠️  SIGNAL_CONTROLLER_NTFY_CHANNEL not set. Ntfy notifications disabled.');
}

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

async function pollReplies(callback) {
    let since = 'last';
    console.log(`👂 Listening for replies on ${NTFY_SERVER}/${NTFY_REPLIES_CHANNEL}`);
    
    while (true) {
        try {
            const response = await fetch(
                `${NTFY_SERVER}/${NTFY_REPLIES_CHANNEL}/json?poll=1&since=${since}`
            );
            const text = await response.text();
            const lines = text.trim().split('\n').filter(Boolean);
            
            for (const line of lines) {
                try {
                    const msg = JSON.parse(line);
                    if (msg.message && msg.id) {
                        since = msg.id;
                        await callback(msg.message);
                    }
                } catch (e) {}
            }
        } catch (e) {
            // silently retry
        }
        await new Promise(r => setTimeout(r, 3000));
    }
}

async function sendNtfy({ title, message, priority = 'normal', tags = [], actions = [] }) {
    const cleanTitle = title.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
    const cleanMessage = message.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
    
    console.log(`DEBUG ntfy: sending to ${NTFY_SERVER}/${NTFY_CHANNEL}`);
    console.log(`DEBUG title: ${cleanTitle}`);
    console.log(`DEBUG message: ${cleanMessage}`);

    try {
        const response = await fetch(`${NTFY_SERVER}/${NTFY_CHANNEL}`, {
            method: 'POST',
            body: cleanMessage,
            headers: {
                'Title': cleanTitle,
                'Priority': String(PRIORITY[priority] || 3),
                'Tags': tags.join(','),
            }
        });
        console.log(`DEBUG ntfy status: ${response.status}`);
    } catch (e) {
        console.error(`Ntfy error: ${e.message}`);
    }
}

function sendDesktop(title, message) {
    try {
        // Clean for PowerShell single-quoted strings
        const safeTitle = title.replace(/'/g, '').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
        const safeMessage = message.replace(/'/g, '').replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();
        
        const script = `
            [void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
            $notify = New-Object System.Windows.Forms.NotifyIcon
            $notify.Icon = [System.Drawing.SystemIcons]::Information
            $notify.BalloonTipTitle = '${safeTitle}'
            $notify.BalloonTipText = '${safeMessage}'
            $notify.Visible = $true
            $notify.ShowBalloonTip(5000)
            Start-Sleep -Milliseconds 5500
            $notify.Dispose()
        `;
        execSync(
            `powershell -ExecutionPolicy Bypass -Command "${script}"`,
            { stdio: 'pipe' }
        );
    } catch (e) {
        console.error(`Desktop notification error: ${e.message}`);
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

module.exports = { sendNtfy, sendDesktop, getSignalConfig, SIGNAL_CONFIG, pollReplies, NTFY_CHANNEL };