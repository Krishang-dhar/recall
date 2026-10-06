import { NextRequest, NextResponse } from 'next/server';
import { triggerVoiceReminder } from '@/lib/voice-caller';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = body.title || 'Review your day plan with Recall';
    const note = body.note || null;
    const phone = body.phone || null;

    const result = await triggerVoiceReminder({ title, note, phone });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to place voice reminder' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );

  return NextResponse.json({
    status: 'ready',
    availableMethods: {
      twilioVoiceCall: hasTwilio,
      macNativeVoice: process.platform === 'darwin',
    },
    info: 'Send POST with { "title": "Your task title" } to trigger a voice call or Mac voice reminder.',
  });
}
