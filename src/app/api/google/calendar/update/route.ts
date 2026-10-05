import { NextRequest, NextResponse } from 'next/server';
import { updateCalendarEvent } from '@/lib/google/calendar';

export async function POST(req: NextRequest) {
  try {
    const { eventId, updates } = await req.json();

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'eventId is required' },
        { status: 400 }
      );
    }

    const result = await updateCalendarEvent(eventId, updates || {});
    return NextResponse.json({ ...result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}
