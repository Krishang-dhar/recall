import { NextRequest, NextResponse } from 'next/server';
import { getCalendarEvents } from '@/lib/google/calendar';

export async function GET(req: NextRequest) {
  const sessionMode = req.headers.get('x-session-mode') || 'guest';
  if (sessionMode === 'guest') {
    return NextResponse.json({ success: true, events: [] });
  }

  try {
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin') || undefined;
    const timeMax = searchParams.get('timeMax') || undefined;

    const result = await getCalendarEvents({ timeMin, timeMax });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
