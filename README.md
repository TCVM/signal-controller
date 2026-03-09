# signal-controller

External signal-based context management system for local LLM sessions.

## The Core Idea: Thinking vs Feeling

There is a fundamental difference between a model **thinking** about its
own state and **feeling** it as external input.

When a model introspects — "am I degrading? have I lost context?" — it uses
the same cognitive capacity it needs for the actual problem. Worse, a degraded
model is the least capable of detecting its own degradation. It's asking
the patient to diagnose themselves.

signal-controller separates these responsibilities entirely:

- **Qwen thinks** about the technical problem
- **The controller observes** the output stream externally
- **The controller measures** session metrics independently
- **The controller injects** state back as input

Qwen doesn't calculate its state — it receives it, the same way a nervous
system receives a signal rather than reasoning about heart rate.
The cognitive load stays where it belongs: on the problem.

---

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                  SIGNAL CONTROLLER                   │
│                                                      │
│  Observes → Measures → Decides → Injects            │
│                                                      │
│  No degradation. No context cost. Always running.   │
└──────────┬──────────────────────────────┬───────────┘
           │ reads via SSE                │ injects via
           │ (real-time stream)           │ tui.appendPrompt()
     ┌─────▼──────┐                 ┌────▼────────┐
     │  OpenCode  │                 │   OpenCode  │
     │  output    │                 │   session   │
     └─────┬──────┘                 └─────────────┘
           │
     ┌─────▼──────┐
     │    Qwen    │◄──── feels state, not calculates it
     └────────────┘
```

The loop is complete. Qwen emits a signal, the controller intercepts it,
acts on it, and feeds the result back. Qwen receives its own state as
external input — freeing it to focus entirely on the task.

---

## Signals

The LLM only needs to know five tokens:

| Signal         | Meaning                                     |
| -------------- | ------------------------------------------- |
| `@@ESCALATE`   | Needs a more capable model                  |
| `@@CHECKPOINT` | Context degrading, save state               |
| `@@DOCUMENT`   | Important finding, should be logged         |
| `@@CONFIRM`    | About to do something irreversible          |
| `@@UNKNOWN`    | Cannot determine with available information |

Emit them on their own line before responding. That's the entire protocol.

---

## Minimal System Prompt

```markdown
## Signal Protocol

Emit signals on their own line before responding:

@@ESCALATE — needs a more capable model
@@CHECKPOINT — context is degrading or session is long
@@DOCUMENT — important finding just occurred
@@CONFIRM — about to do something irreversible
@@UNKNOWN — cannot determine with available information
```

Keep your system prompt short. The logic lives in the controller, not the model.

---

## Usage

**Terminal 1 — your LLM session:**

```bash
opencode
```

**Terminal 2 — signal controller:**

```bash
# Point to your project's log directory
export SIGNAL_CONTROLLER_LOG=/path/to/project/logs/session-active.md

# Real-time OpenCode integration
npm run opencode

# Or manual paste mode (any LLM)
npm start
```

---

## Adapters

- `adapters/opencode.js` — Real-time bidirectional integration via OpenCode SDK
- `adapters/generic.js` — Manual paste mode for any LLM without API access

---

## Degradation Detection

The controller tracks signal frequency independently of the model.
When thresholds are exceeded, it injects a warning directly into
the active session — Qwen receives it as context, not as a question
it has to answer.

Current thresholds (configurable):

- 3 consecutive `@@UNKNOWN` → degradation warning
- 5 `@@ESCALATE` in a session → model struggling
- 15 total signals → long session, consider checkpoint

---

## Origin

Built during reverse engineering of the Intel GMA500 Linux driver.
The need was real: long technical sessions with a local model,
no budget for expensive APIs, and a recurring problem of context loss
at critical moments.

See: [gma500-reverse-engineering](https://github.com/TCVM/gma500-reverse-engineering)

---

## Project Integration

### Automatic startup

Create a `start.bat` (Windows) or `start.sh` (Linux) in your project root:

**Windows:**

```batch
@echo off
echo Starting session...

set SIGNAL_CONTROLLER_LOG=%~dp0logs\session-active.md
start "Signal Controller" cmd /k "cd /path/to/signal-controller && node src/index.js --opencode"

timeout /t 2 /nobreak >nul
opencode
```

**Linux/Mac:**

```bash
#!/bin/bash
export SIGNAL_CONTROLLER_LOG="$(pwd)/logs/session-active.md"
node /path/to/signal-controller/src/index.js --opencode &
CONTROLLER_PID=$!
opencode
kill $CONTROLLER_PID
```

The controller starts automatically alongside OpenCode.
Each project gets its own log directory via `SIGNAL_CONTROLLER_LOG`.

---

### Session continuity

When `@@CHECKPOINT` is triggered, the controller saves a checkpoint to:

```
logs/context-checkpoint-HHMM.md
```

This file contains everything needed to resume work in a new session.

To continue after a checkpoint:

1. Close the current OpenCode session
2. Run `start.bat` or `start.sh` again
3. Tell the new session: `read logs/context-checkpoint-HHMM.md and continue from there`

The controller tags all log entries with timestamps so every finding
is traceable to its session regardless of how many checkpoints occurred.

---

### Recommended AGENTS.md structure

The system prompt should be as short as possible.
Logic belongs in the controller, not the model.

```markdown
# [Project Name] Agent

## Context

[One paragraph describing the project and current state.]
Read `docs/00-project-overview.md` at session start.
Read `logs/session-active.md` if it exists and summarize pending items.
Ask the user the session objective before starting.

## Signal Protocol

Emit signals on their own line before responding:

@@ESCALATE — needs a more capable model
@@CHECKPOINT — context is degrading or session is long
@@DOCUMENT — important finding just occurred
@@CONFIRM — about to do something irreversible
@@UNKNOWN — cannot determine with available information

After emitting a signal, explain in plain language:

- What triggered it
- What the user should do next

## Confidence Tags

Always tag claims: [CONFIRMED] [INFERRED] [SPECULATIVE] [UNKNOWN]

## Key Files

[List of the most important files the agent needs to know about]
```

**What belongs in AGENTS.md:** context, signals, confidence tags, key files.
**What does NOT belong:** action logic, logging rules, checkpoint format,
degradation thresholds. Those live in the controller.

---

## Status

Early prototype — being iterated on during real usage.
The protocol is intentionally minimal so it can evolve with the project.
Contributions welcome.
