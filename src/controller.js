/**
 * Main controller — signal dispatcher with notifications and phase management.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { sendNtfy, sendDesktop, getSignalConfig } = require('./notifications');
const { PhaseManager } = require('./phases');

const LOG_PATH = process.env.SIGNAL_CONTROLLER_LOG ||
    path.join(process.cwd(), 'logs', 'session-active.md');

const CALLBACK_PORT = process.env.SIGNAL_CONTROLLER_CALLBACK_PORT || 3737;

class Controller {
    constructor(logPath = LOG_PATH) {
        this.logPath = logPath;
        this.phases = new PhaseManager();
        this.phases.load();
        this.pendingPause = null;
        this.adapter = null;
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        this.startCallbackServer();
        this.startReplyPolling();
    }

    appendLog(content) {
        fs.appendFileSync(this.logPath, content + '\n', 'utf8');
    }

    timestamp() {
        return new Date().toTimeString().slice(0, 5);
    }

    startCallbackServer() {
        // Listens for commands from Ntfy actions (phone responses)
        const server = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/phase') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const { choice } = JSON.parse(body);
                        this.handlePhaseChoice(choice);
                        res.writeHead(200);
                        res.end('ok');
                    } catch (e) {
                        res.writeHead(400);
                        res.end('error');
                    }
                });
            } else if (req.method === 'POST' && req.url === '/answer') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { text } = JSON.parse(body);
                        if (this.adapter) {
                            await this.adapter.injectFeedback(
                                `[RESPUESTA DESDE TELÉFONO]: ${text}`
                            );
                        }
                        res.writeHead(200);
                        res.end('ok');
                    } catch (e) {
                        res.writeHead(400);
                        res.end('error');
                    }
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(CALLBACK_PORT, () => {
            console.log(`📡 Callback server listening on port ${CALLBACK_PORT}`);
        });
    }

    startReplyPolling() {
        const { pollReplies } = require('./notifications');
        pollReplies(async (message) => {
            console.log(`\n📱 Reply received: ${message}`);
            if (this.adapter) {
                await this.adapter.injectFeedback(
                    `[RESPUESTA DESDE TELÉFONO]: ${message}`
                );
            }
            if (this.pendingPause) {
                this.resume();
                console.log('▶️  Project resumed by phone reply.');
            }
        });
    }

    async handlePhaseChoice(choice) {
        if (choice === '1') {
            const next = this.phases.next();
            if (next && this.adapter) {
                console.log(`\n▶️  Advancing to: ${next.display}`);
                await this.adapter.injectFeedback(
                    `[NUEVA FASE]: ${next.display}\n${next.prompt}`
                );
                if (this.pendingPause) this.pendingPause = null;
            }
        } else if (choice === '2') {
            this.phases.next();
            const skipped = this.phases.next();
            if (skipped && this.adapter) {
                console.log(`\n⏭️  Skipped to: ${skipped.display}`);
                await this.adapter.injectFeedback(
                    `[FASE SALTEADA - NUEVA FASE]: ${skipped.display}\n${skipped.prompt}`
                );
            }
        } else if (choice === '3') {
            console.log('\n⏸️  Project paused by user.');
            this.pendingPause = true;
        }
    }

    async dispatch(signal, content, adapter = null) {
        this.adapter = adapter;
        const config = getSignalConfig(signal);
        const ts = this.timestamp();

        // Always log
        this.appendLog(`\n---\n**[${ts}] ${signal}**\n${content}\n---\n`);

        // Desktop notification
        if (config.desktop) {
            sendDesktop(`Signal: ${signal}`, content.slice(0, 100));
        }

        // Handle each signal type
        switch (signal) {
            case '@@ESCALATE:CRITICAL':
                console.log('\n🔴 ESCALATE:CRITICAL — Project paused. Go to your PC.');
                await sendNtfy({
                    title: '🔴 CRITICAL — Requiere tu atención',
                    message: content.slice(0, 500),
                    priority: 'critical',
                    tags: ['stop_sign', 'rotating_light'],
                });
                this.pendingPause = true;
                break;

            case '@@ESCALATE:QUESTION':
                console.log('\n🟡 ESCALATE:QUESTION — Logged, continuing.');
                await sendNtfy({
                    title: 'Pregunta para Claude',
                    message: `${content.slice(0, 400)}\n\nResponde publicando en canal: ${NTFY_CHANNEL}-replies`,
                    priority: 'normal',
                    tags: ['question'],
                });
                break;

            case '@@CHECKPOINT:AUTO':
                await this.handleCheckpoint(content, true);
                break;

            case '@@CHECKPOINT:MANUAL':
                await this.handleCheckpoint(content, false);
                break;

            case '@@DOCUMENT':
                console.log(`\n📝 Documented at ${ts}`);
                break;

            case '@@CONFIRM':
                console.log('\n⚠️  CONFIRM required — Project paused.');
                await sendNtfy({
                    title: '⚠️  Confirmación requerida',
                    message: content.slice(0, 500),
                    priority: 'critical',
                    tags: ['warning'],
                });
                this.pendingPause = true;
                break;

            case '@@UNKNOWN:ANALYSIS':
                console.log(`\n❓ UNKNOWN:ANALYSIS logged`);
                break;

            case '@@UNKNOWN:ACTION':
                console.log('\n🔴 UNKNOWN:ACTION — Project paused immediately.');
                await sendNtfy({
                    title: '🔴 UNKNOWN ACTION — No se tomó ninguna acción',
                    message: content.slice(0, 500),
                    priority: 'critical',
                    tags: ['stop_sign'],
                });
                this.pendingPause = true;
                break;

            case '@@READY:NEXT_PHASE':
                await this.handleNextPhase(content);
                break;
        }

        return config.pause || this.pendingPause;
    }

    async handleCheckpoint(content, auto) {
        const ts = new Date().toTimeString().slice(0, 5).replace(':', '');
        const cpPath = path.join(
            path.dirname(this.logPath),
            `context-checkpoint-${ts}.md`
        );
        fs.writeFileSync(cpPath, `# Context Checkpoint — ${ts}\n\n${content}`, 'utf8');
        console.log(`\n📍 CHECKPOINT saved: ${cpPath}`);

        await sendNtfy({
            title: auto ? '📍 Checkpoint automático' : '📍 Checkpoint sugerido',
            message: `Guardado en ${cpPath}. ${auto ? 'Sesión nueva iniciada.' : '¿Abrís sesión nueva?'}`,
            priority: 'normal',
            tags: ['bookmark'],
        });

        if (auto) this.pendingPause = true;
    }

    async handleNextPhase(content) {
        const options = this.phases.getOptions();
        const actions = this.phases.buildNtfyActions(options);
        const optionsText = options.map(o => o.label).join('\n');

        console.log(`\n✅ PHASE COMPLETE — ${this.phases.summary()}`);
        console.log(`Options:\n${optionsText}`);

        await sendNtfy({
            title: '✅ Fase completada',
            message: `${this.phases.summary()}\n\n${optionsText}`,
            priority: 'normal',
            tags: ['white_check_mark'],
            actions,
        });

        this.pendingPause = true;
    }

    isPaused() {
        return this.pendingPause === true;
    }

    resume() {
        this.pendingPause = null;
    }

    prompt(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
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