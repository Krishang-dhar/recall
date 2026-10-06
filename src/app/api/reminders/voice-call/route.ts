import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Voice reminder disabled per user preference.',
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'disabled',
    message: 'Voice reminders are disabled.',
  });
}
