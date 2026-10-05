#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ ! -d "Recall Flow.app" ]; then
  bash "$DIR/build.sh"
fi

# Stop any previously running instance
pkill -f "recall-flow-mac" 2>/dev/null || true

echo "========================================================"
echo "✨ Recall Flow — Native macOS Companion Active"
echo "========================================================"
echo "• Shortcut: Option + Space (⌥ + Space)"
echo "• Works in: Notes, Slack, VS Code, Cursor, Telegram, etc."
echo "• Backend:  http://localhost:3001 (Running)"
echo "--------------------------------------------------------"
echo "Try it now:"
echo "1. Switch to Apple Notes, Slack, or any text editor."
echo "2. Press Option + Space."
echo "3. Say: 'Tell Rahul I will send the pitch deck tomorrow morning.'"
echo "4. Press Enter or pause for silence."
echo "5. Watch it clean & type directly into your active window!"
echo "========================================================"
echo "Press Ctrl+C to stop companion."

# Launch the app bundle
open -n "$DIR/Recall Flow.app"

# Keep the script active in terminal so user can monitor and stop with Ctrl+C
trap 'echo "\nStopping Recall Flow companion..."; pkill -f "recall-flow-mac" 2>/dev/null; exit 0' SIGINT SIGTERM

while pgrep -f "recall-flow-mac" > /dev/null; do
  sleep 1
done
