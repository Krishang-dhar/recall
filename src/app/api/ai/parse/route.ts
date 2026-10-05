import { NextRequest, NextResponse } from 'next/server';
import { parseNaturalLanguageTask } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { prompt, referenceTime, timeZone } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const parsed = await parseNaturalLanguageTask(
      prompt,
      referenceTime,
      timeZone
    );

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('API parse error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
