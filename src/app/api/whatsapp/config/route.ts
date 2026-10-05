import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  if (req.headers.get('x-session-mode') === 'guest') {
    return NextResponse.json({
      configured: false,
      hasToken: false,
      tokenPreview: '',
      phoneNumberId: '',
      recipient: '',
      isExpired: false,
      validationError: null,
    });
  }

  const token = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId =
    process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const recipient =
    process.env.META_WHATSAPP_RECIPIENT || process.env.WHATSAPP_RECIPIENT_PHONE_NUMBER || '';

  let isExpired = false;
  let validationError: string | null = null;

  if (token) {
    try {
      // Test querying phone number metadata with token
      const res = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) {
        if (data.error.code === 190) {
          isExpired = true;
          validationError =
            'Meta WhatsApp token has expired (24-hour temporary token). Please generate a new token in Meta Developer Portal.';
        } else {
          validationError = data.error.message || 'Token validation error';
        }
      }
    } catch (e: any) {
      validationError = e.message || 'Network error checking token';
    }
  }

  return NextResponse.json({
    configured: Boolean(token && phoneNumberId && recipient),
    hasToken: Boolean(token),
    tokenPreview: token ? `${token.slice(0, 8)}...${token.slice(-6)}` : '',
    phoneNumberId,
    recipient,
    isExpired,
    validationError,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, phoneNumberId, recipient } = body;

    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    if (token && typeof token === 'string') {
      const cleanToken = token.trim();
      process.env.META_WHATSAPP_TOKEN = cleanToken;
      process.env.WHATSAPP_ACCESS_TOKEN = cleanToken;

      if (envContent.includes('META_WHATSAPP_TOKEN=')) {
        envContent = envContent.replace(
          /META_WHATSAPP_TOKEN=.*(\r?\n|$)/,
          `META_WHATSAPP_TOKEN=${cleanToken}\n`
        );
      } else {
        envContent += `\nMETA_WHATSAPP_TOKEN=${cleanToken}\n`;
      }
    }

    if (phoneNumberId && typeof phoneNumberId === 'string') {
      const cleanPhoneId = phoneNumberId.trim();
      process.env.META_WHATSAPP_PHONE_NUMBER_ID = cleanPhoneId;
      process.env.WHATSAPP_PHONE_NUMBER_ID = cleanPhoneId;

      if (envContent.includes('META_WHATSAPP_PHONE_NUMBER_ID=')) {
        envContent = envContent.replace(
          /META_WHATSAPP_PHONE_NUMBER_ID=.*(\r?\n|$)/,
          `META_WHATSAPP_PHONE_NUMBER_ID=${cleanPhoneId}\n`
        );
      } else {
        envContent += `\nMETA_WHATSAPP_PHONE_NUMBER_ID=${cleanPhoneId}\n`;
      }
    }

    if (recipient && typeof recipient === 'string') {
      const cleanRecipient = recipient.replace(/\D/g, '');
      process.env.META_WHATSAPP_RECIPIENT = cleanRecipient;
      process.env.WHATSAPP_RECIPIENT_PHONE_NUMBER = cleanRecipient;

      if (envContent.includes('META_WHATSAPP_RECIPIENT=')) {
        envContent = envContent.replace(
          /META_WHATSAPP_RECIPIENT=.*(\r?\n|$)/,
          `META_WHATSAPP_RECIPIENT=${cleanRecipient}\n`
        );
      } else {
        envContent += `\nMETA_WHATSAPP_RECIPIENT=${cleanRecipient}\n`;
      }
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    // Validate new token with Meta Graph API
    const activeToken = process.env.META_WHATSAPP_TOKEN;
    const activePhoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

    let valid = true;
    let message = 'WhatsApp configuration saved.';
    let errorDetail = null;

    if (activeToken && activePhoneId) {
      try {
        const testRes = await fetch(`https://graph.facebook.com/v25.0/${activePhoneId}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        const testData = await testRes.json();
        if (testData.error) {
          valid = false;
          errorDetail = testData.error.message || 'Token rejected by Meta';
          message = `Saved to .env.local, but Meta returned: ${errorDetail}`;
        } else {
          message = 'WhatsApp token verified and saved successfully!';
        }
      } catch (e: any) {
        message = `Saved to .env.local, but could not verify with Meta: ${e.message}`;
      }
    }

    return NextResponse.json({
      success: true,
      valid,
      message,
      errorDetail,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update WhatsApp configuration' },
      { status: 500 }
    );
  }
}
