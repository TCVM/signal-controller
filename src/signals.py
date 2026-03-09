"""
Signal definitions and parser for the signal-controller system.

Signals are single-line tokens emitted by the LLM before its response.
The controller intercepts them and decides what action to take.
"""

# Signal definitions
SIGNALS = {
    "@@ESCALATE": {
        "description": "LLM cannot resolve this, needs a more capable model",
        "severity": "high",
    },
    "@@CHECKPOINT": {
        "description": "Context is degrading or session is long, save state",
        "severity": "high",
    },
    "@@DOCUMENT": {
        "description": "Important finding occurred, should be logged",
        "severity": "medium",
    },
    "@@CONFIRM": {
        "description": "LLM is about to do something irreversible, needs confirmation",
        "severity": "high",
    },
    "@@UNKNOWN": {
        "description": "LLM cannot determine answer with available information",
        "severity": "low",
    },
}

def parse_output(output: str) -> tuple[str | None, str]:
    """
    Parse LLM output and extract signal if present.
    
    Returns:
        (signal, content) where signal is None if no signal found
    """
    lines = output.strip().split('\n')
    signal = None
    content_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped in SIGNALS:
            signal = stripped
        else:
            content_lines.append(line)

    content = '\n'.join(content_lines).strip()
    return signal, content


def get_signal_info(signal: str) -> dict:
    """Return metadata about a signal."""
    return SIGNALS.get(signal, {})


def list_signals() -> list[str]:
    """Return all defined signal tokens."""
    return list(SIGNALS.keys())