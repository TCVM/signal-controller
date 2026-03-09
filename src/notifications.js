/**
 * Notification system for signal-controller.
 * Desktop notifications via node-notifier.
 * Mobile notifications via Ntfy.
 */

const https = require('https');

const NTFY_CHANNEL = process.env.NTFY_CHANNEL || 'gma500-tc';
const NTFY_SERVER = process.env.NTFY_SERVER || 'https://ntfy.sh';

// Priority levels for Ntfy
const NTFY_PRIORITY = {
    low: 1,
    default: 3,
    high: 4,
    urgent: 5,
};

// Signal criticality config
const SIGNAL_CONFIG = {
    '@@ESCALATE:CRITICAL':  { pause: true,  priority: 'urgent', desktop: true, mobile: true  },
    '@@ESCALATE:QUESTION':  { pause: false, priority: 'default', desktop: true, mobile: true  },
    '@@CHECKPOINT:AUTO':    { pause: false, priority: 'default', desktop: true, mobile: false },
    '@@CHECKPOINT:MANUAL':  { pause: false, priority: 'low',     desktop: true, mobile: false },
    '@@DOCUMENT':           { pause: false, priority: 'low',     desktop: false, mobile: false },
    '@@CONFIRM':            { pause: true,  priority: 'urgent',  desktop: true, mobile: true  },
    '@@UNKNOWN:ANALYSIS':   { pause: false, priority: 'low',     desktop: false, mobile: false },
    '@@UNKNOWN:ACTION':     { pause: true,  priority: 'urgent',  desktop: true, mobile: true  },
};

async function sendMobileNotification(title, message, priority = 'default') {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ 
            topic: NTFY_CHANNEL,
            title,
            message,
            priority: NTFY_PRIORITY[priority] || 3,
        });

        const url = new URL(NTFY_SERVER);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: '/publish',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const req = https.request(options, res => {
            resolve(res.statusCode);
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function sendDesktopNotification(title, message) {
    // Use Windows toast notification via PowerShell
    const ps = require('child_process').spawn('powershell', [
        '-Command',
        `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
        $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)
        $text = $xml.GetElementsByTagName('text')
        $text[0].AppendChild($xml.CreateTextNode('${title.replace(/'/g, "''")}')) | Out-Null
        $text[1].AppendChild($xml.CreateTextNode('${message.replace(/'/g, "''")}')) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Signal Controller').Show($toast)
        `
    ]);
    ps.on('error', () => {}); // silently ignore if fails
}

async function notify(signal, content) {
    const config = SIGNAL_CONFIG[signal];
    if (!config) return;

    const title = `Signal Controller — ${signal}`;
    const message = content.slice(0, 200); // Ntfy message limit

    if (config.desktop) {
        sendDesktopNotification(title, message);
    }

    if (config.mobile) {
        try {
            await sendMobileNotification(title, message, config.priority);
        } catch (e) {
            console.error('Mobile notification failed:', e.message);
        }
    }
}

function shouldPause(signal) {
    return SIGNAL_CONFIG[signal]?.pause || false;
}

module.exports = { notify, shouldPause, SIGNAL_CONFIG };