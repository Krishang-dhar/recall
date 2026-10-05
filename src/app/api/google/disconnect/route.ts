import { NextResponse } from 'next/server';
import { disconnectGoogle } from '@/lib/google/oauth';

export async function POST() {
  try {
    await disconnectGoogle();
    return NextResponse.json({ success: true, message: 'Google account disconnected.' });
  } catch (err: any) {
    console.error('Google disconnect error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to disconnect Google' },
      { status: 500 }
    );
  }
}
