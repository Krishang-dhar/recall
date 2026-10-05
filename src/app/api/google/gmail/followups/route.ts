import { NextRequest, NextResponse } from 'next/server';
import { findPotentialFollowUps, searchEmails } from '@/lib/google/gmail';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    if (q) {
      const searchRes = await searchEmails(q, 6);
      return NextResponse.json(searchRes);
    }

    const followUps = await findPotentialFollowUps();
    return NextResponse.json(followUps);
  } catch (err: any) {
    return NextResponse.json(
      { connected: false, error: err.message, suggestions: [] },
      { status: 500 }
    );
  }
}
