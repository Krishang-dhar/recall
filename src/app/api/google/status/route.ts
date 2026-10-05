import { NextRequest, NextResponse } from 'next/server';
import { disconnectGoogle, getGoogleTokens, getAuthenticatedOAuthClient } from '@/lib/google/oauth';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const sessionMode = req.headers.get('x-session-mode') || 'guest';

  // Guest users must never see connected personal credentials or status
  if (sessionMode === 'guest') {
    return NextResponse.json({
      google: {
        connected: false,
        calendar: false,
        gmail: false,
        email: undefined,
      },
      whatsapp: {
        connected: false,
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

  const tokens = await getGoogleTokens();
  const isGoogleConnected = Boolean(tokens && (tokens.access_token || tokens.refresh_token));
  let userEmail: string | undefined;

  if (isGoogleConnected) {
    try {
      const auth = await getAuthenticatedOAuthClient();
      if (auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        userEmail = profile.data.emailAddress || undefined;
      }
    } catch {
      // Ignore if rate limited or scope missing
    }
  }

  const isWhatsAppConfigured = Boolean(
    process.env.META_WHATSAPP_TOKEN &&
    !process.env.META_WHATSAPP_TOKEN.includes('PASTE_NEW_TOKEN_HERE')
  );

  return NextResponse.json({
    google: {
      connected: isGoogleConnected,
      calendar: isGoogleConnected,
      gmail: isGoogleConnected,
      email: userEmail || undefined,
    },
    whatsapp: {
      connected: isWhatsAppConfigured,
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || undefined,
      recipient: process.env.META_WHATSAPP_RECIPIENT || undefined,
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
