import { Task } from './types';

export interface ActionRoutingPreferences {
  calendarAutoSync: 'always' | 'ask' | 'recall_only'; // default 'always' for meetings
  reminderDestination: 'whatsapp' | 'in_app' | 'both'; // default 'both'
  defaultMeetingDurationMinutes: number; // default 60
  defaultMeetingReminderMinutes: number; // default 30
}

export const DEFAULT_PREFERENCES: ActionRoutingPreferences = {
  calendarAutoSync: 'always',
  reminderDestination: 'both',
  defaultMeetingDurationMinutes: 60,
  defaultMeetingReminderMinutes: 30,
};

export type ItemCategory =
  | 'meeting'
  | 'class'
  | 'appointment'
  | 'exam'
  | 'task'
  | 'email'
  | 'file'
  | 'location'
  | 'general';

export interface ParsedItemIntent {
  category: ItemCategory;
  title: string;
  hasTime: boolean;
  hasDate: boolean;
  startTime?: Date;
  endTime?: Date;
  reminderTime?: Date;
  location?: string;
  missingTimePrompt?: string;
}

export interface ReminderContext {
  title?: string;
  location?: string | null;
  note?: string | null;
  meetingType?: 'online' | 'in_person' | 'nearby' | 'deadline' | string | null;
  priority?: string | null;
}

export interface ReminderDecision {
  minutesBefore: number;
  reminder: Date;
  label: string;
  naturalReason: string;
}

const MEETING_KEYWORDS = [
  'meeting',
  'meet',
  'sync',
  'call with',
  'catchup',
  'catch up',
  'appointment',
  'interview',
  'doctor',
  'dentist',
  'lunch with',
  'dinner with',
  'coffee with',
  'session',
  'discussion with',
];

const CLASS_KEYWORDS = ['class', 'lecture', 'lab', 'seminar', 'workshop'];

const EXAM_KEYWORDS = ['exam', 'test', 'quiz', 'midterm', 'viva', 'finals', 'presentation'];

/**
 * Checks if candidate text is a meeting, class, exam, or task
 */
export function detectItemCategory(prompt: string): ItemCategory {
  const p = prompt.toLowerCase();
  if (EXAM_KEYWORDS.some((kw) => p.includes(kw))) return 'exam';
  if (CLASS_KEYWORDS.some((kw) => p.includes(kw))) return 'class';
  if (MEETING_KEYWORDS.some((kw) => p.includes(kw))) return 'meeting';
  return 'task';
}

/**
 * Checks for duplicates among existing tasks
 */
export function checkDuplicateTask(
  candidateTitle: string,
  candidateDueIso: string,
  existingTasks: Task[]
): { isDuplicate: boolean; duplicateTask?: Task } {
  const candidateDate = new Date(candidateDueIso);
  const normTitle = candidateTitle.toLowerCase().replace(/^(a|an|the|meeting with|call with)\s+/i, '').trim();

  for (const t of existingTasks) {
    if (t.status === 'completed') continue;
    const tNorm = t.title.toLowerCase().replace(/^(a|an|the|meeting with|call with)\s+/i, '').trim();
    const tDate = new Date(t.due_at);

    // If title has high similarity
    const sameTitle = tNorm === normTitle || tNorm.includes(normTitle) || normTitle.includes(tNorm);

    // If within 20 minutes of each other
    const diffMins = Math.abs(candidateDate.getTime() - tDate.getTime()) / (1000 * 60);

    if (sameTitle && diffMins <= 30) {
      return { isDuplicate: true, duplicateTask: t };
    }
  }

  return { isDuplicate: false };
}

/**
 * Calculates start, end, and reminder times based on natural phrase and user preferences
 */
export function computeEventTimes(
  startIso: string,
  endIso?: string | null,
  isMeeting: boolean = true,
  prefs: ActionRoutingPreferences = DEFAULT_PREFERENCES,
  context: ReminderContext = {}
): {
  start: Date;
  end: Date;
  reminder: Date;
  timeLabel: string;
  reminderLabel: string;
  reminderMinutes: number;
  reminderReason: string;
} {
  const start = new Date(startIso);
  const duration = prefs.defaultMeetingDurationMinutes;
  const end = endIso ? new Date(endIso) : new Date(start.getTime() + duration * 60 * 1000);

  const reminderDecision = decideReminderTiming(start, isMeeting, context, prefs);
  const reminderMins = reminderDecision.minutesBefore;
  const reminder = reminderDecision.reminder;

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const fmtDate = (d: Date) => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const timeLabel = isMeeting
    ? `${fmtDate(start)} · ${fmtTime(start)}–${fmtTime(end)}`
    : `${fmtDate(start)} · ${fmtTime(start)}`;

  const reminderLabel = reminderMins > 0
    ? `${fmtTime(reminder)} (${reminderMins}m before)`
    : `${fmtTime(start)}`;

  return {
    start,
    end,
    reminder,
    timeLabel,
    reminderLabel,
    reminderMinutes: reminderMins,
    reminderReason: reminderDecision.naturalReason,
  };
}

/**
 * Picks a useful reminder lead time from the event context instead of applying
 * one blanket default. The result stays deterministic so the proposal and the
 * final saved task always show the same reminder.
 */
export function decideReminderTiming(
  start: Date,
  isMeeting: boolean,
  context: ReminderContext = {},
  prefs: ActionRoutingPreferences = DEFAULT_PREFERENCES
): ReminderDecision {
  const haystack = `${context.title || ''} ${context.location || ''} ${context.note || ''} ${context.meetingType || ''}`.toLowerCase();
  const minutesUntilStart = Math.max(0, Math.round((start.getTime() - Date.now()) / 60000));

  const isOnline = /online|zoom|google meet|meet link|teams|video call|virtual|remote/.test(haystack);
  const isImportant = /important|interview|doctor|dentist|client|presentation|exam|airport|flight/.test(haystack)
    || context.priority === 'urgent'
    || context.priority === 'high';
  const isNearby = /nearby|near me|same building|office|campus|walking|walk/.test(haystack);
  const hasTravel = Boolean(context.location?.trim()) && !isOnline;

  let minutesBefore: number;
  let naturalReason: string;

  if (!isMeeting || context.meetingType === 'deadline') {
    if (minutesUntilStart <= 120) {
      minutesBefore = Math.min(30, Math.max(10, Math.floor(minutesUntilStart / 3)));
      naturalReason = 'enough time to finish before the deadline';
    } else if (minutesUntilStart <= 8 * 60) {
      minutesBefore = 60;
      naturalReason = 'a focused hour to wrap up before the deadline';
    } else {
      minutesBefore = 180;
      naturalReason = 'an early heads-up without interrupting your day';
    }
  } else if (isOnline) {
    minutesBefore = isImportant ? 15 : 10;
    naturalReason = 'enough time to open the link and get ready';
  } else if (isNearby) {
    minutesBefore = isImportant ? 30 : 25;
    naturalReason = 'enough time to wrap up and walk over';
  } else if (hasTravel || context.meetingType === 'in_person') {
    minutesBefore = isImportant ? 60 : 45;
    naturalReason = 'enough time to leave and arrive comfortably';
  } else if (isImportant) {
    minutesBefore = 45;
    naturalReason = 'a little preparation time before the meeting';
  } else {
    minutesBefore = prefs.defaultMeetingReminderMinutes;
    naturalReason = 'a comfortable buffer before it starts';
  }

  // For last-minute plans, never schedule a reminder in the past.
  if (minutesUntilStart > 0 && minutesBefore >= minutesUntilStart) {
    minutesBefore = Math.max(5, Math.floor(minutesUntilStart / 2));
  }

  const reminder = new Date(start.getTime() - minutesBefore * 60 * 1000);
  const time = reminder.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    minutesBefore,
    reminder,
    label: `WhatsApp reminder · ${minutesBefore} min before`,
    naturalReason: `I’ll remind you at ${time} — ${naturalReason}.`,
  };
}
