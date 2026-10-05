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

    const result = await sendWhatsAppText({
      title,
      dueText,
      note,
      allowFallbackTemplate: false, // Strict: do not disguise as hello_world
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          metaRawError: result.metaRawError,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      mode: result.mode,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
