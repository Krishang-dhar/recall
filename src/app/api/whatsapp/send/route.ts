import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, dueText = 'Due now', note } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Task title is required' },
        { status: 400 }
      );
    }

    // WhatsApp integration is currently disabled
    return NextResponse.json({
      success: false,
      disabled: true,
      error: 'WhatsApp reminders are currently disabled.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
