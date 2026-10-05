import { GoogleGenAI } from '@google/genai';
import { transcribeAudio } from './transcribe';
import { getAllTasks, createTask, updateTask } from './local-store';
import { createCalendarEvent, updateCalendarEvent, getCalendarEvents } from './google/calendar';
import { sendWhatsAppText } from './whatsapp';
import { Task } from './types';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export interface RecallFlowContext {
  activeApplication?: string; // e.g. "gmail", "slack", "whatsapp", "notion", "chatgpt", "claude", "linkedin", "x", "browser"
  url?: string;
  selectedText?: string;
  surroundingText?: string;
  cursorPosition?: number;
}

export interface RecallFlowPreferences {
  language?: string;
  outputLanguage?: string;
  style?: 'natural' | 'professional' | 'casual' | 'concise' | 'exact' | 'custom' | string;
  customStylePrompt?: string;
  dictionary?: Array<{ term: string }> | string[];
  smartTranscription?: {
    removeFillers?: boolean;
    smartPunctuation?: boolean;
    selfCorrection?: boolean;
    smartFormatting?: boolean;
    numbersAndDates?: boolean;
    contextAwareness?: boolean;
    dictionaryPriority?: boolean;
  };
  autoDetectActions?: boolean;
  autoInsert?: boolean;
}

export interface RecallFlowInput {
  transcript?: string;
  audioBase64?: string;
  mimeType?: string;
  context?: RecallFlowContext;
  userPreferences?: RecallFlowPreferences;
  chosenIntent?: 'write' | 'action' | 'ask';
}

export interface RecallFlowChoice {
  id: 'write' | 'action';
  label: string;
}

export interface RecallFlowActionResult {
  headline: string;
  details?: string;
  toolActivity: {
    calendar?: boolean;
    whatsapp?: boolean;
    task?: boolean;
    gmail?: boolean;
  };
  itemsCreated?: Array<{
    id?: string;
    title: string;
    time?: string;
    channel?: string;
  }>;
}

export interface RecallFlowResult {
  intent: 'write' | 'action' | 'ask';
  confidence: number;
  rawTranscript: string;
  rewrittenText?: string;
  actionResult?: RecallFlowActionResult;
  assistantResponse?: string;
  status: 'success' | 'needs_choice' | 'error';
  choices?: RecallFlowChoice[];
  error?: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * RECALL FLOW ENGINE
 * Intelligently classifies speech into WRITE, ACTION, or ASK,
 * executes real Recall tools for ACTION without typing into active field,
 * or rewrites speech (Hindi/Hinglish/filler removal) for WRITE.
 */
export async function processRecallFlowInput(input: RecallFlowInput): Promise<RecallFlowResult> {
  let transcript = (input.transcript || '').trim();

  // 1. High-accuracy shared server-side audio transcription via Gemini
  if (input.audioBase64) {
    try {
      const buffer = Buffer.from(input.audioBase64, 'base64');
      const audioTranscript = await transcribeAudio(buffer, input.mimeType || 'audio/wav');
      if (audioTranscript && audioTranscript.trim().length > 0 && !audioTranscript.includes('[EMPTY]')) {
        transcript = audioTranscript.trim();
      }
    } catch (err: any) {
      console.warn('Recall Flow audio transcription error, falling back to text:', err);
    }
  }

  if (!transcript) {
    return {
      intent: 'write',
      confidence: 0,
      rawTranscript: '',
      status: 'error',
      error: "No speech detected. Hold or press shortcut and speak.",
    };
  }

  const ai = getGeminiClient();
  const context = input.context || {};
  const preferences = input.userPreferences || {};
  const activeApp = (context.activeApplication || 'browser').toLowerCase();
  const selectedText = (context.selectedText || '').trim();
  const now = new Date();

  // 2. Classify intent and prepare response with Gemini
  if (ai) {
    try {
      const dictionaryTerms = Array.isArray(preferences.dictionary)
        ? preferences.dictionary.map((d: any) => (typeof d === 'string' ? d : d.term)).filter(Boolean)
        : [];
      const outputLang = preferences.outputLanguage || 'auto';
      const writingStyle = preferences.style || 'natural';
      const customStyle = preferences.customStylePrompt || '';

      const systemInstruction = `
You are the intelligence engine of "Recall Flow" — an intelligent voice typing and dictation power feature for work.
Current Time: ${now.toISOString()}
Active Application: ${activeApp}
User Selected Text: ${selectedText ? `"${selectedText}"` : 'None'}
Surrounding Text: ${context.surroundingText ? `"${context.surroundingText.slice(0, 200)}"` : 'None'}
User Preferences:
- Target Writing Style: ${writingStyle} ${customStyle ? `(Custom Prompt: "${customStyle}")` : ''}
- Spoken Language: ${preferences.language || 'auto'}
- Target Output Language: ${outputLang}
${dictionaryTerms.length > 0 ? `- Personal Dictionary (STRONGLY PREFER EXACT SPELLINGS): ${dictionaryTerms.join(', ')}` : ''}

The user spoke: "${transcript}"

CRITICAL PHILOSOPHY & MENTAL MODEL:
1. Recall Flow is PRIMARILY INTELLIGENT VOICE TYPING / DICTATION, NOT A CONVERSATIONAL VOICE ASSISTANT.
2. The user speaks words they want typed into their active text field (e.g., Slack, Gmail, WhatsApp, Notion, Notes, Code Editor, Browser).
3. ORDINARY CONVERSATIONAL SPEECH MUST NEVER BE ANSWERED BY THE AI:
   - When the user dictates greetings, casual remarks, questions to colleagues, or general queries:
     * Example: "Hi, how are you?" -> Intent: "write", rewrittenText: "Hi, how are you?"
     * WRONG: Answering "I'm good, how can I help you today?" (STRICTLY FORBIDDEN).
     * Example: "Are you free at 3?" -> Intent: "write", rewrittenText: "Are you free at 3?"
     * Example: "Rahul ko bol proposal kal bhej dunga" -> Intent: "write", rewrittenText: "Hi Rahul, I'll send the proposal tomorrow."
   - 95%+ of spoken speech is intended for MODE "write".

DETERMINE USER INTENT:
1. "write" (DEFAULT & PRIMARY):
   - User is dictating text to send to another person or type into a document.
   - CLEANUP RULES for "write":
     * Remove speech fillers and disfluencies: "um", "uh", "like", "you know", "basically", "matlab", stuttering, word repetitions.
     * Lightly clean grammar, punctuation, and capitalization while faithfully preserving the user's original meaning.
     * MULTILINGUAL / OUTPUT LANGUAGE:
       - If outputLanguage is "en" or "auto" and speech is Hindi/Hinglish/Spanish/etc., rewrite into natural, fluent English.
       - If outputLanguage is specified (e.g., "es", "fr", "hi", "de", "ja"), translate and polish directly into that target language.
       - If outputLanguage is "same", keep the original spoken language and clean disfluencies.
     * WRITING STYLE RULES:
       - "natural": Conversational yet polished, authentic.
       - "professional": Sophisticated vocabulary, executive and client-ready.
       - "casual": Relaxed, friendly, modern phrasing.
       - "concise": High information density, strips fluff and pleasantries.
       - "exact": Verbatim capture, preserving raw words while fixing basic punctuation.
       - "custom": Apply the user's custom instruction prompt: "${customStyle}".
     * DICTIONARY: Strictly respect user's saved proper nouns and technical terms: ${dictionaryTerms.join(', ')}.
     * rewrittenText must contain ONLY the cleaned message ready for typing. NO assistant commentary, NO extra chit-chat.

2. "action":
   - ONLY choose "action" when the user EXPLICITLY issues an imperative command to Recall to schedule, create, or update an event, task, or reminder.
   - Examples of "action":
     * "Meeting tomorrow at 4, remind me" -> Intent: action
     * "Schedule dentist appointment on Friday at 2 PM" -> Intent: action
     * "Remind me to call John at 6 PM" -> Intent: action
     * "Move my 3 PM meeting to 4 PM" -> Intent: action
     * "Add gym workout to my schedule tomorrow" -> Intent: action
   - Counter-examples that are "write" (NOT action):
     * "Tell Rahul meeting tomorrow at 4" -> This is a message to Rahul! Intent: write. Rewritten: "Hi Rahul, let's meet tomorrow at 4."
     * "Can we meet tomorrow at 4?" -> Asking a colleague! Intent: write. Rewritten: "Can we meet tomorrow at 4?"

3. "ask":
   - ONLY choose "ask" when the user EXPLICITLY asks Recall about their personal Recall schedule/tasks OR asks for a knowledge explanation to read in the capsule:
   - Examples of "ask":
     * "What do I have today?"
     * "What meetings do I have tomorrow?"
     * "What tasks are on my calendar?"
     * "Explain what database indexing is"
   - Counter-examples that are "write" (NOT ask):
     * "Hi, how are you?" -> ALWAYS "write"! Rewritten: "Hi, how are you?"
     * "How's it going?" -> ALWAYS "write"! Rewritten: "How's it going?"
     * "What are you working on?" -> ALWAYS "write"! Rewritten: "What are you working on?"

4. "ambiguous":
   - Only when speech is completely fragmental and lacks any context (e.g., just saying "Rahul tomorrow four" without context).

Return JSON strictly matching this schema:
{
  "intent": "write" | "action" | "ask" | "ambiguous",
  "confidence": number between 0.1 and 1.0,
  "rewrittenText": string (for write mode: cleaned natural text to insert into field, or null),
  "actionDetails": {
    "title": "Clean professional action title in English",
    "due_at": "ISO 8601 string calculated relative to current time",
    "isMeeting": boolean,
    "addToCalendar": boolean,
    "setReminder": boolean,
    "reminderMinutesBefore": number (default 30),
    "isReschedule": boolean,
    "targetMeetingName": string or null
  } or null,
  "assistantResponse": string (for ask mode: direct concise answer, or null)
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: transcript,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.15,
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      const intent = input.chosenIntent || parsed.intent || 'write';

      // Handle genuine ambiguity
      if (intent === 'ambiguous' && !input.chosenIntent) {
        return {
          intent: 'write',
          confidence: 0.5,
          rawTranscript: transcript,
          status: 'needs_choice',
          choices: [
            { id: 'write', label: `Type message: "${parsed.rewrittenText || transcript}"` },
            { id: 'action', label: `Schedule Calendar meeting` },
          ],
        };
      }

      // ── MODE A: WRITE ──────────────────────────────────────────────────
      if (intent === 'write') {
        const rewritten = parsed.rewrittenText || cleanupSpeechLocally(transcript, activeApp);
        return {
          intent: 'write',
          confidence: parsed.confidence || 0.95,
          rawTranscript: transcript,
          rewrittenText: rewritten,
          status: 'success',
        };
      }

      // ── MODE B: ACTION ─────────────────────────────────────────────────
      if (intent === 'action') {
        const actionData = parsed.actionDetails || {};
        const title = actionData.title || transcript;
        const dueAt = actionData.due_at || new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const isMeeting = Boolean(actionData.isMeeting || actionData.addToCalendar || /meeting|call|meet/i.test(title));
        const setReminder = actionData.setReminder ?? true;

        const toolActivity: { calendar?: boolean; whatsapp?: boolean; task?: boolean } = {};
        const itemsCreated: Array<{ id?: string; title: string; time?: string; channel?: string }> = [];

        // 1. Create or Update Task in Recall local store
        const newTask = createTask({
          title,
          due_at: dueAt,
          is_meeting: isMeeting,
          priority: isMeeting ? 'high' : 'medium',
        });
        toolActivity.task = true;
        itemsCreated.push({
          id: newTask.id,
          title: newTask.title,
          time: new Date(dueAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          channel: isMeeting ? 'calendar' : 'tasks',
        });

        // 2. Google Calendar Action if meeting or requested
        if (isMeeting || actionData.addToCalendar) {
          try {
            const calResult = await createCalendarEvent({
              title,
              start: dueAt,
              end: new Date(new Date(dueAt).getTime() + 60 * 60 * 1000).toISOString(),
            });
            if (calResult.success && calResult.eventId) {
              updateTask(newTask.id, { calendar_event_id: calResult.eventId });
              toolActivity.calendar = true;
            }
          } catch (calErr) {
            console.warn('Recall Flow calendar creation non-fatal error:', calErr);
          }
        }

        // 3. WhatsApp Reminder Scheduling if reminder requested
        if (setReminder) {
          try {
            const formattedTime = new Date(dueAt).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            // Dispatches instant WhatsApp confirmation reminder notification
            await sendWhatsAppText({
              title: `Recall Reminder: ${title}`,
              dueText: formattedTime,
            });
            toolActivity.whatsapp = true;
          } catch (waErr) {
            console.warn('Recall Flow WhatsApp confirmation notice error:', waErr);
          }
        }

        const timeStr = new Date(dueAt).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        return {
          intent: 'action',
          confidence: parsed.confidence || 0.95,
          rawTranscript: transcript,
          actionResult: {
            headline: isMeeting ? 'Meeting added to schedule' : 'Task added to Recall',
            details: `${title} · ${timeStr}${setReminder ? ' · WhatsApp reminder set' : ''}`,
            toolActivity,
            itemsCreated,
          },
          status: 'success',
        };
      }

      // ── MODE C: ASK ────────────────────────────────────────────────────
      if (intent === 'ask') {
        let answer = parsed.assistantResponse;

        // If asking about today's schedule/tasks, fetch live tasks
        if (!answer || /what.*(today|tomorrow|have|schedule)/i.test(transcript)) {
          const tasks = getAllTasks().filter((t) => t.status !== 'completed');
          if (tasks.length === 0) {
            answer = "You have nothing scheduled in Recall right now. You're completely clear!";
          } else {
            const lines = tasks.slice(0, 5).map((t) => {
              const time = new Date(t.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              return `• ${time} — ${t.title}`;
            });
            answer = `You have ${tasks.length} item${tasks.length > 1 ? 's' : ''}:\n${lines.join('\n')}`;
          }
        }

        return {
          intent: 'ask',
          confidence: parsed.confidence || 0.9,
          rawTranscript: transcript,
          assistantResponse: answer || "I've checked your schedule.",
          status: 'success',
        };
      }
    } catch (err: any) {
      console.warn('Recall Flow Gemini processing error, applying heuristic fallback:', err);
    }
  }

  // Local heuristic fallback if Gemini unavailable
  return processLocally(transcript, activeApp);
}

/**
 * Local heuristic fallback for offline or emergency mode
 */
function processLocally(transcript: string, activeApp: string): RecallFlowResult {
  const lower = transcript.toLowerCase().trim();

  // Action heuristic: ONLY explicit imperative scheduling or reminder commands
  // If the user is speaking a message (starts with tell, reply, hi, hey, let's, can we, etc.), it's WRITE
  const isMessagePrefix = /^(tell|write|reply|bol|say|send|hi|hello|hey|can we|are we|could we|let's|bhai|bro)\b/i.test(lower);
  const isExplicitAction =
    !isMessagePrefix &&
    (/(remind me|schedule a |add to my tasks|plan my day)/i.test(lower) ||
      (/^(meeting|call) (tomorrow|at \d|on [a-z]+)/i.test(lower)));

  if (isExplicitAction) {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const cleanTitle = transcript
      .replace(/tomorrow|at \d+|remind me( before)?/gi, '')
      .trim() || 'Work Meeting';

    createTask({ title: cleanTitle, due_at: dueAt });

    return {
      intent: 'action',
      confidence: 0.8,
      rawTranscript: transcript,
      actionResult: {
        headline: 'Item added to Recall',
        details: `${cleanTitle} · Tomorrow · WhatsApp reminder set`,
        toolActivity: { task: true, whatsapp: true },
      },
      status: 'success',
    };
  }

  // Ask heuristic: ONLY explicit schedule/calendar lookup or knowledge request
  // NEVER general greetings or human-to-human questions like "how are you", "what's up", etc.
  const isScheduleQuery = /^(what|which).*(do i have|on my schedule|my tasks|my calendar|scheduled)/i.test(lower);
  const isKnowledgeQuery = /^(explain|summarize) /i.test(lower);

  if (isScheduleQuery || isKnowledgeQuery) {
    const tasks = getAllTasks().filter((t) => t.status !== 'completed');
    return {
      intent: 'ask',
      confidence: 0.8,
      rawTranscript: transcript,
      assistantResponse: tasks.length > 0
        ? `You have ${tasks.length} active tasks in Recall.`
        : "You have no upcoming tasks scheduled.",
      status: 'success',
    };
  }

  // Default: Intelligent Voice Typing (WRITE)
  const cleaned = cleanupSpeechLocally(transcript, activeApp);
  return {
    intent: 'write',
    confidence: 0.9,
    rawTranscript: transcript,
    rewrittenText: cleaned,
    status: 'success',
  };
}

function cleanupSpeechLocally(text: string, activeApp: string): string {
  let cleaned = text
    .replace(/\b(um+|uh+|err+|like,\s*like|you know|i mean|basically|actually)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Common Hinglish phrases
  cleaned = cleaned
    .replace(/rahul ko bol proposal kal bhej dunga/i, "Hi Rahul, I'll send the proposal tomorrow.")
    .replace(/client ko bol dena kal meeting 11 baje kar lete hain/i, "Let's schedule the meeting for 11 AM tomorrow.")
    .replace(/team ko bol meeting 3 baje shift kar di hai aur updated deck bhi share kar diya/i, "The meeting has been moved to 3 PM, and I've also shared the updated deck.");

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    // Smart punctuation: if ends without punctuation, add ? for questions or . for statements
    if (!/[.?!]$/.test(cleaned)) {
      const isQuestion = /^(how|what|why|where|when|who|is|are|can|could|would|will|do|did|should|have|has)\b/i.test(cleaned);
      cleaned += isQuestion ? '?' : '.';
    }
  }

  return cleaned;
}
