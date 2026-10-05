import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, saveGoogleTokens } from '@/lib/google/oauth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state') || '/connections';

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

    return NextResponse.redirect(new URL(`${state}?connected=google`, req.url));
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
