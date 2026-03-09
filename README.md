# signal-controller

External signal-based context management system for local LLM sessions.

## The Problem

Local LLMs running in long technical sessions gradually degrade — they lose
context, repeat themselves, and start guessing without flagging uncertainty.
The model itself is often the last to know.

## The Solution

A simple signal protocol: the LLM emits short tokens in its output when
specific conditions occur. An external controller intercepts these signals
and takes action independently of the model.

The logic lives outside the model. The model only needs to know the signals.

## Signals

| Signal         | Meaning                                     |
| -------------- | ------------------------------------------- |
| `@@ESCALATE`   | Needs a more capable model                  |
| `@@CHECKPOINT` | Context degrading, save state               |
| `@@DOCUMENT`   | Important finding, should be logged         |
| `@@CONFIRM`    | About to do something irreversible          |
| `@@UNKNOWN`    | Cannot determine with available information |

## Usage

```bash
# Set log path (optional, defaults to ./logs/session-active.md)
export SIGNAL_CONTROLLER_LOG=/path/to/your/project/logs/session-active.md

# Run controller
cd src
python controller.py

# Paste LLM output blocks — signals are intercepted automatically
```

## Minimal AGENTS.md / System Prompt

```markdown
## Signal Protocol

Emit signals on their own line before responding:

@@ESCALATE — needs a more capable model
@@CHECKPOINT — context is degrading or session is long
@@DOCUMENT — important finding just occurred  
@@CONFIRM — about to do something irreversible
@@UNKNOWN — cannot determine with available information
```

That's all the LLM needs to know. Keep your system prompt short.

## Integration

The controller is project-agnostic. Point `SIGNAL_CONTROLLER_LOG`
to any project's log directory and it works.

See `examples/` for integration with specific workflows.

## Origin

Built during reverse engineering of the Intel GMA500 Linux driver.
See: [gma500-reverse-engineering](https://github.com/TCVM/gma500-reverse-engineering)

## Status

Early prototype — being iterated on actively during real usage.
Contributions welcome.
