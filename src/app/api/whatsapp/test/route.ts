import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppText } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const result = await sendWhatsAppText({
      title: 'Send Novelle quotation',
      dueText: 'Due now',
      note: 'Your requested Recall reminder test',
      allowFallbackTemplate: false,
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send test WhatsApp reminder' },
      { status: 500 }
    );
  }
}
