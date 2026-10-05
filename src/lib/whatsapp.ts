export interface SendWhatsAppTextOptions {
  title: string;
  dueText?: string;
  note?: string | null;
  allowFallbackTemplate?: boolean;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  mode?: 'text' | 'template_fallback';
  error?: string;
  metaRawError?: any;
}

/**
 * Sends a real free-form WhatsApp text message via Meta Graph API
 * during the 24-hour customer care / conversation window.
 *
 * Payload format:
 * {
 *   "messaging_product": "whatsapp",
 *   "to": "<recipient>",
 *   "type": "text",
 *   "text": {
 *     "body": "Recall Reminder\n\n<title>\nDue: <dueText>"
 *   }
 * }
 */
export async function sendWhatsAppText(
  options: SendWhatsAppTextOptions
): Promise<SendWhatsAppResult> {
  const token = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId =
    process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient =
    process.env.META_WHATSAPP_RECIPIENT || process.env.WHATSAPP_RECIPIENT_PHONE_NUMBER;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0';

  if (!token || token.trim() === '' || token.includes('PASTE_NEW_TOKEN_HERE')) {
    return {
      success: false,
      error: 'META_WHATSAPP_TOKEN is not configured in .env.local',
    };
  }

  if (!phoneNumberId) {
    return {
      success: false,
      error: 'META_WHATSAPP_PHONE_NUMBER_ID is not configured in .env.local',
    };
  }

  if (!recipient) {
    return {
      success: false,
      error: 'META_WHATSAPP_RECIPIENT is not configured in .env.local',
    };
  }

  const cleanRecipient = recipient.replace(/\D/g, '');
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  const dueLabel = options.dueText ? `Due: ${options.dueText}` : 'Due now';
  const noteSection = options.note?.trim() ? `\n\n${options.note.trim()}` : '';
  const bodyText = `Recall Reminder\n\n${options.title}${noteSection}\n${dueLabel}`;

  // 1. Attempt free-form text message
  const textPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanRecipient,
    type: 'text',
    text: {
      preview_url: false,
      body: bodyText,
    },
  };

  try {
    console.log(`[WhatsApp API] Attempting free-form text message: "${options.title}" -> ${cleanRecipient}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(textPayload),
    });

    const data = await response.json();

    if (response.ok && data.messages?.[0]?.id) {
      console.log(`[WhatsApp API] Free-form text delivered successfully. Message ID: ${data.messages[0].id}`);
      return {
        success: true,
        mode: 'text',
        messageId: data.messages[0].id,
      };
    }

    const errorDetails = data.error || {};
    let errorMsg =
      errorDetails.message || 'Meta WhatsApp API rejected the free-form text message.';
    if (errorDetails.code === 190) {
      errorMsg =
        'Meta WhatsApp Token expired (Session expired). Please generate a new temporary token from Meta Developer Portal or update your Permanent System User Token.';
    }
    console.warn('[WhatsApp API] Free-form text rejected by Meta:', errorDetails);

    // 2. Fallback to hello_world ONLY if explicitly allowed
    if (options.allowFallbackTemplate) {
      console.log('[WhatsApp API] Explicit fallback template allowed. Sending hello_world...');
      const fallbackTemplateName = process.env.META_WHATSAPP_TEMPLATE_NAME || 'hello_world';
      const templatePayload = {
        messaging_product: 'whatsapp',
        to: cleanRecipient,
        type: 'template',
        template: {
          name: fallbackTemplateName,
          language: { code: 'en_US' },
        },
      };

      const templateRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });

      const templateData = await templateRes.json();
      if (templateRes.ok && templateData.messages?.[0]?.id) {
        return {
          success: true,
          mode: 'template_fallback',
          messageId: templateData.messages[0].id,
        };
      }
    }

    // Do NOT silently pretend success; return actual Meta error
    return {
      success: false,
      error: errorMsg,
      metaRawError: errorDetails,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error connecting to Meta WhatsApp API',
    };
  }
}

/**
 * Backward compatible wrapper for reminder dispatching
 */
export async function sendWhatsAppReminder(options: {
  title: string;
  dueText?: string;
  note?: string | null;
  allowFallbackTemplate?: boolean;
}): Promise<SendWhatsAppResult> {
  return sendWhatsAppText(options);
}
