import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, GOOGLE_SCOPES } from '@/lib/google/oauth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo') || '/';

  const oauth2Client = getOAuth2Client();

  if (!oauth2Client) {
    return NextResponse.redirect(
      new URL(`${returnTo}?error=google_not_configured`, req.url)
    );
  }

  // Generate OAuth consent URL requesting minimal offline access for refresh token
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state: returnTo,
  });

  return NextResponse.redirect(authUrl);
}
