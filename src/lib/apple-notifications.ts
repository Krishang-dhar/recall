import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AppleReminderOptions {
  title: string;
  dueAt?: string | Date | null;
  notes?: string | null;
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

/**
 * Checks if the server environment is running on macOS.
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Display a native macOS Notification Center banner with sound.
 */
export async function showMacOSNotification(
  title: string,
  message: string,
  sound: string = 'Glass'
): Promise<boolean> {
  if (!isMacOS()) return false;

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
 * Creates a reminder in Apple's native Reminders.app on macOS.
 * When iCloud is enabled on the Mac, this immediately syncs to the user's
 * iPhone, Apple Watch, and iPad with native lock screen banners and sound.
 */
export async function createAppleReminder(
  options: AppleReminderOptions
): Promise<{ success: boolean; reminderId?: string; error?: string }> {
  if (!isMacOS()) {
    return { success: false, error: 'Apple Reminders is only supported on macOS' };
  }

  try {
    const cleanTitle = options.title.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanBody = (options.notes || '').replace(/"/g, '\\"').replace(/'/g, "\\'");

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
    console.log(`[Apple Notifications] Apple Reminder created (syncs to iPhone): ${reminderId}`);

    return {
      success: true,
      reminderId,
    };
  } catch (err: any) {
    console.warn('[Apple Notifications] Error creating Apple Reminder:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Creates an event in Apple's native Calendar.app on macOS.
 * Syncs automatically across iPhone, Apple Watch, and Mac via iCloud.
 */
export async function createAppleCalendarEvent(
  options: AppleCalendarOptions
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!isMacOS()) {
    return { success: false, error: 'Apple Calendar is only supported on macOS' };
  }

  try {
    const cleanTitle = options.title.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanNotes = (options.notes || '').replace(/"/g, '\\"').replace(/'/g, "\\'");
    const cleanLoc = (options.location || '').replace(/"/g, '\\"').replace(/'/g, "\\'");

    const start = new Date(options.startAt);
    const end = options.endAt ? new Date(options.endAt) : new Date(start.getTime() + 30 * 60 * 1000);

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
    console.log(`[Apple Notifications] Apple Calendar event created (syncs to iPhone): ${eventId}`);

    return {
      success: true,
      eventId,
    };
  } catch (err: any) {
    console.warn('[Apple Notifications] Error creating Apple Calendar event:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Sends an instant push notification to iPhone and Apple Watch via Bark (iOS app).
 * Bark is a free, open-source push client for Apple devices.
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
      console.log(`[Apple Notifications] Bark iOS push delivered to iPhone: "${options.title}"`);
      return { success: true };
    }

    return { success: false, error: data.message || 'Bark rejected request' };
  } catch (err: any) {
    console.warn('[Apple Notifications] Failed to send Bark push to iPhone:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Master dispatcher for Apple Devices (Mac, iPhone, Apple Watch).
 * 1. Shows native macOS Notification Center banner with sound.
 * 2. Creates/syncs native Apple Reminder (which rings on iPhone via iCloud).
 * 3. Sends Bark push to iPhone & Apple Watch if Bark key is configured.
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

  // 1. macOS Notification Center Banner
  try {
    results.macBanner = await showMacOSNotification(
      options.title,
      options.body,
      options.isUrgent ? 'Ping' : 'Glass'
    );
  } catch {}

  // 2. Apple Reminders Sync (iPhone & Apple Watch)
  try {
    const remResult = await createAppleReminder({
      title: options.title,
      dueAt: options.dueAt,
      notes: options.body,
    });
    results.appleReminder = remResult.success;
  } catch {}

  // 3. Bark iOS Instant Push
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
