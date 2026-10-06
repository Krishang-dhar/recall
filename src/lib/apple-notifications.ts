import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const BRIDGE_PATH = path.join(process.cwd(), 'macos-companion', 'recall-apple-bridge');

export interface AppleReminderOptions {
  title: string;
  dueAt?: string | Date | null;
  notes?: string | null;
  priority?: number;
}

export interface AppleCalendarOptions {
  title: string;
  startAt: string | Date;
  endAt?: string | Date | null;
  location?: string | null;
  notes?: string | null;
}

export interface BarkPushOptions {
  key?: string;
  title: string;
  body: string;
  sound?: string;
  isUrgent?: boolean;
}

export interface ApplePermissionStatus {
  calendar: 'authorized' | 'writeOnly' | 'denied' | 'restricted' | 'notDetermined' | 'unavailable';
  reminders: 'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unavailable';
  notifications: 'authorized' | 'denied' | 'notDetermined' | 'unavailable';
  isConnected: boolean;
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function hasBridge(): boolean {
  return isMacOS() && fs.existsSync(BRIDGE_PATH);
}

/**
 * Executes a command on the native Swift Apple EventKit/UserNotifications bridge.
 */
async function callBridge<T>(command: string, args: string[] = []): Promise<{ success: boolean; data?: T; error?: string }> {
  if (!hasBridge()) {
    return { success: false, error: 'Recall Apple native bridge binary is not available' };
  }

  try {
    const { stdout } = await execFileAsync(BRIDGE_PATH, [command, ...args]);
    const parsed = JSON.parse(stdout);
    return parsed;
  } catch (err: any) {
    return { success: false, error: err.message || 'Bridge execution failed' };
  }
}

/**
 * Returns real Apple EventKit and UserNotifications authorization status.
 */
export async function getApplePermissionStatus(): Promise<ApplePermissionStatus> {
  if (!isMacOS()) {
    return {
      calendar: 'unavailable',
      reminders: 'unavailable',
      notifications: 'unavailable',
      isConnected: false,
    };
  }

  const res = await callBridge<{
    calendar: string;
    reminders: string;
    notifications: string;
    isConnected: boolean;
  }>('status');

  if (res.success && res.data) {
    return {
      calendar: res.data.calendar as any,
      reminders: res.data.reminders as any,
      notifications: res.data.notifications as any,
      isConnected: res.data.isConnected,
    };
  }

  return {
    calendar: 'notDetermined',
    reminders: 'notDetermined',
    notifications: 'notDetermined',
    isConnected: false,
  };
}

/**
 * Requests native macOS permissions for Calendar, Reminders, and Notifications.
 */
export async function requestApplePermissions(): Promise<ApplePermissionStatus> {
  if (!isMacOS()) return getApplePermissionStatus();

  const res = await callBridge<{
    calendar: string;
    reminders: string;
    notifications: string;
    isConnected: boolean;
  }>('request-permissions');

  if (res.success && res.data) {
    return {
      calendar: res.data.calendar as any,
      reminders: res.data.reminders as any,
      notifications: res.data.notifications as any,
      isConnected: res.data.isConnected,
    };
  }

  return getApplePermissionStatus();
}

/**
 * Display a native macOS Notification Center banner with sound.
 * Uses native UserNotifications/AppKit via Swift bridge, falling back to AppleScript.
 */
export async function showMacOSNotification(
  title: string,
  message: string,
  sound: string = 'Glass'
): Promise<boolean> {
  if (!isMacOS()) return false;

  // 1. Try Native Swift Bridge
  if (hasBridge()) {
    const res = await callBridge<{ notified: boolean }>('notify', [title, message, sound]);
    if (res.success) return true;
  }

  // 2. Compatibility Fallback via AppleScript
  try {
    const cleanTitle = title.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanMsg = message.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanSound = sound.replace(/"/g, '');

    await execAsync(
      `osascript -e 'display notification "${cleanMsg}" with title "Recall — ${cleanTitle}" sound name "${cleanSound}"'`
    );
    return true;
  } catch (err) {
    console.warn('[Apple Notifications] Failed to show macOS notification banner:', err);
    return false;
  }
}

/**
 * Creates a reminder in Apple's native Reminders using EventKit.
 * When iCloud is enabled on the Mac, this immediately syncs to iPhone & Apple Watch.
 */
export async function createAppleReminder(
  options: AppleReminderOptions
): Promise<{ success: boolean; reminderId?: string; error?: string }> {
  if (!isMacOS()) {
    return { success: false, error: 'Apple Reminders is only supported on macOS' };
  }

  const isoDue = options.dueAt ? new Date(options.dueAt).toISOString() : '';
  const notes = options.notes || '';
  const priority = String(options.priority || 0);

  // 1. Try Native EventKit Swift Bridge
  if (hasBridge()) {
    const res = await callBridge<{ reminderId: string }>('reminders-create', [
      options.title,
      isoDue,
      notes,
      priority,
    ]);
    if (res.success && res.data?.reminderId) {
      console.log(`[EventKit Native] Reminder created: ${res.data.reminderId}`);
      return { success: true, reminderId: res.data.reminderId };
    }
  }

  // 2. Compatibility Fallback via AppleScript
  try {
    const cleanTitle = options.title.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanBody = notes.replace(/"/g, '\\"').replace(/'/g, "\\'");

    let dateScript = '';
    if (options.dueAt) {
      const d = new Date(options.dueAt);
      if (!isNaN(d.getTime())) {
        dateScript = `
          set d to current date
          set year of d to ${d.getFullYear()}
          set month of d to ${d.getMonth() + 1}
          set day of d to ${d.getDate()}
          set hours of d to ${d.getHours()}
          set minutes of d to ${d.getMinutes()}
          set seconds of d to 0
          set due date of newRem to d
        `;
      }
    }

    const script = `
      tell application "Reminders"
        launch
        set newRem to make new reminder with properties {name:"${cleanTitle}", body:"${cleanBody}"}
        ${dateScript}
        return id of newRem
      end tell
    `;

    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const reminderId = stdout.trim();
    return { success: true, reminderId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Completes an Apple Reminder by ID using EventKit.
 */
export async function completeAppleReminder(
  reminderId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isMacOS()) return { success: false, error: 'macOS only' };

  if (hasBridge()) {
    const res = await callBridge('reminders-complete', [reminderId]);
    if (res.success) return { success: true };
  }

  try {
    await execAsync(`osascript -e 'tell application "Reminders" to set completed of (first reminder whose id is "${reminderId}") to true'`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Deletes an Apple Reminder by ID using EventKit.
 */
export async function deleteAppleReminder(
  reminderId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isMacOS()) return { success: false, error: 'macOS only' };

  if (hasBridge()) {
    const res = await callBridge('reminders-delete', [reminderId]);
    if (res.success) return { success: true };
  }

  try {
    await execAsync(`osascript -e 'tell application "Reminders" to delete (first reminder whose id is "${reminderId}")'`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates an event in Apple's native Calendar using EventKit.
 * Syncs automatically across iPhone, Apple Watch, and Mac via iCloud.
 */
export async function createAppleCalendarEvent(
  options: AppleCalendarOptions
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!isMacOS()) {
    return { success: false, error: 'Apple Calendar is only supported on macOS' };
  }

  const start = new Date(options.startAt);
  const end = options.endAt ? new Date(options.endAt) : new Date(start.getTime() + 30 * 60 * 1000);
  const loc = options.location || '';
  const notes = options.notes || '';

  // 1. Try Native EventKit Swift Bridge
  if (hasBridge()) {
    const res = await callBridge<{ eventId: string }>('calendar-create', [
      options.title,
      start.toISOString(),
      end.toISOString(),
      loc,
      notes,
    ]);
    if (res.success && res.data?.eventId) {
      console.log(`[EventKit Native] Calendar event created: ${res.data.eventId}`);
      return { success: true, eventId: res.data.eventId };
    }
  }

  // 2. Compatibility Fallback via AppleScript
  try {
    const cleanTitle = options.title.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanNotes = notes.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanLoc = loc.replace(/"/g, '\\"').replace(/'/g, "\\'");

    const script = `
      tell application "Calendar"
        launch
        set dStart to current date
        set year of dStart to ${start.getFullYear()}
        set month of dStart to ${start.getMonth() + 1}
        set day of dStart to ${start.getDate()}
        set hours of dStart to ${start.getHours()}
        set minutes of dStart to ${start.getMinutes()}
        set seconds of dStart to 0

        set dEnd to current date
        set year of dEnd to ${end.getFullYear()}
        set month of dEnd to ${end.getMonth() + 1}
        set day of dEnd to ${end.getDate()}
        set hours of dEnd to ${end.getHours()}
        set minutes of dEnd to ${end.getMinutes()}
        set seconds of dEnd to 0

        tell first calendar
          set newEvent to make new event with properties {summary:"${cleanTitle}", description:"${cleanNotes}", location:"${cleanLoc}", start date:dStart, end date:dEnd}
          return id of newEvent
        end tell
      end tell
    `;

    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const eventId = stdout.trim();
    return { success: true, eventId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Deletes an Apple Calendar event by ID using EventKit.
 */
export async function deleteAppleCalendarEvent(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isMacOS()) return { success: false, error: 'macOS only' };

  if (hasBridge()) {
    const res = await callBridge('calendar-delete', [eventId]);
    if (res.success) return { success: true };
  }

  try {
    await execAsync(`osascript -e 'tell application "Calendar" to tell first calendar to delete (first event whose id is "${eventId}")'`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Sends an instant push notification to iPhone and Apple Watch via Bark.
 */
export async function sendBarkPush(
  options: BarkPushOptions
): Promise<{ success: boolean; error?: string }> {
  const key = options.key || process.env.BARK_KEY;
  if (!key || key.trim() === '') {
    return { success: false, error: 'Bark key is not configured' };
  }

  try {
    const cleanKey = key.trim().replace(/^https?:\/\/api\.day\.app\//, '').replace(/\/$/, '');
    const url = `https://api.day.app/${cleanKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Recall — ${options.title}`,
        body: options.body,
        sound: options.sound || (options.isUrgent ? 'alarm.caf' : 'bell.caf'),
        group: 'Recall',
        badge: 1,
      }),
    });

    const data = await res.json();
    if (res.ok && data.code === 200) {
      return { success: true };
    }
    return { success: false, error: data.message || 'Bark rejected request' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Master dispatcher for Apple Devices (Mac, iPhone, Apple Watch).
 */
export async function dispatchAppleNotification(options: {
  title: string;
  body: string;
  dueAt?: string | Date | null;
  isUrgent?: boolean;
}): Promise<{
  macBanner: boolean;
  appleReminder: boolean;
  barkPush: boolean;
}> {
  const results = {
    macBanner: false,
    appleReminder: false,
    barkPush: false,
  };

  try {
    results.macBanner = await showMacOSNotification(
      options.title,
      options.body,
      options.isUrgent ? 'Ping' : 'Glass'
    );
  } catch {}

  try {
    const remResult = await createAppleReminder({
      title: options.title,
      dueAt: options.dueAt,
      notes: options.body,
      priority: options.isUrgent ? 1 : 0,
    });
    results.appleReminder = remResult.success;
  } catch {}

  try {
    const barkResult = await sendBarkPush({
      title: options.title,
      body: options.body,
      isUrgent: options.isUrgent,
    });
    results.barkPush = barkResult.success;
  } catch {}

  return results;
}
