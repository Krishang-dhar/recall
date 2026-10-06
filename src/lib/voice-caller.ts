import { exec } from 'child_process';

interface VoiceReminderOptions {
  title: string;
  note?: string | null;
  phone?: string | null;
}

export interface VoiceReminderResult {
  success: boolean;
  method: 'twilio' | 'macos_speech' | 'none';
  message: string;
  callSid?: string;
  error?: string;
}

/**
 * Triggers an automated voice reminder to the user.
 * Supports:
 * 1. Twilio Voice REST API (Direct mobile phone call using free trial credit)
 * 2. macOS Native Audio & Speech (`say` + `afplay`) 100% free offline on Mac
 */
export async function triggerVoiceReminder(
  options: VoiceReminderOptions
): Promise<VoiceReminderResult> {
  const { title, note, phone } = options;
  const cleanTitle = title.replace(/["'\\]/g, ' ').trim();
  const spokenText = `Hello. This is your Recall reminder: ${cleanTitle}.${note ? ' Note: ' + note.replace(/["'\\]/g, ' ').trim() : ''}`;

  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;
  const targetPhone = phone || process.env.USER_PHONE_NUMBER || process.env.WHATSAPP_TO_PHONE;

  // 1. If Twilio credentials are configured, place real cellular voice call
  if (twilioAccountSid && twilioAuthToken && twilioFromNumber && targetPhone) {
    try {
      const cleanPhone = targetPhone.replace(/\D/g, '');
      const formattedTo = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
      const twiml = `<Response><Pause length="1"/><Say voice="Polly.Aditi" language="en-IN">${spokenText}</Say><Pause length="1"/><Say voice="Polly.Aditi" language="en-IN">Repeating reminder: ${cleanTitle}. Have a productive day.</Say></Response>`;

      const authHeader = 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
      const bodyParams = new URLSearchParams();
      bodyParams.append('To', formattedTo);
      bodyParams.append('From', twilioFromNumber);
      bodyParams.append('Twiml', twiml);

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams.toString(),
        }
      );

      const data = await res.json();
      if (res.ok && data.sid) {
        return {
          success: true,
          method: 'twilio',
          message: `Twilio voice call placed to ${formattedTo}`,
          callSid: data.sid,
        };
      } else {
        console.warn('[Voice Reminder] Twilio call failed:', data.message);
      }
    } catch (e: any) {
      console.warn('[Voice Reminder] Twilio call error:', e.message);
    }
  }

  // 2. macOS Native Voice Alarm (100% Free, local audio chime + clear TTS voice)
  if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      // Plays system alert chime and speaks reminder aloud in high quality
      const command = `osascript -e 'beep 2' 2>/dev/null; say -v "Samantha" "${spokenText}" &`;
      exec(command, (err) => {
        if (!err) {
          resolve({
            success: true,
            method: 'macos_speech',
            message: 'Spoken aloud on your Mac speakers via native voice synthesis',
          });
        } else {
          resolve({
            success: false,
            method: 'none',
            message: 'Failed to trigger Mac voice synthesis',
            error: err.message,
          });
        }
      });
    });
  }

  return {
    success: false,
    method: 'none',
    message: 'No voice calling service configured (Twilio credentials not set).',
  };
}
