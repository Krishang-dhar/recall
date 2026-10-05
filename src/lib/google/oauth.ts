import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const DATA_DIR = path.join(process.cwd(), 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'google-tokens.json');

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.readonly',
];

function ensureTokensStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

  if (!clientId || !clientSecret || clientSecret.trim() === '') {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function saveGoogleTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  ensureTokensStorage();
  try {
    const data = {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local Google tokens:', err);
  }
}

export async function getGoogleTokens(): Promise<{
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
} | null> {
  ensureTokensStorage();
  if (!fs.existsSync(TOKENS_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.access_token || parsed.refresh_token)) {
      return parsed;
    }
  } catch (e) {
    console.error('Error reading local Google tokens:', e);
  }
  return null;
}

export async function disconnectGoogle(): Promise<void> {
  ensureTokensStorage();
  if (fs.existsSync(TOKENS_FILE)) {
    try {
      fs.unlinkSync(TOKENS_FILE);
    } catch (e) {}
  }
}

export async function getAuthenticatedOAuthClient() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  const tokens = await getGoogleTokens();
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    return null;
  }

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  return oauth2Client;
}
