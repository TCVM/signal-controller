/**
 * Phase queue manager for signal-controller.
 * Reads phases from external config file — project agnostic.
 */

const fs = require('fs');
const path = require('path');

const PHASES_FILE = process.env.SIGNAL_CONTROLLER_PHASES || 
    path.join(process.cwd(), 'config', 'phases.json');

class PhaseManager {
    constructor() {
        this.phases = [];
        this.currentIndex = 0;
        this.loaded = false;
    }

    load() {
        if (!fs.existsSync(PHASES_FILE)) {
            console.log(`⚠️  No phases file found at ${PHASES_FILE}`);
            console.log('Running without phase management.');
            return false;
        }

        const data = JSON.parse(fs.readFileSync(PHASES_FILE, 'utf8'));
        this.phases = data.phases || [];
        this.currentIndex = data.current_phase || 0;
        this.loaded = true;
        console.log(`📋 Loaded ${this.phases.length} phases from ${PHASES_FILE}`);
        return true;
    }

    current() {
        return this.phases[this.currentIndex] || null;
    }

    next() {
        if (this.currentIndex < this.phases.length - 1) {
            this.currentIndex++;
            this.save();
            return this.current();
        }
        return null;
    }

    jumpTo(index) {
        if (index >= 0 && index < this.phases.length) {
            this.currentIndex = index;
            this.save();
            return this.current();
        }
        return null;
    }

    getOptions() {
        // Returns next 3 options for Ntfy notification
        const options = [];
        const next = this.phases[this.currentIndex + 1];
        if (next) options.push({ label: `1 → ${next.display}`, value: '1' });
        
        const skip = this.phases[this.currentIndex + 2];
        if (skip) options.push({ label: `2 → ${skip.display} (saltar)`, value: '2' });
        
        options.push({ label: '3 → pause', value: '3' });
        return options;
    }

    buildNtfyActions(options) {
        return options.map(opt => ({
            action: 'http',
            label: opt.label,
            url: `${process.env.SIGNAL_CONTROLLER_CALLBACK_URL || 'http://localhost:3737'}/phase`,
            method: 'POST',
            body: JSON.stringify({ choice: opt.value }),
        }));
    }

    save() {
        if (!fs.existsSync(PHASES_FILE)) return;
        const data = JSON.parse(fs.readFileSync(PHASES_FILE, 'utf8'));
        data.current_phase = this.currentIndex;
        fs.writeFileSync(PHASES_FILE, JSON.stringify(data, null, 2), 'utf8');
    }

    summary() {
        const current = this.current();
        if (!current) return 'No active phase';
        return `Phase ${this.currentIndex + 1}/${this.phases.length}: ${current.display}`;
    }
}

module.exports = { PhaseManager };