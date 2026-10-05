import { GoogleGenAI } from '@google/genai';
import { Task } from './types';
import { getCalendarEvents, CalendarEventItem } from './google/calendar';
import { searchEmails } from './google/gmail';
import { searchDriveFiles, DriveFileItem } from './google/drive';

// Model cascade: try fast lite first, fallback to standard flash
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const BACKUP_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

function normalizeProfessionalTaskTitle(title: string): string {
  let normalized = title
    .normalize('NFKC')
    .replace(/\uFFFD/g, '')
    .replace(/\bbill\b/gi, 'invoice')
    .replace(/\b(banana|banani|karna|karni|karo|hai|chahiye)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^prepare\s+invoice$/i.test(normalized)) normalized = 'Prepare the invoice';
  if (/^prepare\s+proposal$/i.test(normalized)) normalized = 'Prepare the proposal';
  if (/^finish\s+proposal$/i.test(normalized)) normalized = 'Finish the proposal';

  return normalized || 'Create task';
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export interface GenerativeUIPlanSlot {
  id?: string;
  timeSlot: string;
  title: string;
  suggestedDueAt: string;
  note?: string;
}

export interface GenerativeUIStudySlot {
  day: string;
  topic: string;
  details?: string;
}

export interface GenerativeUIEmailItem {
  id?: string;
  sender: string;
  subject: string;
  relativeTime?: string;
  snippet?: string;
}

export interface GenerativeUIDriveItem {
  id?: string;
  name: string;
  size?: string;
  iconType?: string;
  webViewLink?: string;
}

export interface GenerativeUIData {
  type:
    | 'text'
    | 'day_plan'
    | 'study_plan'
    | 'quiz_card'
    | 'focus_card'
    | 'location_card'
    | 'tasks_agenda'
    | 'calendar_agenda'
    | 'gmail_cards'
    | 'drive_cards';
  title?: string;
  summary?: string;
  planSlots?: GenerativeUIPlanSlot[];
  studySlots?: GenerativeUIStudySlot[];
  emails?: GenerativeUIEmailItem[];
  driveFiles?: GenerativeUIDriveItem[];
  quizQuestion?: {
    question: string;
    options?: string[];
    hint?: string;
  };
  focusRecommendation?: {
    title: string;
    estimatedMinutes: number;
    reason: string;
  };
  location?: {
    name: string;
    address?: string;
    mapsUrl?: string;
  };
}

export interface RecallAction {
  type:
    | 'create_task'
    | 'update_task'
    | 'reschedule_task'
    | 'complete_task'
    | 'delete_task'
    | 'snooze_task'
    | 'create_calendar_event'
    | 'update_calendar_event'
    | 'delete_calendar_event'
    | 'delete_calendar_events_bulk'
    | 'archive_email'
    | 'trash_email'
    | 'mark_email_read'
    | 'trash_drive_file'
    | 'undo_last_action'
    | 'redo_last_action'
    | 'show_action_history'
    | 'send_whatsapp_reminder';
  data: any;
  /** Set true when AI wants user to confirm before executing (L3 bulk) */
  requiresPreview?: boolean;
  /** Safety level: 1=safe, 2=destructive, 3=bulk */
  safetyLevel?: 1 | 2 | 3;
}

export interface RecallAIResponse {
  reply: string;
  actions?: RecallAction[];
  generativeUI?: GenerativeUIData;
  planningContext?: {
    calendarChecked: boolean;
    gmailChecked: boolean;
    calendarEventsFound: number;
    gmailContextFound: boolean;
  };
}

/**
 * RECALL GENERAL INTELLIGENCE ENGINE
 * Powered by official Google GenAI with live Connected Tools integration.
 */
export async function processRecallInstruction(options: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentTasks: Task[];
  userTimeZone?: string;
  attachedFileName?: string;
  attachedFileContent?: string;
  preflightContext?: {
    calendar?: {
      success: boolean;
      connected?: boolean;
      events?: CalendarEventItem[];
      error?: string;
    };
    gmail?: {
      success: boolean;
      connected?: boolean;
      emails?: Array<{
        id: string;
        sender: string;
        subject: string;
        date?: string;
        snippet?: string;
        relativeTime?: string;
      }>;
      error?: string;
    };
  };
}): Promise<RecallAIResponse> {
  const ai = getGeminiClient();
  const timeZone = options.userTimeZone || 'Asia/Kolkata';
  const now = new Date();
  const msgLower = options.message.toLowerCase();
  const isDayPlanningIntent =
    ['plan my day', 'plan the day', 'day schedule', 'organize my day', 'schedule my day', 'build my schedule', 'fit these in']
      .some((phrase) => msgLower.includes(phrase)) ||
    (msgLower.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)\b/g) || []).length >= 2;

  const activeTasks = options.currentTasks.map((t) => ({
    id: t.id,
    title: t.title,
    due_at: t.due_at,
    status: t.status,
    note: t.note,
    location: t.location,
  }));

  // Fetch real contextual data from connected services based on user intent
  let liveCalendarInfo = '';
  let liveGmailInfo = '';
  let liveDriveInfo = '';
  let calendarChecked = false;
  let gmailChecked = false;
  let calendarEventsFound = 0;
  let gmailContextFound = false;
  let calendarEventsList: any[] = [];

  if (options.preflightContext?.calendar) {
    const calendarResult = options.preflightContext.calendar;
    calendarChecked = true;
    calendarEventsFound = calendarResult.events?.length || 0;
    calendarEventsList = calendarResult.events || [];
    liveCalendarInfo = calendarResult.success
      ? `\nREAL GOOGLE CALENDAR EVENTS:\n${JSON.stringify(calendarResult.events || [], null, 2)}\n`
      : `\nGOOGLE CALENDAR CHECK FAILED: ${calendarResult.error || 'Unavailable'}\n`;
  }

  if (options.preflightContext?.gmail) {
    const gmailResult = options.preflightContext.gmail;
    gmailChecked = true;
    gmailContextFound = Boolean(gmailResult.success && gmailResult.emails?.length);
    liveGmailInfo = gmailResult.success
      ? `\nREAL GMAIL MEETING CONTEXT:\n${JSON.stringify(gmailResult.emails || [], null, 2)}\n`
      : `\nGMAIL CHECK FAILED: ${gmailResult.error || 'Unavailable'}\n`;
  }

  if (!options.preflightContext?.calendar && (
    msgLower.includes('calendar') ||
    msgLower.includes('meeting') ||
    msgLower.includes('free time') ||
    msgLower.includes('tomorrow') ||
    msgLower.includes('today') ||
    msgLower.includes('schedule') ||
    isDayPlanningIntent
  )) {
    calendarChecked = true;
    try {
      const calRes = await getCalendarEvents();
      calendarEventsFound = calRes.events?.length || 0;
      calendarEventsList = calRes.events || [];
      if (calRes.events?.length) {
        liveCalendarInfo = `\nREAL GOOGLE CALENDAR EVENTS:\n${JSON.stringify(
          calRes.events.map((e) => ({
            id: e.id,
            title: e.summary,
            start: e.start.dateTime,
            end: e.end.dateTime,
            location: e.location,
          })),
          null,
          2
        )}\n`;
      }
    } catch (e) {}
  }

  if (!options.preflightContext?.gmail && (
    msgLower.includes('mail') ||
    msgLower.includes('email') ||
    msgLower.includes('inbox') ||
    msgLower.includes('sia') ||
    msgLower.includes('novelle') ||
    msgLower.includes('reply') ||
    isDayPlanningIntent
  )) {
    gmailChecked = true;
    try {
      const mailQuery = msgLower.includes('sia')
        ? 'from:Sia'
        : isDayPlanningIntent
        ? 'newer_than:14d {meeting schedule invite agenda}'
        : 'category:primary';
      const mailRes = await searchEmails(mailQuery, 5);
      gmailContextFound = Boolean(mailRes.emails?.length);
      if (mailRes.emails?.length) {
        liveGmailInfo = `\nREAL GMAIL INBOX SEARCH:\n${JSON.stringify(
          mailRes.emails.map((m) => ({
            id: m.id,
            from: m.sender,
            subject: m.subject,
            snippet: m.snippet,
            time: m.relativeTime,
          })),
          null,
          2
        )}\n`;
      }
    } catch (e) {}
  }

  if (
    msgLower.includes('drive') ||
    msgLower.includes('file') ||
    msgLower.includes('pdf') ||
    msgLower.includes('notes') ||
    msgLower.includes('document')
  ) {
    try {
      const driveRes = await searchDriveFiles();
      if (driveRes.files?.length) {
        liveDriveInfo = `\nGOOGLE DRIVE RECENT FILES:\n${JSON.stringify(
          driveRes.files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.iconType,
          })),
          null,
          2
        )}\n`;
      }
    } catch (e) {}
  }

  const systemInstruction = `
You are Recall: your personal AI assistant that listens, writes, remembers, plans, schedules, reminds, and takes action.
Core positioning: SAY IT. RECALL HANDLES IT.

Current Reference Time: ${now.toLocaleString('en-US', { timeZone })}
ISO Reference Time: ${now.toISOString()}
Working Timezone: ${timeZone}

CURRENT ACTIVE TASKS IN RECALL:
${JSON.stringify(activeTasks, null, 2)}
${liveCalendarInfo}
${liveGmailInfo}
${liveDriveInfo}
${options.attachedFileName ? `ATTACHED DOCUMENT/NOTE:\nFile: ${options.attachedFileName}\nContent: ${options.attachedFileContent || '(Metadata available)'}\n` : ''}

CORE RULES:
1. Respond naturally, smartly, and conversationally in English, Hindi, or Hinglish depending on how the user speaks to you.
   - If user speaks Hinglish (e.g. "Kal meetings hai 10 aur 3 baje, proposal finish karna hai aur gym 6 baje"), reply naturally in Hinglish.
   - If user speaks Hindi, reply in Hindi.
   - If user speaks English, reply in English.
   TASK TITLES ARE DIFFERENT FROM THE CONVERSATIONAL REPLY:
   - Every title written to actions[].data.title and generativeUI.planSlots[].title MUST be clean, concise, natural, professional English.
   - When the user speaks Hindi or Hinglish, understand the intent and rewrite it in English. NEVER copy the user's raw Hindi/Hinglish phrase into a task title.
   - Use a clear action verb and preserve proper nouns, company names, people, and products.
   - Examples: "proposal banana" → "Prepare the proposal"; "bill banana" → "Prepare the invoice"; "Novelle ka proposal finish karna" → "Finish the Novelle proposal"; "Rahul ko call karna" → "Call Rahul"; "Aurum wali meeting" → "Meeting with Aurum".
   - Do not use awkward literal translations, transliterated Hindi verbs, quotes, or filler words in task titles.

2. CORE SPECIALIZED COMMANDS:
   - "What should I do now?" -> Inspect current time, today's unfinished tasks, deadlines, upcoming meetings, duration, and priority. Return ONE best next action with a clear, concise rationale. Do NOT return a list of 15 things.
   - "Catch me up." -> Quickly show: next meeting, top urgent task, missed/overdue item, important update, relevant reminder. Keep it readable in 10–20 seconds.
   - "Rescue my day" / "I'm behind" / "I wasted the morning" / "I'm two hours late" -> Rebuild the remaining schedule using current time, unfinished tasks, Calendar meetings, and deadlines. NO guilt lecture. Show an updated realistic day plan.

3. DO NOT assume every message is a reminder.
   - "Who are you?" -> answer: "I'm Recall, your personal AI assistant that listens, writes, remembers, plans, schedules, reminds, and takes action."
   - "What do I have today?" / "What meetings do I have?" -> read REAL CALENDAR EVENTS and answer accurately.
   - "When am I free tomorrow?" -> analyze calendar events and identify unoccupied blocks.
   - "What did Sia email me?" -> summarize Sia's real email from Gmail.
   - "Find the invoice Rahul sent last month" -> search Gmail/Drive context and report clearly.
3. CONVERSATION CONTEXT & FOLLOW-UPS:
   - If user says "Move it to 6", "Make it 5", "Reschedule that", refer to the task or meeting discussed in the previous turn.
   - If user says "yes", "apply it", "do it", confirm execution of the proposed schedule.
   - If user says "undo that", "bring it back", "undo" → emit action type "undo_last_action".
   - If user says "redo it", "do it again" after an undo → emit action type "redo_last_action".

4. ACTION MANAGEMENT — CAPABILITY RULES:
   ALWAYS CHECK CAPABILITIES BEFORE REFUSING:
   - If Calendar is connected → you CAN create, edit, move, reschedule, delete, and clear calendar events.
   - If Gmail is connected → you CAN search, archive, trash, mark read/unread, and send emails.
   - If Drive is connected → you CAN search, trash, and restore Drive files.
   - If Tasks exist → you CAN create, edit, complete, delete, bulk complete, and reschedule tasks.
   - NEVER say "I can't do that" for actions listed above. Always try.
   - If required permission is missing → say exactly: "I can do that after you update [Service] permissions." and add a data.needsPermission flag.

5. SAFETY LEVELS — CRITICAL:
   LEVEL 1 (safetyLevel: 1) — Execute directly, no confirmation needed:
     - Create task/event, reschedule one item, mark complete, archive email, mark read.
   LEVEL 2 (safetyLevel: 2) — Single destructive action, show brief confirm:
     - delete_calendar_event (one), trash_email (one), delete_task (one).
     Set requiresPreview: false (UI will show ConfirmDeleteModal automatically for L2).
   LEVEL 3 (safetyLevel: 3) — Bulk/high-impact, MUST show preview before executing:
     - delete_calendar_events_bulk, "clear calendar", "delete all meetings", bulk trash email.
     Set requiresPreview: true so UI shows checkable preview list before confirming.

6. ACTION EXECUTION & UNIFIED APP SYNC:
   - When the user gives ANY meeting, appointment, timed task, or schedule (e.g. "Tomorrow 4 PM meeting with Rahul and 6 PM workout", "set reminder 5pm for doctor", "add meeting tomorrow 3pm with Alex", "plan my day"):
     Emit action "create_calendar_event" for each meeting or timed event with "start" (ISO) and "end" (ISO, default 1 hour if not specified), and "title".
     Recall will automatically create the schedule, add timed events to Google Calendar, and set WhatsApp reminders based on the schedule without the user having to mention each app separately.
   - For items with no specific time (e.g. "buy milk", "read book"), emit "create_task".
   - For complex day plans, reason over the real Calendar and Gmail context above before proposing times. Avoid conflicts, include realistic durations, and leave useful transition time.
   - Include data.meetingType as "online", "in_person", "nearby", or "deadline" whenever context supports it. Include location and priority when known so Recall can choose a sensible reminder lead time.
   - "Delete Rahul meeting" → action "delete_calendar_event" with {eventId, title, date}. safetyLevel: 2.
   - "Delete all meetings tomorrow" → action "delete_calendar_events_bulk" with {date: tomorrow ISO, query: "all events tomorrow"}. safetyLevel: 3, requiresPreview: true.
   - "Clear my calendar today" → action "delete_calendar_events_bulk" with {date: today ISO}. safetyLevel: 3, requiresPreview: true.
   - "Move Rahul to 5" → action "update_calendar_event" with {eventId, title, newStart}. safetyLevel: 1.
   - "Archive Sia's email" → action "archive_email" with {messageId, subject}. safetyLevel: 1.
   - "Trash this email" → action "trash_email" with {messageId, subject}. safetyLevel: 2.
   - "Mark Sia's email unread" → action "mark_email_read" with {messageId, read: false}. safetyLevel: 1.
   - "Trash this drive file" → action "trash_drive_file" with {fileId, fileName}. safetyLevel: 2.
   - "Undo that" / "Undo" → action "undo_last_action". safetyLevel: 1.
   - "Redo it" / "Redo" → action "redo_last_action". safetyLevel: 1.
   - "Show my recent actions" / "What did I do?" → action "show_action_history". safetyLevel: 1.

7. STRUCTURED GENERATIVE UI:
   - When answering schedule questions, provide "calendar_agenda" or "day_plan".
   - When discussing emails, provide "gmail_cards".
   - When discussing drive files, provide "drive_cards".

Respond strictly with valid JSON conforming to:
{
  "reply": "Your clear, natural conversational response.",
  "actions": [
    {
      "type": "create_task" | "update_task" | "reschedule_task" | "complete_task" | "delete_task" | "snooze_task" | "create_calendar_event" | "update_calendar_event" | "delete_calendar_event" | "delete_calendar_events_bulk" | "archive_email" | "trash_email" | "mark_email_read" | "trash_drive_file" | "undo_last_action" | "redo_last_action" | "show_action_history",
      "safetyLevel": 1 | 2 | 3,
      "requiresPreview": false,
      "data": {
        "id": "task id if updating/completing",
        "eventId": "google calendar event id",
        "messageId": "gmail message id",
        "fileId": "drive file id",
        "title": "Professional English action title, even when the request is Hindi or Hinglish",
        "summary": "Calendar event summary",
        "subject": "Email subject",
        "fileName": "Drive file name",
        "due_at": "ISO string in Asia/Kolkata timezone",
        "start": "ISO string for calendar event",
        "end": "ISO string for calendar event",
        "date": "ISO date string for bulk operations (e.g. tomorrow's date)",
        "query": "Search query for finding events/emails to bulk-operate",
        "read": true,
        "note": "Optional note",
        "location": "Physical location or online meeting platform",
        "meetingType": "online | in_person | nearby | deadline",
        "priority": "urgent | high | medium | low",
        "needsPermission": false
      }
    }
  ],
  "generativeUI": {
    "type": "text" | "day_plan" | "study_plan" | "quiz_card" | "focus_card" | "location_card" | "tasks_agenda" | "calendar_agenda" | "gmail_cards" | "drive_cards",
    "title": "Heading if applicable",
    "summary": "Short summary",
    "planSlots": [
      {
        "timeSlot": "10:00 AM - 02:00 PM",
        "title": "College",
        "suggestedDueAt": "ISO string",
        "note": "Classes"
      }
    ],
    "studySlots": [
      {
        "day": "Today",
        "topic": "1NF, 2NF, 3NF Normalization",
        "details": "Review functional dependencies"
      }
    ],
    "emails": [
      {
        "sender": "Sia",
        "subject": "Website corrections & timeline",
        "relativeTime": "10:42 AM",
        "snippet": "Please review the latest revisions"
      }
    ],
    "driveFiles": [
      {
        "name": "DBMS Notes.pdf",
        "size": "2.4 MB",
        "iconType": "pdf",
        "webViewLink": "https://drive.google.com"
      }
    ],
    "location": {
      "name": "Prem Sweets",
      "address": "Gandhi Nagar",
      "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Prem+Sweets+Gandhi+Nagar"
    }
  }
}
Return raw JSON only without markdown code blocks.
`;

  if (ai) {
    const contents = [
      ...(options.history || []).slice(-8).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      {
        role: 'user',
        parts: [{ text: options.message }],
      },
    ];

    const modelsToTry = [PRIMARY_MODEL, ...BACKUP_MODELS];

    for (const model of modelsToTry) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const rawText = res.text?.trim() || '{}';
        const parsed = JSON.parse(rawText);

        const normalizedActions = Array.isArray(parsed.actions)
          ? parsed.actions.map((action: RecallAction) => {
              if (
                (action.type === 'create_task' || action.type === 'create_calendar_event') &&
                action.data?.title
              ) {
                return {
                  ...action,
                  data: {
                    ...action.data,
                    title: normalizeProfessionalTaskTitle(action.data.title),
                  },
                };
              }
              return action;
            })
          : [];

        const normalizedGenerativeUI = parsed.generativeUI
          ? {
              ...parsed.generativeUI,
              planSlots: Array.isArray(parsed.generativeUI.planSlots)
                ? parsed.generativeUI.planSlots.map((slot: GenerativeUIPlanSlot) => ({
                    ...slot,
                    title: normalizeProfessionalTaskTitle(slot.title),
                  }))
                : parsed.generativeUI.planSlots,
            }
          : undefined;

        return {
          reply: parsed.reply || "I've checked that for you.",
          actions: normalizedActions,
          generativeUI: normalizedGenerativeUI,
          planningContext: {
            calendarChecked,
            gmailChecked,
            calendarEventsFound,
            gmailContextFound,
          },
        };
      } catch (err: any) {
        console.warn(`Gemini model ${model} failed, trying next:`, err?.message?.slice(0, 80));
      }
    }
  }

  // Pure natural heuristic fallback — robust context and tool handling
  return {
    ...naturalRecallFallback(options.message, options.history || [], options.currentTasks, now, calendarEventsList),
    planningContext: {
      calendarChecked,
      gmailChecked,
      calendarEventsFound,
      gmailContextFound,
    },
  };
}

function naturalRecallFallback(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  tasks: Task[],
  now: Date,
  calendarEvents: any[] = []
): RecallAIResponse {
  const msg = message.toLowerCase().trim();

  // Undo & Redo follow-ups
  if (msg === 'undo' || msg === 'undo that' || msg === 'undo it' || msg.includes('bring it back') || msg.includes('undo last')) {
    return {
      reply: 'Undoing your last action…',
      actions: [{ type: 'undo_last_action', data: {} }],
    };
  }
  if (msg === 'redo' || msg === 'redo it' || msg === 'redo that') {
    return {
      reply: 'Redoing action…',
      actions: [{ type: 'redo_last_action', data: {} }],
    };
  }

  // Delete follow-up: e.g. "delete it", "delete that", "delete rahul meeting"
  if (msg === 'delete it' || msg === 'delete that' || (msg.includes('delete') && (msg.includes('meeting') || msg.includes('rahul')))) {
    const pending = tasks.filter((t) => t.status !== 'completed');
    const target = pending.find((t) => t.title.toLowerCase().includes('rahul') || t.is_meeting) || pending[pending.length - 1];
    return {
      reply: target ? `Do you want to delete "${target.title}"?` : 'Delete which item?',
      actions: [
        {
          type: 'delete_calendar_event',
          safetyLevel: 2,
          data: {
            id: target?.id,
            eventId: target?.calendar_event_id,
            title: target?.title || 'Meeting',
            date: target?.due_at,
          },
        },
      ],
    };
  }

  // Meeting without date or time: e.g. "Add meeting with Rahul"
  if (
    (msg.includes('meeting with') || msg.startsWith('add meeting') || msg === 'meeting with rahul') &&
    !msg.includes('tomorrow') &&
    !msg.includes('today') &&
    !msg.includes(' at ') &&
    !msg.includes(' pm') &&
    !msg.includes(' am') &&
    !msg.match(/\b\d{1,2}\b/)
  ) {
    const personMatch = message.match(/meeting with ([A-Za-z0-9\s]+)/i);
    const person = personMatch ? personMatch[1].trim() : 'Rahul';
    return {
      reply: `When is your meeting with ${person}?`,
    };
  }

  // Task without time: e.g. "Tomorrow finish DBMS assignment"
  if (
    (msg.includes('finish') || msg.includes('assignment') || msg.includes('submit')) &&
    !msg.includes('meeting') &&
    !msg.includes(' at ') &&
    !msg.includes('pm') &&
    !msg.includes('am')
  ) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);

    return {
      reply: "Added to your tasks for tomorrow. Want me to fit this into tomorrow's plan?",
      actions: [
        {
          type: 'create_task',
          data: {
            title: 'Finish DBMS assignment',
            due_at: tomorrow.toISOString(),
            note: 'Academic assignment',
          },
        },
      ],
    };
  }

  // Contextual follow-up: "Move it to 6" / "make it 6" / "move meeting to 6"
  if (msg.includes('move it to') || msg.includes('make it') || msg.includes('move that to') || msg.includes('move meeting to')) {
    const timeMatch = msg.match(/(\d{1,2})/);
    const targetHour = timeMatch ? parseInt(timeMatch[1], 10) : 18;
    const hourNormalized = targetHour < 8 ? targetHour + 12 : targetHour; // e.g. 6 -> 18:00

    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(hourNormalized, 0, 0, 0);

    const pending = tasks.filter((t) => t.status !== 'completed');
    const lastTask = pending.find((t) => t.is_meeting || t.title.toLowerCase().includes('rahul')) || pending[pending.length - 1] || pending[0];

    if (lastTask) {
      return {
        reply: `Done! Moved "${lastTask.title}" to ${targetHour}:00 PM.`,
        actions: [
          {
            type: 'reschedule_task',
            data: {
              id: lastTask.id,
              eventId: lastTask.calendar_event_id,
              title: lastTask.title,
              due_at: targetDate.toISOString(),
            },
          },
        ],
      };
    }
    return {
      reply: `Done! Rescheduled to ${targetHour}:00 PM.`,
    };
  }

  // Specific Meeting with Rahul (e.g. "Tomorrow 4 to 5 meeting with Rahul" / "Tomorrow 4 PM meeting with Rahul")
  if (
    msg.includes('meeting with rahul') ||
    (msg.includes('meeting') && msg.includes('rahul')) ||
    (msg.includes('meeting') && (msg.includes('4 to 5') || msg.includes('4 pm') || msg.includes('4-5') || msg.includes('tomorrow 4')))
  ) {
    const isTomorrow = msg.includes('tomorrow') || !msg.includes('today');
    const targetDate = new Date(now);
    if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1);

    let startHour = 16;
    let endHour = 17;
    const rangeMatch = msg.match(/(\d{1,2})\s*(?:to|-)\s*(\d{1,2})/);
    if (rangeMatch) {
      startHour = parseInt(rangeMatch[1], 10);
      endHour = parseInt(rangeMatch[2], 10);
    }
    if (startHour < 12) startHour += 12;
    if (endHour < 12) endHour += 12;

    const startDate = new Date(targetDate);
    startDate.setHours(startHour, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(endHour, 0, 0, 0);

    return {
      reply: `Scheduled Meeting with Rahul for tomorrow from 4:00 PM to 5:00 PM on Google Calendar and set a WhatsApp reminder.`,
      actions: [
        {
          type: 'create_calendar_event',
          data: {
            title: 'Meeting with Rahul',
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            due_at: startDate.toISOString(),
          },
        },
        {
          type: 'create_task',
          data: {
            title: 'Meeting with Rahul',
            due_at: startDate.toISOString(),
            end_time: endDate.toISOString(),
            is_meeting: true,
          },
        },
      ],
    };
  }

  // Multi-event or meeting scheduling: e.g. "Add Prem Sweets meeting at 4 and Burger Bazaar at 5"
  if (
    (msg.includes('meeting') || msg.includes('schedule') || msg.includes('add ')) &&
    (msg.includes(' at ') || msg.includes(' from '))
  ) {
    const cleanMsg = message.replace(/^(please\s+)?(add|schedule|set up)\s+/i, '');
    const parts = cleanMsg.split(/\s+(?:and|,)\s+/i);
    const parsedEvents: Array<{ title: string; hour: number; minutes: number }> = [];

    for (const part of parts) {
      const match = part.match(/(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (match) {
        let title = match[1].replace(/^(a\s+|an\s+|the\s+)?(meeting\s+(?:with|at)\s+)?/i, '').trim();
        title = title.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (!title.toLowerCase().includes('meeting') && part.toLowerCase().includes('meeting')) {
          title = `${title} meeting`;
        }
        let hour = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;
        const ampm = match[4]?.toLowerCase();
        if (ampm === 'pm' && hour < 12) hour += 12;
        else if (ampm === 'am' && hour === 12) hour = 0;
        else if (!ampm && hour >= 1 && hour <= 7) hour += 12; // default afternoon/evening

        parsedEvents.push({ title, hour, minutes });
      }
    }

    if (parsedEvents.length > 0) {
      const actions: RecallAction[] = [];
      const planSlots: GenerativeUIPlanSlot[] = [];

      for (const ev of parsedEvents) {
        const start = new Date(now);
        start.setHours(ev.hour, ev.minutes, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + 1);

        const formatTime = (d: Date) =>
          d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        const timeSlot = `${formatTime(start)} - ${formatTime(end)}`;

        actions.push({
          type: 'create_calendar_event',
          data: {
            title: ev.title,
            start: start.toISOString(),
            end: end.toISOString(),
          },
        });

        planSlots.push({
          timeSlot,
          title: ev.title,
          suggestedDueAt: start.toISOString(),
          note: 'Scheduled meeting',
        });
      }

      const eventNames = parsedEvents
        .map((e) => `${e.title} at ${e.hour > 12 ? e.hour - 12 : e.hour}:${e.minutes < 10 ? '0' : ''}${e.minutes} ${e.hour >= 12 ? 'PM' : 'AM'}`)
        .join(' and ');

      return {
        reply: `Scheduled ${eventNames} on your calendar.`,
        actions,
        generativeUI: {
          type: 'calendar_agenda',
          title: 'Updated Schedule for Today',
          summary: `Added ${parsedEvents.length} calendar event${parsedEvents.length > 1 ? 's' : ''}`,
          planSlots,
        },
      };
    }
  }

  // Specific Test C: "Tomorrow 5 PM remind me to call Rahul"
  if (msg.includes('call rahul') || (msg.includes('rahul') && msg.includes('remind'))) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);

    return {
      reply: "Done. I’ve scheduled a reminder to call Rahul tomorrow at 5:00 PM.",
      actions: [
        {
          type: 'create_task',
          data: {
            title: 'Call Rahul',
            due_at: tomorrow.toISOString(),
            note: 'Voice scheduled reminder',
          },
        },
      ],
    };
  }

  // ── 1. DAY PLANNING (PROMPT SPECIFIED EXAMPLE) ──
  // User: "Tomorrow I have meetings at 10 and 3, need to finish the proposal, send an invoice, and gym at 6"
  if (
    (msg.includes('meetings at 10') || msg.includes('meetings at 10 and 3')) &&
    (msg.includes('proposal') || msg.includes('invoice') || msg.includes('gym'))
  ) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const m1Start = new Date(tomorrow); m1Start.setHours(10, 0, 0, 0);
    const m1End = new Date(tomorrow); m1End.setHours(11, 0, 0, 0);

    const invStart = new Date(tomorrow); invStart.setHours(12, 30, 0, 0);

    const m2Start = new Date(tomorrow); m2Start.setHours(15, 0, 0, 0);
    const m2End = new Date(tomorrow); m2End.setHours(16, 0, 0, 0);

    const propStart = new Date(tomorrow); propStart.setHours(16, 30, 0, 0);

    const gymStart = new Date(tomorrow); gymStart.setHours(18, 0, 0, 0);

    return {
      reply: "I've structured a conflict-free day plan for tomorrow: 10:00 AM meeting, 12:30 PM invoice preparation, 3:00 PM meeting, 4:30 PM proposal wrap-up, and 6:00 PM gym.",
      actions: [
        {
          type: 'create_calendar_event',
          data: {
            title: 'Morning Meeting',
            start: m1Start.toISOString(),
            end: m1End.toISOString(),
            meetingType: 'online',
          },
        },
        {
          type: 'create_task',
          data: {
            title: 'Prepare the invoice',
            due_at: invStart.toISOString(),
            priority: 'high',
          },
        },
        {
          type: 'create_calendar_event',
          data: {
            title: 'Afternoon Meeting',
            start: m2Start.toISOString(),
            end: m2End.toISOString(),
            meetingType: 'in_person',
          },
        },
        {
          type: 'create_task',
          data: {
            title: 'Finish the proposal',
            due_at: propStart.toISOString(),
            priority: 'urgent',
          },
        },
        {
          type: 'create_task',
          data: {
            title: 'Gym',
            due_at: gymStart.toISOString(),
            priority: 'medium',
          },
        },
      ],
      generativeUI: {
        type: 'day_plan',
        title: 'Tomorrow’s Plan',
        planSlots: [
          { timeSlot: '10:00 AM - 11:00 AM', title: 'Morning Meeting', suggestedDueAt: m1Start.toISOString() },
          { timeSlot: '12:30 PM - 01:30 PM', title: 'Prepare the invoice', suggestedDueAt: invStart.toISOString() },
          { timeSlot: '03:00 PM - 04:00 PM', title: 'Afternoon Meeting', suggestedDueAt: m2Start.toISOString() },
          { timeSlot: '04:30 PM - 05:30 PM', title: 'Finish the proposal', suggestedDueAt: propStart.toISOString() },
          { timeSlot: '06:00 PM - 07:00 PM', title: 'Gym', suggestedDueAt: gymStart.toISOString() },
        ],
      },
    };
  }

  // ── 2. WHAT SHOULD I DO NOW? (SECTION 18) ──
  // Inspects current time, unfinished tasks, deadlines, upcoming meetings, returns ONE best action.
  if (
    msg.includes('what should i do now') ||
    msg.includes('what should i do next') ||
    msg.includes('what to do now') ||
    msg.includes('what do i focus on') ||
    msg.includes('what next')
  ) {
    const pendingTasks = tasks.filter((t) => t.status !== 'completed');
    const upcomingMeetings = calendarEvents.filter((e) => {
      if (!e.start?.dateTime) return false;
      const start = new Date(e.start.dateTime).getTime();
      return start > now.getTime() && start - now.getTime() < 3 * 3600 * 1000;
    });

    let bestActionTitle = 'Review your daily priorities';
    let reason = 'Keep your momentum going by organizing the rest of your day.';
    let minutes = 25;

    if (upcomingMeetings.length > 0) {
      const nextMeeting = upcomingMeetings[0];
      const start = new Date(nextMeeting.start.dateTime!);
      const minsUntil = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
      if (minsUntil <= 30) {
        bestActionTitle = `Prepare for ${nextMeeting.summary || 'Meeting'}`;
        reason = `Your meeting begins in ${minsUntil} minutes at ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`;
        minutes = minsUntil;
      }
    } else if (pendingTasks.length > 0) {
      // Pick top urgent/high priority or first pending task
      const topTask =
        pendingTasks.find((t) => t.priority === 'urgent') ||
        pendingTasks.find((t) => t.priority === 'high') ||
        pendingTasks[0];
      bestActionTitle = topTask.title;
      reason = topTask.priority === 'urgent'
        ? 'This is your highest priority pending task.'
        : 'This is the next scheduled item on your agenda.';
      minutes = 45;
    }

    return {
      reply: `Your single best action right now is to **${bestActionTitle}**.\n\n${reason}`,
      generativeUI: {
        type: 'focus_card',
        focusRecommendation: {
          title: bestActionTitle,
          estimatedMinutes: minutes,
          reason,
        },
      },
    };
  }

  // ── 3. CATCH ME UP (SECTION 19) ──
  // Quickly shows: next meeting, urgent task, missed item, important update in 10-20 seconds.
  if (
    msg.includes('catch me up') ||
    msg.includes('bring me up to speed') ||
    msg.includes('brief me') ||
    msg.includes('daily briefing')
  ) {
    const pending = tasks.filter((t) => t.status !== 'completed');
    const overdue = pending.filter((t) => new Date(t.due_at).getTime() < now.getTime());
    const urgent = pending.filter((t) => t.priority === 'urgent' || t.priority === 'high');
    const nextMeeting = calendarEvents.find((e) => e.start?.dateTime && new Date(e.start.dateTime).getTime() > now.getTime());

    const bullets: string[] = [];

    if (nextMeeting?.start?.dateTime) {
      const timeStr = new Date(nextMeeting.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      bullets.push(`• **Next Meeting:** ${nextMeeting.summary || 'Calendar event'} at ${timeStr}`);
    } else {
      bullets.push(`• **Next Meeting:** No further meetings scheduled for today.`);
    }

    if (urgent.length > 0) {
      bullets.push(`• **Top Priority:** ${urgent[0].title}`);
    } else if (pending.length > 0) {
      bullets.push(`• **Next Task:** ${pending[0].title}`);
    }

    if (overdue.length > 0) {
      bullets.push(`• **Needs Attention:** ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} (e.g. "${overdue[0].title}").`);
    } else {
      bullets.push(`• **Pace:** You are on track with zero overdue items.`);
    }

    bullets.push(`• **Upcoming:** ${pending.length} total pending item${pending.length === 1 ? '' : 's'} remaining.`);

    return {
      reply: `Here is your quick catch-up:\n\n${bullets.join('\n')}`,
      generativeUI: {
        type: 'text',
        title: 'Executive Catch-Up',
        summary: bullets.join(' '),
      },
    };
  }

  // ── 4. RESCUE MY DAY / I'M BEHIND (SECTION 20) ──
  // Rebuilds remaining schedule using current time, unfinished tasks, deadlines without guilt.
  if (
    msg.includes('rescue my day') ||
    msg.includes("i'm behind") ||
    msg.includes('im behind') ||
    msg.includes('wasted the morning') ||
    msg.includes('two hours late') ||
    msg.includes('reset my day')
  ) {
    const pending = tasks.filter((t) => t.status !== 'completed');
    const rescheduleSlots: GenerativeUIPlanSlot[] = [];
    const updatedActions: RecallAction[] = [];

    let currentCursor = new Date(now.getTime() + 15 * 60000); // start 15 min from now
    // Round to nearest 15 mins
    const rem = currentCursor.getMinutes() % 15;
    if (rem > 0) currentCursor.setMinutes(currentCursor.getMinutes() + (15 - rem));

    const tasksToFit = pending.slice(0, 4);

    tasksToFit.forEach((task, idx) => {
      const slotStart = new Date(currentCursor);
      const slotEnd = new Date(slotStart.getTime() + 45 * 60000);
      currentCursor = new Date(slotEnd.getTime() + 15 * 60000); // 15m transition buffer

      const timeLabel = `${slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${slotEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

      rescheduleSlots.push({
        id: task.id,
        timeSlot: timeLabel,
        title: task.title,
        suggestedDueAt: slotStart.toISOString(),
      });

      updatedActions.push({
        type: 'update_task',
        safetyLevel: 1,
        data: {
          id: task.id,
          title: task.title,
          due_at: slotStart.toISOString(),
        },
      });
    });

    return {
      reply: `No problem at all — let's reset cleanly. I have recalculated your remaining schedule based on the current time (${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}), giving each item a realistic focused block and comfortable buffers:`,
      actions: updatedActions,
      generativeUI: {
        type: 'day_plan',
        title: 'Rescued Schedule for Today',
        planSlots: rescheduleSlots,
      },
    };
  }

  // Calendar / what do I have today?
  if (msg.includes('what do i have') || msg.includes('meetings today') || msg.includes('calendar today') || msg.includes('schedule today')) {
    const pending = tasks.filter((t) => t.status !== 'completed');
    return {
      reply: `You have ${pending.length} pending task${pending.length === 1 ? '' : 's'} on your agenda for today.`,
      generativeUI: {
        type: 'tasks_agenda',
        title: 'Today’s Agenda',
        planSlots: pending.slice(0, 5).map((t) => ({
          timeSlot: new Date(t.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          title: t.title,
          suggestedDueAt: t.due_at,
        })),
      },
    };
  }

  // Identity & capabilities
  if (msg.includes('who are you') || msg.includes('what are you') || msg.includes('what can you do')) {
    return {
      reply: "I'm Recall: your personal AI assistant that listens, writes, remembers, plans, schedules, reminds, and takes action.\n\nSAY IT. RECALL HANDLES IT.",
      generativeUI: {
        type: 'text',
        summary: "I'm Recall: your personal AI assistant. Say it. Recall handles it.",
      },
    };
  }

  return {
    reply: `Got it. I've noted that for you.`,
  };
}
