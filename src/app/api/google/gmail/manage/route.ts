import { NextRequest, NextResponse } from 'next/server';
import { archiveEmail, trashEmail, untrashEmail, unarchiveEmail, markEmailRead } from '@/lib/google/gmail';

export async function POST(req: NextRequest) {
  try {
    const { action, messageId, subject, read } = await req.json();

    if (!action || !messageId) {
      return NextResponse.json(
        { success: false, error: 'action and messageId are required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'archive': {
        const result = await archiveEmail(messageId, subject);
        return NextResponse.json(result);
      }
      case 'unarchive': {
        const result = await unarchiveEmail(messageId);
        return NextResponse.json(result);
      }
      case 'trash': {
        const result = await trashEmail(messageId, subject);
        return NextResponse.json(result);
      }
      case 'untrash': {
        const result = await untrashEmail(messageId);
        return NextResponse.json(result);
      }
      case 'markRead': {
        const result = await markEmailRead(messageId, read !== false, subject);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
