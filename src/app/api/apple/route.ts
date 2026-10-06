import { NextRequest, NextResponse } from 'next/server';
import {
  isMacOS,
  showMacOSNotification,
  createAppleReminder,
  createAppleCalendarEvent,
  sendBarkPush,
  dispatchAppleNotification,
} from '@/lib/apple-notifications';

export async function GET() {
  const isMac = isMacOS();
  const hasBark = Boolean(process.env.BARK_KEY && process.env.BARK_KEY.trim().length > 0);

  return NextResponse.json({
    success: true,
    isMacOS: isMac,
    features: {
      macNotificationBanner: isMac,
      appleRemindersICloud: isMac,
      appleCalendarICloud: isMac,
      barkIOSPush: hasBark,
    },
    message: isMac
      ? 'Apple Ecosystem Active: Native Mac notifications and iCloud sync to iPhone/Apple Watch enabled.'
      : 'Non-macOS environment. iOS Web Push and Bark available.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'test', title = 'Recall Reminder', message = 'Testing Apple notification sync', dueAt, barkKey } = body;

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

    if (action === 'reminder') {
      const result = await createAppleReminder({
        title,
        dueAt: dueAt || new Date(Date.now() + 5 * 60 * 1000),
        notes: message,
      });
      return NextResponse.json({
        success: result.success,
        reminderId: result.reminderId,
        error: result.error,
        message: result.success
          ? 'Apple Reminder created! Syncs to iPhone & Apple Watch via iCloud.'
          : result.error,
      });
    }

    if (action === 'calendar') {
      const start = dueAt ? new Date(dueAt) : new Date(Date.now() + 15 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const result = await createAppleCalendarEvent({
        title,
        startAt: start,
        endAt: end,
        notes: message,
      });
      return NextResponse.json({
        success: result.success,
        eventId: result.eventId,
        error: result.error,
        message: result.success
          ? 'Apple Calendar event created! Syncs to iPhone & Apple Watch via iCloud.'
          : result.error,
      });
    }

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
