import { GoogleGenAI } from '@google/genai';
import { GeminiParsedTask, TaskPriority } from './types';

const GEMINI_PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export async function parseNaturalLanguageTask(
  prompt: string,
  userReferenceTimeISO?: string,
  userTimeZone: string = 'Asia/Kolkata'
): Promise<GeminiParsedTask> {
  const apiKey = process.env.GEMINI_API_KEY;
  const now = userReferenceTimeISO ? new Date(userReferenceTimeISO) : new Date();

  // If Gemini API Key is present, call Gemini Flash
  if (apiKey && !apiKey.includes('placeholder')) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `
You are the intelligent parsing & action engine for "Recall" — an intelligent Apple-style minimal work assistant.
Current Reference Time: ${now.toISOString()}
Working Timezone: ${userTimeZone}

The user provides natural language requests in English, Hindi, or Hinglish:
Examples:
- "कल 4 बजे Prem Sweets को call करना है" -> Title: "Call Prem Sweets", Time: Tomorrow 16:00
- "Kal 4 baje Novelle ko quotation send karna hai" -> Title: "Send Novelle quotation", Time: Tomorrow 16:00
- "कल सुबह 11 बजे Novelle quotation भेजनी है" -> Title: "Send Novelle quotation", Time: Tomorrow 11:00
- "Meet Nishakar tomorrow at 2 PM and add it to my calendar" -> Title: "Meeting with Nishakar", Time: Tomorrow 14:00, addToCalendar: true
- "Prem Sweets, Gandhi Nagar me 3 baje milna hai" -> Title: "Meeting with Prem Sweets", Location: "Prem Sweets, Gandhi Nagar", Time: Today/Tomorrow 15:00

MANDATORY TASK TITLE RULE:
- Never copy the user's raw Hindi or Hinglish wording into the title.
- Understand the intent and rewrite it as a concise, professional English action phrase.
- Begin with a clear English action verb and preserve proper nouns.
- "proposal banana" -> "Prepare the proposal"
- "bill banana" -> "Prepare the invoice"
- "Novelle ka proposal finish karna" -> "Finish the Novelle proposal"
- "Rahul ko call karna" -> "Call Rahul"
- The conversational note may follow the user's language, but the title must always be professional English.

Detect if the user is asking to:
1. Create a reminder (default)
2. Add to Google Calendar (keywords: "add to calendar", "put on calendar", "schedule calendar", "calendar event", "meeting", "milna hai")
3. Mention a location / places (extract into "location")
4. Inspect or follow up on emails (keywords: "check my email", "emails I haven't replied to", "did I forget any emails", "email follow up")

Extract into raw JSON conforming strictly to:
{
  "title": "Clean professional English action title (e.g. 'Meeting with Prem Sweets' or 'Call Rahul')",
  "due_at": "ISO 8601 string calculated relative to the reference time and timezone",
  "note": "Optional extra details or null",
  "priority": "urgent" | "high" | "medium" | "low",
  "location": "Optional place name / address or null",
  "formatted_time_label": "e.g. 'Tomorrow · 3:00 PM'",
  "actions": {
    "createReminder": true,
    "addToCalendar": boolean,
    "hasLocation": boolean,
    "checkEmails": boolean,
    "findFollowUps": boolean,
    "searchQuery": string or null
  }
}
Return raw JSON only without markdown markers.
`;

      const response = await ai.models.generateContent({
        model: GEMINI_PRIMARY_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);

      if (parsed.title || parsed.actions?.findFollowUps || parsed.actions?.checkEmails) {
        return {
          title: professionalizeFallbackTitle(prompt, parsed.title || 'Work Reminder'),
          due_at: parsed.due_at || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          note: parsed.note || null,
          priority: (parsed.priority as TaskPriority) || 'medium',
          location: parsed.location || null,
          formatted_time_label:
            parsed.formatted_time_label ||
            formatTimeLabel(new Date(parsed.due_at || Date.now() + 60 * 60 * 1000), now),
          actions: {
            createReminder: parsed.actions?.createReminder ?? true,
            addToCalendar: Boolean(parsed.actions?.addToCalendar),
            hasLocation: Boolean(parsed.location),
            checkEmails: Boolean(parsed.actions?.checkEmails),
            findFollowUps: Boolean(parsed.actions?.findFollowUps),
            searchQuery: parsed.actions?.searchQuery || null,
          },
        };
      }
    } catch (err) {
      console.warn('Gemini action parsing error, falling back to heuristic parser:', err);
    }
  }

  // Local fallback parser with action detection
  return parseLocallyWithHeuristics(prompt, now);
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskRecallOptions {
  message: string;
  history?: ChatMessage[];
  tasksContext?: any[];
  userTimeZone?: string;
}

export interface AskRecallResult {
  reply: string;
  action?: {
    type: 'create_reminder' | 'update_reminder' | 'complete_reminder' | 'snooze_reminder';
    data?: any;
  };
}

export async function askRecall(options: AskRecallOptions): Promise<AskRecallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const timeZone = options.userTimeZone || 'Asia/Kolkata';
  const now = new Date();

  const tasksListStr = (options.tasksContext || [])
    .map(
      (t) =>
        `- [${t.status === 'completed' ? 'x' : ' '}] ID:${t.id} "${t.title}" due at ${t.due_at}${
          t.note ? ` (Note: ${t.note})` : ''
        }`
    )
    .join('\n');

  if (apiKey && !apiKey.includes('placeholder')) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `
You are "Recall" — an intelligent, personal AI work assistant.
You speak calmly, concisely, and helpfully. Do not be overly verbose.
Working Timezone: ${timeZone}
Current Time: ${now.toLocaleString('en-US', { timeZone })} (${now.toISOString()})

Current tasks in user's Recall system:
${tasksListStr || '(No tasks currently)'}

The user can ask questions like:
- "What do I have today?"
- "What am I forgetting?"
- "Move my Prem Sweets call to 4"
- "Mark Novelle quotation done"
- "Remind me tonight to call Rahul"

If the user is asking to CREATE, UPDATE, COMPLETE, or SNOOZE a task, you MUST format your response as JSON:
{
  "reply": "Your brief, natural conversational answer to the user.",
  "action": {
    "type": "create_reminder" | "update_reminder" | "complete_reminder" | "snooze_reminder",
    "data": {
      "id": "task id if updating/completing/snoozing",
      "title": "Clean professional English action title; translate and rewrite Hindi/Hinglish intent instead of copying it",
      "due_at": "ISO string",
      "note": "Optional note"
    }
  }
}

If no task modification action is requested (e.g. user simply asked "What do I have today?"), provide:
{
  "reply": "You have 3 things today:\\n11:00 AM — Send Novelle quotation\\n2:30 PM — Call Prem Sweets\\n5:00 PM — Review packaging samples.",
  "action": null
}

Strictly return valid JSON only.
`;

      const contents = [
        ...(options.history || []).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user',
          parts: [{ text: options.message }],
        },
      ];

      const response = await ai.models.generateContent({
        model: GEMINI_PRIMARY_MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);

      return {
        reply: parsed.reply || "I've checked your schedule.",
        action: parsed.action || undefined,
      };
    } catch (err: any) {
      console.warn('Gemini chat error, falling back to local chat handler:', err);
    }
  }

  // Graceful local heuristic chatbot fallback
  const msg = options.message.toLowerCase();
  const tasks = options.tasksContext || [];

  if (msg.includes('what') && (msg.includes('today') || msg.includes('schedule') || msg.includes('have'))) {
    const todayTasks = tasks.filter((t: any) => t.status !== 'completed');
    if (todayTasks.length === 0) {
      return { reply: "You're all clear today! No pending reminders waiting." };
    }
    const lines = todayTasks.map((t: any) => {
      const timeStr = new Date(t.due_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `• ${timeStr} — ${t.title}`;
    });
    return {
      reply: `You have ${todayTasks.length} reminder${todayTasks.length > 1 ? 's' : ''} today:\n${lines.join('\n')}`,
    };
  }

  return {
    reply: `I understand. You said: "${options.message}". How can I help organize this?`,
  };
}

function professionalizeFallbackTitle(rawPrompt: string, parsedTitle: string): string {
  const raw = rawPrompt.trim();
  const lower = raw.toLowerCase();
  const properName = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  const namedProposal = raw.match(/(?:finish\s+)?([A-Za-z][A-Za-z0-9&.-]*(?:\s+[A-Za-z][A-Za-z0-9&.-]*)?)\s+(?:ka|ki)\s+proposal/i);
  if (namedProposal) {
    const verb = /finish|complete|khatam|poora/.test(lower) ? 'Finish' : 'Prepare';
    return `${verb} the ${properName(namedProposal[1])} proposal`;
  }
  if (/\bproposal\b/.test(lower) && /banana|banani|prepare|tayyar|finish|complete|khatam/.test(lower)) {
    return /finish|complete|khatam|poora/.test(lower)
      ? 'Finish the proposal'
      : 'Prepare the proposal';
  }
  if (/\b(bill|invoice)\b/.test(lower) && /banana|banani|prepare|tayyar|create/.test(lower)) {
    return 'Prepare the invoice';
  }
  if (/\breport\b/.test(lower) && /banana|banani|prepare|tayyar|finish|complete/.test(lower)) {
    return /finish|complete/.test(lower) ? 'Finish the report' : 'Prepare the report';
  }
  if (/\bpresentation\b/.test(lower) && /banana|banani|prepare|tayyar|finish/.test(lower)) {
    return 'Prepare the presentation';
  }

  return parsedTitle
    .replace(/\b(banana|banani|karna|karni|karo|hai|hoga|chahiye)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLocallyWithHeuristics(prompt: string, now: Date): GeminiParsedTask {
  let cleanText = prompt.trim();
  let priority: TaskPriority = 'medium';

  const isCheckEmails =
    /email|inbox|reply|replied|unreplied/i.test(cleanText) &&
    /check|show|find|forgot|missed|need/i.test(cleanText);

  const shouldAddToCalendar = /calendar|meeting|schedule\s+meeting/i.test(cleanText);

  if (/urgent|asap|critical|immediately|turant|zaroori/i.test(cleanText)) {
    priority = 'urgent';
    cleanText = cleanText.replace(/\b(urgent|asap|critical|immediately|turant|zaroori)\b/gi, '').trim();
  } else if (/important|high priority|khas/i.test(cleanText)) {
    priority = 'high';
  }

  // Location detection: e.g. "at their Gandhi Nagar store", "at Starbucks"
  let location: string | null = null;
  const locationMatch = cleanText.match(
    /\bat\s+(?:their\s+)?([A-Z][a-zA-Z0-9\s,]+(?:store|office|branch|cafe|road|nagar|chowk|delhi|mumbai|bangalore|jammu|bengaluru)?)\b/i
  );
  if (locationMatch && !/(?:am|pm|\d|tomorrow|tonight|today|kal|aaj)/i.test(locationMatch[1])) {
    location = locationMatch[1].trim();
  }

  const targetDate = new Date(now);
  let hasSetTime = false;

  // 1. Check relative minutes / hours: e.g. "in 5 minutes", "in 2 hours", "5 minute me", "5 min me"
  const relMinMatch = cleanText.match(/(?:in|after)\s+(\d+)\s*(?:mins?|minutes?)|(\d+)\s*(?:min|minute|mins)\s*(?:me|baad)/i);
  const relHourMatch = cleanText.match(/(?:in|after)\s+(\d+)\s*(?:hours?|hrs?)|(\d+)\s*(?:ghante|hour)\s*(?:me|baad)/i);

  if (relMinMatch) {
    const mins = parseInt(relMinMatch[1] || relMinMatch[2], 10);
    targetDate.setTime(targetDate.getTime() + mins * 60 * 1000);
    hasSetTime = true;
  } else if (relHourMatch) {
    const hrs = parseInt(relHourMatch[1] || relHourMatch[2], 10);
    targetDate.setTime(targetDate.getTime() + hrs * 60 * 60 * 1000);
    hasSetTime = true;
  } else {
    // 2. Check Hindi/Hinglish/English explicit time (e.g. "4 baje", "8 baje", "at 4 pm", "at 8")
    const bajeMatch = cleanText.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|बजे)/i);
    const timeMatch = cleanText.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);

    let hour = 10;
    let minute = 0;

    if (bajeMatch) {
      hour = parseInt(bajeMatch[1], 10);
      minute = bajeMatch[2] ? parseInt(bajeMatch[2], 10) : 0;
      // Default common working hours if <= 7 to PM (e.g. 4 baje -> 16:00, 8 baje -> 20:00 or morning)
      if (hour >= 1 && hour <= 6) {
        hour += 12; // 4 baje = 4:00 PM
      } else if (/shaam|raat|evening|night/i.test(cleanText) && hour < 12) {
        hour += 12;
      }
      hasSetTime = true;
    } else if (timeMatch && (timeMatch[3] || cleanText.includes(' at ') || /remind\s+me\s+at/i.test(cleanText))) {
      hour = parseInt(timeMatch[1], 10);
      minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridian = timeMatch[3]?.toLowerCase();

      if (meridian === 'pm' && hour < 12) hour += 12;
      if (meridian === 'am' && hour === 12) hour = 0;
      if (!meridian && hour >= 1 && hour <= 6) hour += 12;
      hasSetTime = true;
    }

    const isTomorrow = /tomorrow|kal|कल/i.test(cleanText);
    const isTonight = /tonight|aaj raat|आज रात/i.test(cleanText);
    const isToday = /today|aaj|आज/i.test(cleanText);

    if (isTomorrow) {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(hasSetTime ? hour : 10, minute, 0, 0);
    } else if (isTonight) {
      targetDate.setHours(20, 0, 0, 0);
    } else if (hasSetTime) {
      targetDate.setHours(hour, minute, 0, 0);
      // If time has already passed today and user didn't say today, move to tomorrow
      if (targetDate.getTime() <= now.getTime() && !isToday) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    } else {
      targetDate.setTime(targetDate.getTime() + 60 * 60 * 1000);
    }
  }

  let title = cleanText;

  // Specific Indian / Hinglish call patterns: e.g. "Prem Sweets ko call karna hai" -> "Call Prem Sweets"
  const hinglishCallMatch = cleanText.match(/(?:call\s+karna\s+hai\s+to\s+|ko\s+call\s+karna\s+hai|ko\s+call\s+karo)/i);
  if (/Prem Sweets/i.test(cleanText) && /call/i.test(cleanText)) {
    title = 'Call Prem Sweets';
  } else if (/call\s+([a-zA-Z]+)/i.test(cleanText)) {
    const personMatch = cleanText.match(/call\s+([a-zA-Z]+)/i);
    title = `Call ${personMatch![1]}`;
  } else if (hinglishCallMatch) {
    const beforeKo = cleanText.split(/ko\s+call/i)[0];
    const subject = beforeKo.replace(/\b(kal|aaj|tomorrow|today|\d{1,2}(?::\d{2})?\s*(?:baje|am|pm)?)\b/gi, '').trim();
    title = `Call ${subject || 'contact'}`;
  } else if (/quotation/i.test(cleanText)) {
    title = 'Send quotation';
  } else {
    title = cleanText
      .replace(/^remind\s+(?:me\s+)?(?:to\s+)?/i, '')
      .replace(/^remember\s+to\s+/i, '')
      .replace(/^don't\s+forget\s+to\s+/i, '')
      .replace(/\b(and\s+)?(?:add\s+it\s+to\s+my\s+calendar|add\s+to\s+calendar|put\s+on\s+calendar)\b/gi, '')
      .replace(/\b(tomorrow|tonight|today|kal|aaj|कल|आज)\b/gi, '')
      .replace(/\b(?:in|after)\s+\d+\s*(?:mins?|minutes?|hours?|hrs?)\b/gi, '')
      .replace(/\b\d+\s*(?:min|minute|mins|ghante)\s*(?:me|baad)\b/gi, '')
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:baje|बजे)\b/gi, '')
      .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
      .replace(/\b(send\s+karni\s+hai|bhejna\s+hai|bhejni\s+hai)\b/gi, '')
      .replace(/\b(karna\s+hai|karo|hai)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^to\s+/i, '');
  }

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = cleanText;
  }
  title = professionalizeFallbackTitle(prompt, title) || 'Create task';

  return {
    title,
    due_at: targetDate.toISOString(),
    note: null,
    priority,
    location,
    formatted_time_label: formatTimeLabel(targetDate, now),
    actions: {
      createReminder: !isCheckEmails,
      addToCalendar: shouldAddToCalendar,
      hasLocation: Boolean(location),
      checkEmails: isCheckEmails,
      findFollowUps: isCheckEmails,
    },
  };
}

export function formatTimeLabel(target: Date, reference: Date): string {
  const isSameDay =
    target.getDate() === reference.getDate() &&
    target.getMonth() === reference.getMonth() &&
    target.getFullYear() === reference.getFullYear();

  const tomorrow = new Date(reference);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    target.getDate() === tomorrow.getDate() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getFullYear() === tomorrow.getFullYear();

  const timeStr = target.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isSameDay) return `Today · ${timeStr}`;
  if (isTomorrow) return `Tomorrow · ${timeStr}`;

  const dateStr = target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `${dateStr} · ${timeStr}`;
}
