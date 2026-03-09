/**
 * Main controller — dispatches signal actions and manages logging.
 * Works with any adapter (OpenCode, generic, etc.)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_PATH = process.env.SIGNAL_CONTROLLER_LOG ||
    path.join(process.cwd(), 'logs', 'session-active.md');

class Controller {
    constructor(logPath = LOG_PATH) {
        this.logPath = logPath;
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    appendLog(content) {
        fs.appendFileSync(this.logPath, content + '\n', 'utf8');
    }

    timestamp() {
        return new Date().toTimeString().slice(0, 5);
    }

    async dispatch(signal, content, adapter = null) {
        switch (signal) {
            case '@@ESCALATE':
                this.appendLog(
                    `\n---\n**[${this.timestamp()}] @@ESCALATE**\n${content}\n---\n`
                );
                console.log('\n⚠️  ESCALATE — Take this to Claude:');
                console.log(`\n${content}\n`);
                break;

            case '@@CHECKPOINT':
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
                console.log(`\n📍 CHECKPOINT saved: ${cpPath}`);
                console.log('Start a new session and load this file to continue.');
                break;

            case '@@DOCUMENT':
                this.appendLog(
                    `\n---\n**[${this.timestamp()}] @@DOCUMENT**\n${content}\n---\n`
                );
                console.log(`\n📝 Logged to ${this.logPath}`);
                break;

            case '@@CONFIRM':
                console.log(`\n⚠️  CONFIRM required:\n${content}`);
                const confirmed = await this.prompt('Confirm? (y/n): ');
                if (adapter && !confirmed) {
                    await adapter.injectFeedback('User did not confirm. Do not proceed.');
                }
                break;

            case '@@UNKNOWN':
                this.appendLog(
                    `\n---\n**[${this.timestamp()}] @@UNKNOWN**\n${content}\n---\n`
                );
                console.log(`\n❓ UNKNOWN logged`);
                break;
        }
    }

    prompt(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(resolve => {
            rl.question(question, answer => {
                rl.close();
                resolve(answer.toLowerCase() === 'y');
            });
        });
    }
}

module.exports = { Controller };