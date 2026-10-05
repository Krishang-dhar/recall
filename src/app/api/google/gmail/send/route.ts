import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/google/gmail';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { success: false, error: 'Recipient (to), subject, and body are required' },
        { status: 400 }
      );
    }

    const result = await sendEmail({ to, subject, body });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          needsScope: result.needsScope,
          error: result.error,
        },
        { status: result.needsScope ? 403 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
