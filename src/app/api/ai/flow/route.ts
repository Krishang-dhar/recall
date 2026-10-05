import { NextRequest, NextResponse } from 'next/server';
import { processRecallFlowInput } from '@/lib/recall-flow';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await processRecallFlowInput(body);

    return NextResponse.json(
      { success: true, ...result },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('API /api/ai/flow error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
