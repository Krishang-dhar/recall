import { NextRequest, NextResponse } from 'next/server';
import { disconnectGoogle, getGoogleTokens, getAuthenticatedOAuthClient } from '@/lib/google/oauth';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const tokens = await getGoogleTokens();
  const isGoogleConnected = Boolean(tokens && (tokens.access_token || tokens.refresh_token));
  let userEmail: string | undefined;
  let userName: string | undefined;

  if (isGoogleConnected) {
    try {
      const auth = await getAuthenticatedOAuthClient();
      if (auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        userEmail = profile.data.emailAddress || undefined;
        if (userEmail) {
          const usernamePart = userEmail.split('@')[0];
          userName = usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1);
        }
      }
    } catch (e) {
      console.warn('Error fetching Google user profile:', e);
    }
  }

  return NextResponse.json({
    google: {
      connected: isGoogleConnected,
      calendar: isGoogleConnected,
      gmail: isGoogleConnected,
      email: userEmail || undefined,
      name: userName || (userEmail ? userEmail.split('@')[0] : undefined),
    },
    whatsapp: {
      connected: false,
      disabled: true,
      phoneNumberId: undefined,
      recipient: undefined,
    },
    maps: {
      connected: true,
      mode: 'automatic',
    },
    intelligence: {
      connected: Boolean(
        process.env.GEMINI_API_KEY &&
        !process.env.GEMINI_API_KEY.includes('placeholder')
      ),
      provider: 'Gemini',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === 'disconnect_google') {
      await disconnectGoogle();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
