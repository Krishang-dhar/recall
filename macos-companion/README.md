# Recall Flow — Native macOS Companion

Lightweight, native macOS companion app that gives Recall Flow true system-wide power across **100% of Mac applications** (Slack desktop, Notes, VS Code, Cursor, Telegram, Terminal, Word, etc.).

---

### Features

1. **System-Wide Global Shortcut (`Option + Space` / `⌥ + Space`)**:
   - Registered via the native Carbon Event Manager (`RegisterEventHotKey`).
   - Wakes up anywhere in macOS instantly without needing to focus a browser window.

2. **Zero Spoken Voice / TTS**:
   - Recall Flow is completely silent.
   - It only listens, transcribes, cleans/rewrites, types, or executes actions. Never speaks aloud.

3. **Automatic Silence Detection (VAD)**:
   - Starts listening immediately upon activation.
   - Automatically detects when you stop speaking (1.3s of pause), finalizes your speech, and pastes/executes automatically.
   - Also supports **Enter** or clicking the orb to finalize immediately, or **Escape** to cancel.

4. **Apple Glass Floating HUD**:
   - Compact 340px translucent glass pill with Apple material blur (`NSVisualEffectView`).
   - Reuses the authentic Recall orb with breathing and spinning animation.
   - Fully draggable anywhere on your screen (`isMovableByWindowBackground = true`).

5. **Universal Typing**:
   - Directly inserts into the frontmost Mac application using native macOS clipboard paste (`Cmd + V`).
   - Works in Notes, Slack desktop, VS Code, Notion desktop, Chrome, Safari, TextEdit, etc.

6. **Actions & Reminders**:
   - Automatically detects calendar meetings, tasks, and WhatsApp reminders.
   - Dispatches through the local Recall backend (`http://localhost:3001/api/ai/flow`).

---

### How to Run

From the project root:

```bash
npm run companion
```

Or directly:

```bash
bash macos-companion/run.sh
```

To stop: Press `Ctrl + C` in your terminal.
