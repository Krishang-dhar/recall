import { NextRequest, NextResponse } from 'next/server';
import { createCalendarEvent } from '@/lib/google/calendar';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, start, end, location, description } = body;

    if (!title || !start) {
      return NextResponse.json(
        { success: false, error: 'Title and start time are required' },
        { status: 400 }
      );
    }

    const result = await createCalendarEvent({
      title,
      start,
      end,
      location,
      description,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      htmlLink: result.htmlLink,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
