import { NextRequest, NextResponse } from 'next/server';
import {
  isMacOS,
  getApplePermissionStatus,
  requestApplePermissions,
  showMacOSNotification,
  createAppleReminder,
  completeAppleReminder,
  deleteAppleReminder,
  createAppleCalendarEvent,
  deleteAppleCalendarEvent,
  sendBarkPush,
  dispatchAppleNotification,
} from '@/lib/apple-notifications';

// GET /api/apple: returns real authorization status
export async function GET() {
  const isMac = isMacOS();
  const permissions = await getApplePermissionStatus();
  const hasBark = Boolean(process.env.BARK_KEY && process.env.BARK_KEY.trim().length > 0);

  return NextResponse.json({
    success: true,
    isMacOS: isMac,
    permissions,
    hasBark,
    message: isMac
      ? permissions.isConnected
        ? 'Apple Ecosystem Connected: Native EventKit and UserNotifications active.'
        : 'Apple Ecosystem Available: Permissions required to enable native sync.'
      : 'Non-macOS environment.',
  });
}

// POST /api/apple: handles actions, permission requests, and dispatch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action = 'test',
      title = 'Recall',
      message = 'Reminder notification',
      dueAt,
      startAt,
      endAt,
      location,
      notes,
      id,
      barkKey,
      priority,
    } = body;

    // 1. Request native permissions
    if (action === 'request_permissions') {
      const status = await requestApplePermissions();
      return NextResponse.json({
        success: true,
        permissions: status,
      });
    }

    // 2. Notification banner test
    if (action === 'test' || action === 'banner') {
      const bannerOk = await showMacOSNotification(title, message, 'Glass');
      return NextResponse.json({
        success: true,
        bannerShown: bannerOk,
        message: bannerOk
          ? 'Native macOS notification chime triggered!'
          : 'Could not trigger native macOS banner.',
      });
    }

    // 3. Apple Reminder creation via EventKit
    if (action === 'reminder') {
      const result = await createAppleReminder({
        title,
        dueAt: dueAt || new Date(Date.now() + 5 * 60 * 1000),
        notes: notes || message,
        priority: priority ?? 0,
      });
      return NextResponse.json({
        success: result.success,
        reminderId: result.reminderId,
        error: result.error,
        message: result.success
          ? 'Apple Reminder created via EventKit! Syncs across iPhone & Apple Watch via iCloud.'
          : result.error,
      });
    }

    // 4. Apple Calendar event creation via EventKit
    if (action === 'calendar') {
      const start = startAt || dueAt || new Date(Date.now() + 15 * 60 * 1000);
      const end = endAt || new Date(new Date(start).getTime() + 30 * 60 * 1000);
      const result = await createAppleCalendarEvent({
        title,
        startAt: start,
        endAt: end,
        location,
        notes: notes || message,
      });
      return NextResponse.json({
        success: result.success,
        eventId: result.eventId,
        error: result.error,
        message: result.success
          ? 'Apple Calendar event created via EventKit! Syncs across iPhone & Apple Watch via iCloud.'
          : result.error,
      });
    }

    // 5. Complete Apple Reminder
    if (action === 'reminder_complete') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Reminder ID is required' }, { status: 400 });
      }
      const result = await completeAppleReminder(id);
      return NextResponse.json(result);
    }

    // 6. Delete Apple Reminder
    if (action === 'reminder_delete') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Reminder ID is required' }, { status: 400 });
      }
      const result = await deleteAppleReminder(id);
      return NextResponse.json(result);
    }

    // 7. Delete Apple Calendar Event
    if (action === 'calendar_delete') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Event ID is required' }, { status: 400 });
      }
      const result = await deleteAppleCalendarEvent(id);
      return NextResponse.json(result);
    }

    // 8. Bark iOS Push
    if (action === 'bark') {
      const result = await sendBarkPush({
        key: barkKey || process.env.BARK_KEY,
        title,
        body: message,
      });
      return NextResponse.json({
        success: result.success,
        error: result.error,
        message: result.success
          ? 'Bark push delivered directly to iPhone & Apple Watch!'
          : result.error,
      });
    }

    // 9. Dispatch All
    if (action === 'dispatch_all') {
      const results = await dispatchAppleNotification({
        title,
        body: message,
        dueAt,
      });
      return NextResponse.json({
        success: true,
        results,
        message: 'Dispatched to all Apple notification channels (Mac, iPhone, Apple Watch).',
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action "${action}"` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
