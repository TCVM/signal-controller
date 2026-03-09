/**
 * Generic adapter — manual paste mode.
 * Works with any LLM that doesn't have API access.
 */

const { parseOutput } = require('../signals');
const { SessionMetrics } = require('../metrics');
const readline = require('readline');

class GenericAdapter {
    constructor(controller) {
        this.controller = controller;
        this.metrics = new SessionMetrics();
    }

    async run() {
        console.log('🟢 signal-controller active (generic mode)');
        console.log(`📁 Logging to: ${this.controller.logPath}`);
        console.log('Paste LLM output blocks. Enter blank line twice to process.\n');

        while (true) {
            const output = await this.readBlock();
            if (!output) continue;

            const { signal, content } = parseOutput(output);

            if (signal) {
                this.metrics.record(signal);
                await this.controller.dispatch(signal, content);

                const warnings = this.metrics.checkDegradation();
                for (const w of warnings) {
                    console.log(`\n🟡 WARNING: ${w}`);
                }
            } else {
                console.log(content);
            }

            console.log('\n--- Paste next block ---\n');
        }
    }

    readBlock() {
        return new Promise(resolve => {
            const rl = readline.createInterface({ input: process.stdin });
            const lines = [];
            let blanks = 0;

            rl.on('line', line => {
                if (line === '') {
                    blanks++;
                    if (blanks >= 2) {
                        rl.close();
                        resolve(lines.join('\n'));
                    }
                } else {
                    blanks = 0;
                    lines.push(line);
                }
            });

            rl.on('close', () => resolve(lines.join('\n')));
        });
    }
}

module.exports = { GenericAdapter };