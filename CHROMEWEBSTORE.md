# Chrome Web Store Listing: Recall Flow — Voice for Web

> **Last Updated:** 2026-10-04  
> **Extension Version:** 1.0.0  
> **Manifest Version:** 3

---

## 1. Store Metadata

### Extension Name
`Recall Flow — Voice for Web`

### Short Description (max 132 chars)
`Speak anywhere in your browser. Recall intelligently writes clean text for you or executes actions in your schedule.`

### Detailed Description
```markdown
Recall Flow gives you intelligent voice input wherever you work in your browser.

Instead of manually typing, activate Recall Flow with Option+Space (or Alt+Space), speak naturally, and let Recall intelligently determine whether you want to write text, take action, or ask a question.

KEY FEATURES

1. Speak Instead of Typing
Dictate naturally in Gmail, Slack, WhatsApp Web, Notion, ChatGPT, Claude, and any web form. Recall removes filler words ("um", "like", "you know"), corrects accidental restarts, and outputs polished text.

2. Hindi & Hinglish to Clean English
Speak in Hindi or Hinglish (e.g. "Rahul ko bol proposal kal bhej dunga") and Recall automatically rewrites it into natural, professional English ("Hi Rahul, I'll send the proposal tomorrow.") instead of crude literal transliteration.

3. Rephrase Selected Text
Highlight any rough draft or bullet points on any webpage and say "Make this professional" or "Make this concise" to rewrite it in place.

4. Voice Actions Without Typing
Say "Tomorrow at 4 I have a meeting with Rahul. Remind me before." Recall creates the event on Google Calendar, schedules your WhatsApp reminder, and updates your Recall schedule without dumping action commands into your active text box.

5. Privacy First
Your microphone is ONLY active while you are speaking. It immediately disconnects when dictation finishes. No continuous background recording.
```

---

## 2. Permissions Justification

| Permission | Technical Reason for Use | User-Facing Benefit |
|---|---|---|
| `activeTab` | Detects the active text input (`input`, `textarea`, `contenteditable`) when the user triggers the shortcut. | Inserts transcribed and rewritten text directly at your cursor. |
| `storage` | Stores extension configuration (Recall backend endpoint, shortcut preference). | Remembers your local preferences across browser sessions. |

### Host Permissions
| Host | Justification |
|---|---|
| `http://localhost:3001/*` | Communicates with the local Recall intelligence server (`/api/ai/flow`) to process natural language intent, Google Calendar events, and WhatsApp reminders. |

---

## 3. Privacy & Data Use Disclosure

- **Single Purpose:** Provide intelligent voice dictation and scheduling actions in browser text fields.
- **Data Collection:**
  - Audio/Voice: Transmitted transiently to the Recall API only during active dictation. Never stored permanently.
  - Text: Active field text surrounding cursor is analyzed only when dictation is triggered to adapt tone. Never sold or shared.
- **Third-party sharing:** None. Communicates only with your configured Recall server.

---

## 4. Version History

- **v1.0.0** (2026-10-04): Initial release of Recall Flow with generic active-field detection, Hinglish cleanup, and Google Calendar / WhatsApp action routing.
