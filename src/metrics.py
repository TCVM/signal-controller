"""
Degradation metrics tracker for LLM sessions.

Monitors signal frequency and patterns to detect
when a model's context is becoming unreliable.
"""

from collections import defaultdict
from datetime import datetime


class SessionMetrics:
    def __init__(self):
        self.signal_counts = defaultdict(int)
        self.signal_history = []  # (timestamp, signal)
        self.session_start = datetime.now()

        # Thresholds that trigger degradation warning
        self.degradation_thresholds = {
            "@@UNKNOWN": 3,   # 3 unknowns = likely degraded
            "@@ESCALATE": 5,  # 5 escalations = model struggling
            "total": 15,      # 15 signals total = long session
        }

    def record(self, signal: str):
        """Record a signal occurrence."""
        self.signal_counts[signal] += 1
        self.signal_history.append((datetime.now(), signal))

    def check_degradation(self) -> list[str]:
        """
        Check if degradation thresholds are exceeded.
        Returns list of warning messages, empty if healthy.
        """
        warnings = []

        for signal, threshold in self.degradation_thresholds.items():
            if signal == "total":
                total = sum(self.signal_counts.values())
                if total >= threshold:
                    warnings.append(
                        f"High signal volume: {total} total signals this session"
                    )
            elif self.signal_counts[signal] >= threshold:
                warnings.append(
                    f"Threshold exceeded: {signal} occurred "
                    f"{self.signal_counts[signal]} times"
                )

        return warnings

    def consecutive_unknowns(self) -> int:
        """Count consecutive @@UNKNOWN signals at end of history."""
        count = 0
        for _, signal in reversed(self.signal_history):
            if signal == "@@UNKNOWN":
                count += 1
            else:
                break
        return count

    def summary(self) -> str:
        """Return a human-readable session summary."""
        duration = datetime.now() - self.session_start
        minutes = int(duration.total_seconds() / 60)
        lines = [
            f"Session duration: {minutes} minutes",
            f"Total signals: {sum(self.signal_counts.values())}",
        ]
        for signal, count in self.signal_counts.items():
            lines.append(f"  {signal}: {count}")
        return '\n'.join(lines)