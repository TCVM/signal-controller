/**
 * Entry point — choose adapter based on environment.
 * 
 * Usage:
 *   node src/index.js              # generic (manual paste) mode
 *   node src/index.js --opencode   # OpenCode real-time mode
 */

require('dotenv').config({ 
    path: process.env.SIGNAL_CONTROLLER_ENV
});

console.log('DEBUG ENV path:', process.env.SIGNAL_CONTROLLER_ENV);
console.log('DEBUG channel:', process.env.SIGNAL_CONTROLLER_NTFY_CHANNEL);

const { Controller } = require('./controller');
const args = process.argv.slice(2);

async function main() {
    const controller = new Controller();

    if (args.includes('--opencode')) {
        const { OpenCodeAdapter } = require('./adapters/opencode');
        const adapter = new OpenCodeAdapter(controller);
        await adapter.streamAndMonitor();
    } else {
        // Generic mode — manual paste via stdin
        const { GenericAdapter } = require('./adapters/generic');
        const adapter = new GenericAdapter(controller);
        await adapter.run();
    }
}

main().catch(console.error);