import { NextRequest, NextResponse } from 'next/server';
import { wipeAllData } from '@/lib/local-store';
import { getCalendarEvents, deleteCalendarEvent } from '@/lib/google/calendar';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let isDemoReset = url.searchParams.get('demo') === 'true';
    try {
      const body = await req.json();
      if (body?.demo || body?.safeDemoReset) isDemoReset = true;
    } catch {}

    // 1. Wipe all local stores (tasks, chats, messages, projects, history, attachments)
    const localResult = wipeAllData();

    // 2. Wipe Google Calendar events ONLY if NOT a demo reset (preserve real Google data)
    let deletedCalendarEventsCount = 0;
    if (!isDemoReset) {
      try {
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), 0, 1).toISOString();
        const timeMax = new Date(now.getFullYear() + 1, 11, 31).toISOString();
        const calRes = await getCalendarEvents({ timeMin, timeMax });

        if (calRes.connected && Array.isArray(calRes.events)) {
          for (const ev of calRes.events) {
            const isRecallEvent =
              (ev.description && ev.description.toLowerCase().includes('recall')) ||
              (ev.id && !ev.id.startsWith('_cl6k8') && !ev.id.startsWith('30gqv350')); // preserve user permanent non-recall events

            if (isRecallEvent && ev.id) {
              try {
                await deleteCalendarEvent(ev.id);
                deletedCalendarEventsCount++;
              } catch (e) {
                console.warn(`Failed to delete calendar event ${ev.id}:`, e);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Calendar cleanup error during reset:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'All data deleted across all dates, chats, and tasks.',
      cleared: {
        ...localResult.clearedCount,
        calendarEventsDeleted: deletedCalendarEventsCount,
      },
    });
  } catch (err: any) {
    console.error('Error in reset API route:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete all data' },
      { status: 500 }
    );
  }
}
