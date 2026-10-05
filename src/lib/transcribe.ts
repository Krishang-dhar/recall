import { GoogleGenAI } from '@google/genai';

/**
 * Server-side speech-to-text transcriber for Recall.
 * Isolated behind transcribeAudio(audioBuffer, mimeType).
 * 
 * Supports:
 * - English
 * - Hindi (Devanagari or Romanized)
 * - Hinglish (mixed natural Hindi + English phrasing like "Kal 4 baje Novelle ko quotation send karna hai")
 * Preserves spoken phrasing accurately without artificial script translations.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = 'audio/webm'
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  const modelName = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

  if (apiKey && !apiKey.includes('placeholder')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const base64Data = audioBuffer.toString('base64');

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: `
You are the shared speech transcription engine for "Recall" — an intelligent voice typing and work reminder system.
Transcribe the user's voice recording with maximum accuracy.

Guidelines:
1. Automatically detect the spoken language: English, Hindi, or natural mixed Hinglish.
2. Accurately transcribe names of colleagues, brands, and places without dropping or butchering them:
   - Names: "Rahul", "Rohan", "Priya", "Amit", "Nishakar", "Vikram", "Neha", etc.
   - Companies/Brands/Places: "Prem Sweets", "Novelle", "Gandhi Nagar", "Connaught Place", "Bandra", etc.
3. Accurately transcribe work terminology:
   - "proposal", "pitch deck", "quotation", "invoice", "slides", "sync", "meeting", "calendar", "reminder", "follow-up", "deadline".
4. If the user dictates in Hinglish (e.g. "Rahul ko bol proposal kal bhej dunga", "Prem Sweets ko call karna hai kal 4 baje", "team ko bol do meeting 3 baje shift ho gayi hai"):
   - Transcribe it faithfully in natural Romanized Hinglish or mixed words exactly as spoken.
5. If the audio is silent, background static, or unintelligible, output [EMPTY].
6. Output ONLY the raw transcription string. Do not add quotes, markdown formatting, explanations, or assistant commentary.
`,
              },
            ],
          },
        ],
      });

      const transcription = response.text?.trim();
      if (transcription && !transcription.includes('[EMPTY]')) {
        return transcription.replace(/^["']|["']$/g, '').trim();
      }
    } catch (err) {
      console.error('Gemini audio transcription error:', err);
    }
  }

  // Graceful empty fallback when audio cannot be transcribed
  return '';
}
