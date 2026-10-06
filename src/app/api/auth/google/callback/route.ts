import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, saveGoogleTokens } from '@/lib/google/oauth';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state') || '/';

  if (error) {
    return NextResponse.redirect(
      new URL(`${state}?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`${state}?error=missing_code`, req.url)
    );
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return NextResponse.redirect(
      new URL(`${state}?error=oauth_not_configured`, req.url)
    );
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    await saveGoogleTokens(tokens);

    let userEmail = '';
    let userName = '';
    try {
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      userEmail = profile.data.emailAddress || '';
      if (userEmail) {
        const usernamePart = userEmail.split('@')[0];
        userName = usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1);
      }
    } catch (e) {
      console.warn('Could not fetch Gmail profile during OAuth callback:', e);
    }

    const redirectUrl = new URL(state, req.url);
    redirectUrl.searchParams.set('connected', 'google');
    redirectUrl.searchParams.set('mode', 'google');
    if (userEmail) redirectUrl.searchParams.set('email', userEmail);
    if (userName) redirectUrl.searchParams.set('name', userName);

    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error('Error exchanging Google authorization code:', err);
    return NextResponse.redirect(
      new URL(
        `${state}?error=${encodeURIComponent(err.message || 'token_exchange_failed')}`,
        req.url
      )
    );
  }
}
