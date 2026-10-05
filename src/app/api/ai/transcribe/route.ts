import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/transcribe';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as Blob | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'audio/webm';

    const text = await transcribeAudio(buffer, mimeType);

    return NextResponse.json({
      success: true,
      text,
    });
  } catch (err: any) {
    console.error('Audio transcribe route error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
