"""
Main controller for the signal-controller system.

Intercepts LLM output, parses signals, and dispatches
appropriate actions based on signal type and session metrics.
"""

import os
import sys
import datetime
from signals import parse_output, get_signal_info
from metrics import SessionMetrics

# Default log path — override with LOG_PATH env variable
LOG_PATH = os.environ.get(
    "SIGNAL_CONTROLLER_LOG",
    os.path.join(os.getcwd(), "logs", "session-active.md")
)


class Controller:
    def __init__(self, log_path: str = LOG_PATH):
        self.log_path = log_path
        self.metrics = SessionMetrics()
        os.makedirs(os.path.dirname(log_path), exist_ok=True)

    def append_log(self, content: str):
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(content + "\n")

    def handle_escalate(self, content: str):
        timestamp = datetime.datetime.now().strftime("%H:%M")
        self.append_log(
            f"\n---\n**[{timestamp}] @@ESCALATE**\n{content}\n---\n"
        )
        print("\n⚠️  ESCALATE — Take this to a more capable model:")
        print(f"\n{content}\n")

    def handle_checkpoint(self, content: str):
        timestamp = datetime.datetime.now().strftime("%H%M")
        checkpoint_dir = os.path.dirname(self.log_path)
        checkpoint_path = os.path.join(
            checkpoint_dir, f"context-checkpoint-{timestamp}.md"
        )
        with open(checkpoint_path, "w", encoding="utf-8") as f:
            f.write(f"# Context Checkpoint — {timestamp}\n\n")
            f.write(self.metrics.summary() + "\n\n")
            f.write(content)
        print(f"\n📍 CHECKPOINT saved: {checkpoint_path}")
        print("Start a new session and load this file to continue.")

    def handle_document(self, content: str):
        timestamp = datetime.datetime.now().strftime("%H:%M")
        self.append_log(
            f"\n---\n**[{timestamp}] @@DOCUMENT**\n{content}\n---\n"
        )
        print(f"\n📝 Logged to {self.log_path}")

    def handle_confirm(self, content: str) -> bool:
        print(f"\n⚠️  CONFIRM required:")
        print(content)
        response = input("Confirm? (y/n): ")
        return response.lower() == 'y'

    def handle_unknown(self, content: str):
        timestamp = datetime.datetime.now().strftime("%H:%M")
        self.append_log(
            f"\n---\n**[{timestamp}] @@UNKNOWN**\n{content}\n---\n"
        )
        consecutive = self.metrics.consecutive_unknowns()
        if consecutive >= 3:
            print(
                f"\n🔴 DEGRADATION WARNING: {consecutive} consecutive unknowns. "
                f"Consider a checkpoint and new session."
            )
        else:
            print(f"\n❓ UNKNOWN logged ({consecutive} consecutive)")

    def process(self, output: str):
        """Main entry point — process a block of LLM output."""
        signal, content = parse_output(output)

        if signal:
            self.metrics.record(signal)

            # Check degradation after recording
            warnings = self.metrics.check_degradation()
            for w in warnings:
                print(f"\n🟡 WARNING: {w}")

            # Dispatch to handler
            if signal == "@@ESCALATE":
                self.handle_escalate(content)
            elif signal == "@@CHECKPOINT":
                self.handle_checkpoint(content)
            elif signal == "@@DOCUMENT":
                self.handle_document(content)
            elif signal == "@@CONFIRM":
                self.handle_confirm(content)
            elif signal == "@@UNKNOWN":
                self.handle_unknown(content)
        else:
            # No signal — just print content normally
            print(content)

    def run_interactive(self):
        """Run in interactive mode — paste LLM output blocks."""
        print("🟢 signal-controller active")
        print(f"📁 Logging to: {self.log_path}")
        print("Paste LLM output (Ctrl+Z to process each block, Ctrl+C to exit)\n")

        while True:
            try:
                output = sys.stdin.read()
                if output.strip():
                    self.process(output)
                    print("\n--- Paste next block ---\n")
            except EOFError:
                continue
            except KeyboardInterrupt:
                print(f"\n\n{self.metrics.summary()}")
                print("\n🔴 Controller stopped.")
                break


if __name__ == "__main__":
    log_path = sys.argv[1] if len(sys.argv) > 1 else LOG_PATH
    controller = Controller(log_path=log_path)
    controller.run_interactive()