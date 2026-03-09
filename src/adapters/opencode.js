/**
 * OpenCode adapter for signal-controller.
 * 
 * Connects to a running OpenCode server via its SDK,
 * streams output in real time, detects signals,
 * and injects feedback back into the active session.
 */

const { parseOutput } = require('../signals');
const { SessionMetrics } = require('../metrics');

// OpenCode server default port
const OPENCODE_URL = process.env.OPENCODE_URL || 'http://localhost:4096';

class OpenCodeAdapter {
    constructor(controller) {
        this.controller = controller;
        this.metrics = new SessionMetrics();
        this.sessionId = null;
        this.client = null;
    }

    async connect() {
        // Dynamically import ESM SDK
        const { createOpencodeClient } = await import('@opencode-ai/sdk');
        this.client = createOpencodeClient({
            baseUrl: OPENCODE_URL,
            directory: process.cwd(),
        });
        console.log(`🔌 Connected to OpenCode at ${OPENCODE_URL}`);
    }

    async getActiveSession() {
        const sessions = await this.client.session.list();
        if (!sessions || sessions.length === 0) {
            throw new Error('No active OpenCode session found. Start OpenCode first.');
        }
        // Use most recent session
        this.sessionId = sessions[sessions.length - 1].id;
        console.log(`📎 Attached to session: ${this.sessionId}`);
        return this.sessionId;
    }

    async injectFeedback(message) {
        if (!this.client) return;
        try {
            await this.client.tui.appendPrompt({
                body: { text: `\n[SIGNAL CONTROLLER]: ${message}` }
            });
        } catch (e) {
            // TUI might not be active, silently ignore
        }
    }

    async streamAndMonitor() {
        await this.connect();
        await this.getActiveSession();

        console.log('👁️  Monitoring OpenCode output in real time...\n');

        const events = await this.client.event.subscribe();

        for await (const event of events.stream) {
            // Only process assistant message events
            if (event.type !== 'message.part' && event.type !== 'message.completed') {
                continue;
            }

            const text = event?.properties?.content?.text || 
                         event?.properties?.part?.text || '';

            if (!text) continue;

            const { signal, content } = parseOutput(text);

            if (signal) {
                this.metrics.record(signal);
                await this.controller.dispatch(signal, content, this);

                // Check degradation and inject feedback to Qwen
                const warnings = this.metrics.checkDegradation();
                for (const warning of warnings) {
                    console.log(`\n🟡 ${warning}`);
                    await this.injectFeedback(
                        `Context warning: ${warning}. Consider emitting @@CHECKPOINT.`
                    );
                }

                // Inject state feedback after every signal
                await this.injectFeedback(
                    `Signal received: ${signal}. ` +
                    `Session stats: ${this.metrics.summary(compact=true)}`
                );
            }
        }
    }
}

module.exports = { OpenCodeAdapter };