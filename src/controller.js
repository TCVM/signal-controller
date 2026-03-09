/**
 * Main controller with notification support and criticality-based pausing.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { notify, shouldPause } = require('./notifications');

const LOG_PATH = process.env.SIGNAL_CONTROLLER_LOG ||
    path.join(process.cwd(), 'logs', 'session-active.md');

class Controller {
    constructor(logPath = LOG_PATH) {
        this.logPath = logPath;
        this.paused = false;
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    appendLog(content) {
        fs.appendFileSync(this.logPath, content + '\n', 'utf8');
    }

    timestamp() {
        return new Date().toTimeString().slice(0, 5);
    }

    async waitForResume(signal, adapter) {
        console.log(`\n⏸️  PAUSED — ${signal} requires your input.`);
        console.log('Press Enter to resume, or type a response to inject:\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            rl.question('> ', async answer => {
                rl.close();
                if (answer.trim() && adapter) {
                    await adapter.injectFeedback(
                        `User response: ${answer}`
                    );
                }
                console.log('▶️  Resuming...\n');
                resolve();
            });
        });
    }

    async dispatch(signal, content, adapter = null) {
        const ts = this.timestamp();

        // Log everything
        this.appendLog(`\n---\n**[${ts}] ${signal}**\n${content}\n---\n`);

        // Send notifications
        await notify(signal, content);

        // Handle by signal type
        switch (signal) {
            case '@@ESCALATE:CRITICAL':
                console.log('\n🔴 ESCALATE CRITICAL — Take this to Claude:');
                console.log(`\n${content}\n`);
                await this.waitForResume(signal, adapter);
                break;

            case '@@ESCALATE:QUESTION':
                console.log('\n🟡 ESCALATE QUESTION — Qwen has a question for Claude:');
                console.log(`\n${content}\n`);
                console.log('(Qwen continues working — answer when you can)\n');
                break;

            case '@@CHECKPOINT:AUTO':
                await this.saveCheckpoint(content, adapter);
                console.log('\n📍 Auto checkpoint saved. Qwen will start new session.');
                break;

            case '@@CHECKPOINT:MANUAL':
                console.log('\n📍 Checkpoint suggested. Run start.bat when ready.');
                break;

            case '@@DOCUMENT':
                console.log(`\n📝 Finding logged.`);
                break;

            case '@@CONFIRM':
                console.log('\n⚠️  CONFIRM required:');
                console.log(content);
                await this.waitForResume(signal, adapter);
                break;

            case '@@UNKNOWN:ANALYSIS':
                console.log(`\n❓ Unknown logged — analysis only, continuing.`);
                break;

            case '@@UNKNOWN:ACTION':
                console.log('\n🔴 UNKNOWN ACTION — Qwen stopped. Review before continuing:');
                console.log(`\n${content}\n`);
                await this.waitForResume(signal, adapter);
                break;
        }
    }

    async saveCheckpoint(content, adapter) {
        const ts = new Date().toTimeString().slice(0, 5).replace(':', '');
        const cpPath = path.join(
            path.dirname(this.logPath),
            `context-checkpoint-${ts}.md`
        );
        fs.writeFileSync(
            cpPath,
            `# Context Checkpoint — ${ts}\n\n${content}`,
            'utf8'
        );
        if (adapter) {
            await adapter.injectFeedback(
                `Checkpoint saved to ${cpPath}. ` +
                `Start a new OpenCode session and load this file to continue.`
            );
        }
        return cpPath;
    }
}

module.exports = { Controller };