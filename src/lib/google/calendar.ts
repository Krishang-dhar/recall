import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { getAuthenticatedOAuthClient } from './oauth';
import { addAction, CalendarEventSnapshot } from '../action-history';

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string | null; date?: string | null };
  end: { dateTime?: string | null; date?: string | null };
  location?: string;
  htmlLink?: string;
  isLocalOnly?: boolean;
}

export interface CalendarEventInput {
  title: string;
  start: string; // ISO string
  end?: string; // ISO string (defaults to start + 1hr)
  location?: string | null;
  description?: string | null;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_CALENDAR_FILE = path.join(DATA_DIR, 'calendar-local.json');

function ensureLocalCalendarStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getLocalEvents(): CalendarEventItem[] {
  ensureLocalCalendarStorage();
  if (!fs.existsSync(LOCAL_CALENDAR_FILE)) {
    fs.writeFileSync(LOCAL_CALENDAR_FILE, JSON.stringify([], null, 2), 'utf8');
    return [];
  }

  try {
    const raw = fs.readFileSync(LOCAL_CALENDAR_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLocalEvent(event: CalendarEventItem) {
  const current = getLocalEvents();
  const index = current.findIndex((e) => e.id === event.id);
  if (index >= 0) {
    current[index] = event;
  } else {
    current.unshift(event);
  }
  fs.writeFileSync(LOCAL_CALENDAR_FILE, JSON.stringify(current, null, 2), 'utf8');
}

export async function getCalendarEvents(options?: {
  timeMin?: string;
  timeMax?: string;
}): Promise<{
  connected: boolean;
  needsApiEnable?: boolean;
  enableUrl?: string;
  events: CalendarEventItem[];
  error?: string;
}> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) {
    return {
      connected: false,
      events: getLocalEvents(),
      error: 'Google account is not connected. Connect in Settings or /connections.',
    };
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const now = new Date();
    const timeMin = options?.timeMin || new Date(now.setHours(0, 0, 0, 0)).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax: options?.timeMax,
      maxResults: 15,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const items = (response.data.items || []).map((e) => ({
      id: e.id || `cal-${Date.now()}`,
      summary: e.summary || '(Untitled Event)',
      description: e.description || undefined,
      start: { dateTime: e.start?.dateTime || e.start?.date },
      end: { dateTime: e.end?.dateTime || e.end?.date },
      location: e.location || undefined,
      htmlLink: e.htmlLink || 'https://calendar.google.com',
    }));

    return {
      connected: true,
      events: items.length > 0 ? items : getLocalEvents(),
    };
  } catch (err: any) {
    const msg = err.message || '';
    console.warn('Google Calendar fetch issue:', msg);

    if (msg.includes('Google Calendar API has not been used') || msg.includes('accessNotConfigured')) {
      return {
        connected: true,
        needsApiEnable: true,
        enableUrl:
          'https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=642561150357',
        events: getLocalEvents(),
        error:
          'Google Calendar API needs to be enabled in your Google Cloud Console for project 642561150357.',
      };
    }

    return {
      connected: true,
      events: getLocalEvents(),
      error: msg,
    };
  }
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<{
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  event?: CalendarEventItem;
  needsApiEnable?: boolean;
  error?: string;
}> {
  const startDate = new Date(input.start);
  const endDate = input.end
    ? new Date(input.end)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  const localItem: CalendarEventItem = {
    id: `event-${Date.now()}`,
    summary: input.title,
    description: input.description || 'Created by Recall Assistant',
    location: input.location || undefined,
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
    htmlLink: 'https://calendar.google.com',
    isLocalOnly: true,
  };

  const auth = await getAuthenticatedOAuthClient();
  if (!auth) {
    saveLocalEvent(localItem);
    return {
      success: true,
      eventId: localItem.id,
      event: localItem,
      htmlLink: localItem.htmlLink,
    };
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.title,
        description: input.description || 'Created by Recall Assistant',
        location: input.location || undefined,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        reminders: { useDefault: true },
      },
    });

    const googleItem: CalendarEventItem = {
      id: response.data.id || localItem.id,
      summary: response.data.summary || input.title,
      description: response.data.description || undefined,
      location: response.data.location || undefined,
      start: { dateTime: response.data.start?.dateTime || startDate.toISOString() },
      end: { dateTime: response.data.end?.dateTime || endDate.toISOString() },
      htmlLink: response.data.htmlLink || 'https://calendar.google.com',
    };

    saveLocalEvent(googleItem);

    addAction({
      tool: 'calendar',
      action: 'create_calendar_event',
      label: `Created event "${googleItem.summary}"`,
      status: 'completed',
      targetIds: [googleItem.id],
      beforeState: { type: 'calendar_events', events: [] },
      undoable: 'recreatable',
    });

    return {
      success: true,
      eventId: googleItem.id,
      htmlLink: googleItem.htmlLink,
      event: googleItem,
    };
  } catch (err: any) {
    const msg = err.message || '';
    console.warn('Google Calendar create event fallback to local store:', msg);

    // Save locally so the user's event is NEVER lost
    saveLocalEvent(localItem);

    addAction({
      tool: 'calendar',
      action: 'create_calendar_event',
      label: `Created event "${localItem.summary}"`,
      status: 'completed',
      targetIds: [localItem.id],
      beforeState: { type: 'calendar_events', events: [] },
      undoable: 'fully_undoable',
    });

    const needsApiEnable =
      msg.includes('Google Calendar API has not been used') || msg.includes('accessNotConfigured');

    return {
      success: true,
      eventId: localItem.id,
      htmlLink: localItem.htmlLink,
      event: localItem,
      needsApiEnable,
      error: needsApiEnable
        ? 'Saved to schedule! Note: Enable Google Calendar API in Google Cloud Console for cloud sync.'
        : undefined,
    };
  }
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEventInput>
): Promise<{
  success: boolean;
  event?: CalendarEventItem;
  error?: string;
}> {
  const current = getLocalEvents();
  const existing = current.find((e) => e.id === eventId);

  const updatedItem: CalendarEventItem = {
    id: eventId,
    summary: updates.title || existing?.summary || 'Updated Event',
    description: updates.description ?? existing?.description,
    location: updates.location ?? existing?.location,
    start: { dateTime: updates.start || existing?.start?.dateTime || new Date().toISOString() },
    end: { dateTime: updates.end || existing?.end?.dateTime || new Date().toISOString() },
    htmlLink: existing?.htmlLink || 'https://calendar.google.com',
  };

  saveLocalEvent(updatedItem);

  const auth = await getAuthenticatedOAuthClient();
  if (auth && !eventId.startsWith('cal-default-') && !eventId.startsWith('event-')) {
    try {
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
          summary: updates.title,
          description: updates.description || undefined,
          location: updates.location || undefined,
          start: updates.start
            ? { dateTime: new Date(updates.start).toISOString(), timeZone: 'Asia/Kolkata' }
            : undefined,
          end: updates.end
            ? { dateTime: new Date(updates.end).toISOString(), timeZone: 'Asia/Kolkata' }
            : undefined,
        },
      });
    } catch (e) {
      console.warn('Google Calendar cloud patch warning:', e);
    }
  }

  return { success: true, event: updatedItem };
}

// ─── Delete helpers ────────────────────────────────────────────────────────────

function deleteLocalEvent(eventId: string): CalendarEventItem | null {
  const current = getLocalEvents();
  const index = current.findIndex((e) => e.id === eventId);
  if (index < 0) return null;
  const [removed] = current.splice(index, 1);
  fs.writeFileSync(LOCAL_CALENDAR_FILE, JSON.stringify(current, null, 2), 'utf8');
  return removed;
}

export async function deleteCalendarEvent(eventId: string): Promise<{
  success: boolean;
  actionId?: string;
  snapshot?: CalendarEventSnapshot;
  needsScope?: boolean;
  error?: string;
}> {
  // First grab the full event data for snapshot
  const localSnapshot = getLocalEvents().find((e) => e.id === eventId);

  const auth = await getAuthenticatedOAuthClient();
  let googleSnapshot: CalendarEventSnapshot | null = null;

  if (auth && !eventId.startsWith('event-') && !eventId.startsWith('cal-')) {
    try {
      const calendar = google.calendar({ version: 'v3', auth });
      // Fetch full event to build snapshot
      const res = await calendar.events.get({ calendarId: 'primary', eventId });
      const ev = res.data;
      googleSnapshot = {
        id: ev.id || eventId,
        summary: ev.summary || '(Untitled Event)',
        description: ev.description || undefined,
        start: { dateTime: ev.start?.dateTime, date: ev.start?.date },
        end: { dateTime: ev.end?.dateTime, date: ev.end?.date },
        location: ev.location || undefined,
        htmlLink: ev.htmlLink || 'https://calendar.google.com',
      };
    } catch (e) {
      // Fall back to local snapshot
    }
  }

  const snapshot: CalendarEventSnapshot = googleSnapshot ||
    (localSnapshot
      ? {
          id: localSnapshot.id,
          summary: localSnapshot.summary,
          description: localSnapshot.description,
          start: localSnapshot.start,
          end: localSnapshot.end,
          location: localSnapshot.location,
          htmlLink: localSnapshot.htmlLink,
          isLocalOnly: localSnapshot.isLocalOnly,
        }
      : { id: eventId, summary: 'Unknown event', start: {}, end: {} });

  // Delete from Google Calendar
  let needsScope = false;
  if (auth && !eventId.startsWith('event-') && !eventId.startsWith('cal-')) {
    try {
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({ calendarId: 'primary', eventId });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('insufficient authentication scopes') || msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
        needsScope = true;
        return {
          success: false,
          needsScope: true,
          error: 'Recall needs Calendar write permission to delete events. Update Google permissions to continue.',
        };
      }
      console.warn('Calendar delete cloud error (continuing with local):', msg);
    }
  }

  // Always remove from local store
  deleteLocalEvent(eventId);

  // Record action for undo
  const actionRecord = addAction({
    tool: 'calendar',
    action: 'delete_calendar_event',
    label: `Deleted "${snapshot.summary}"`,
    status: 'completed',
    targetIds: [eventId],
    beforeState: { type: 'calendar_events', events: [snapshot] },
    undoable: 'recreatable',
  });

  return {
    success: true,
    actionId: actionRecord.id,
    snapshot,
  };
}

export async function deleteCalendarEvents(eventIds: string[]): Promise<{
  success: boolean;
  actionId?: string;
  deleted: number;
  snapshots?: CalendarEventSnapshot[];
  needsScope?: boolean;
  error?: string;
}> {
  if (eventIds.length === 0) return { success: true, deleted: 0 };

  const localEvents = getLocalEvents();
  const snapshots: CalendarEventSnapshot[] = [];

  // Build snapshots from local store first
  for (const id of eventIds) {
    const local = localEvents.find((e) => e.id === id);
    if (local) {
      snapshots.push({
        id: local.id,
        summary: local.summary,
        description: local.description,
        start: local.start,
        end: local.end,
        location: local.location,
        htmlLink: local.htmlLink,
        isLocalOnly: local.isLocalOnly,
      });
    } else {
      snapshots.push({ id, summary: '(Unknown event)', start: {}, end: {} });
    }
  }

  const auth = await getAuthenticatedOAuthClient();
  let deleteCount = 0;

  for (const id of eventIds) {
    if (auth && !id.startsWith('event-') && !id.startsWith('cal-')) {
      try {
        const calendar = google.calendar({ version: 'v3', auth });
        await calendar.events.delete({ calendarId: 'primary', eventId: id });
        deleteCount++;
      } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('insufficient authentication scopes') || msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
          return {
            success: false,
            deleted: 0,
            needsScope: true,
            error: 'Recall needs Calendar write permission to delete events.',
          };
        }
        console.warn(`Calendar bulk delete warning for ${id}:`, msg);
      }
    }
    // Remove from local
    deleteLocalEvent(id);
    deleteCount++;
  }

  // Record in history
  const label =
    snapshots.length === 1
      ? `Deleted "${snapshots[0].summary}"`
      : `Deleted ${snapshots.length} calendar events`;

  const actionRecord = addAction({
    tool: 'calendar',
    action: 'delete_calendar_events_bulk',
    label,
    status: 'completed',
    targetIds: eventIds,
    beforeState: { type: 'calendar_events', events: snapshots },
    undoable: 'recreatable',
  });

  return {
    success: true,
    actionId: actionRecord.id,
    deleted: deleteCount,
    snapshots,
  };
}

export async function restoreCalendarEventFromSnapshot(snapshot: CalendarEventSnapshot): Promise<{
  success: boolean;
  event?: CalendarEventItem;
  error?: string;
}> {
  // Try to recreate via Google Calendar API
  const startDt = snapshot.start.dateTime || snapshot.start.date || new Date().toISOString();
  const endDt = snapshot.end.dateTime || snapshot.end.date || new Date(new Date(startDt).getTime() + 3600000).toISOString();

  const result = await createCalendarEvent({
    title: snapshot.summary,
    start: startDt,
    end: endDt,
    location: snapshot.location,
    description: snapshot.description,
  });

  return result;
}
