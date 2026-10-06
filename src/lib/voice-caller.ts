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

export async function triggerVoiceReminder(
  _options: VoiceReminderOptions
): Promise<VoiceReminderResult> {
  // Voice notification is disabled per user preference
  return {
    success: false,
    method: 'none',
    message: 'Voice reminders disabled.',
  };
}
