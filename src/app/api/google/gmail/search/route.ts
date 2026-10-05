import { NextRequest, NextResponse } from 'next/server';
import { searchEmails } from '@/lib/google/gmail';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || 'category:primary';
    const max = parseInt(searchParams.get('max') || '8', 10);

    const result = await searchEmails(q, max);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to search emails' },
      { status: 500 }
    );
  }
}
