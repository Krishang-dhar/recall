import { NextRequest, NextResponse } from 'next/server';
import { deleteCalendarEvent, deleteCalendarEvents } from '@/lib/google/calendar';
import { getCalendarEvents } from '@/lib/google/calendar';

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, eventIds } = body;

    if (eventIds && Array.isArray(eventIds)) {
      // Bulk delete
      const result = await deleteCalendarEvents(eventIds);
      return NextResponse.json(result);
    }

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'eventId or eventIds is required' },
        { status: 400 }
      );
    }

    const result = await deleteCalendarEvent(eventId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}

/** GET /api/google/calendar/delete?date=2024-01-15 — fetch events for a date (for preview) */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get('date');

    let timeMin: string | undefined;
    let timeMax: string | undefined;

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      timeMin = d.toISOString();
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      timeMax = end.toISOString();
    }

    const result = await getCalendarEvents({ timeMin, timeMax });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
