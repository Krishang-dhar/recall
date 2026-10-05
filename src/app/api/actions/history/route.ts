import { NextRequest, NextResponse } from 'next/server';
import { getRecentActions } from '@/lib/action-history';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const actions = getRecentActions(Math.min(limit, 100));
    return NextResponse.json({ success: true, actions });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
