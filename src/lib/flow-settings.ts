export interface FlowDictionaryTerm {
  id: string;
  term: string;
  category: 'name' | 'company' | 'product' | 'tech' | 'custom';
}

export interface RecallFlowSettings {
  enabled: boolean;
  shortcut: string;
  launchAtLogin: boolean;
  floatingOrbEnabled: boolean;
  autoInsert: boolean;
  autoCopyFallback: boolean;
  showTranscript: boolean;
  inputLanguage: string; // 'auto' | 'en' | 'hi' | 'es' | 'fr' | 'de' | 'ja' | 'it' | 'pt' | 'hinglish'
  outputLanguage: string; // 'auto' | 'same' | 'en' | 'hi' | 'es' | 'fr' | 'de' | 'ja'
  style: 'natural' | 'professional' | 'casual' | 'concise' | 'exact' | 'custom';
  customStylePrompt: string;
  smartTranscription: {
    removeFillers: boolean;
    smartPunctuation: boolean;
    selfCorrection: boolean;
    smartFormatting: boolean;
    numbersAndDates: boolean;
    contextAwareness: boolean;
    dictionaryPriority: boolean;
  };
  dictionary: FlowDictionaryTerm[];
  inputSettings: {
    selectedMicrophone: string;
    noiseHandling: boolean;
    silenceDetectionSeconds: number; // e.g. 1.2
    autoFinishAfterSpeaking: boolean;
    sensitivity: 'high' | 'balanced' | 'precise';
  };
  advanced: {
    audioSampleRate: number;
    bufferLengthMs: number;
    clipboardLatencyMs: number;
    geminiEndpoint: string;
  };
}

export const DEFAULT_FLOW_SETTINGS: RecallFlowSettings = {
  enabled: true,
  shortcut: 'Option + Space',
  launchAtLogin: true,
  floatingOrbEnabled: true,
  autoInsert: true,
  autoCopyFallback: true,
  showTranscript: true,
  inputLanguage: 'auto',
  outputLanguage: 'auto',
  style: 'natural',
  customStylePrompt: 'Clean bullet points, concise executive summaries',
  smartTranscription: {
    removeFillers: true,
    smartPunctuation: true,
    selfCorrection: true,
    smartFormatting: true,
    numbersAndDates: true,
    contextAwareness: true,
    dictionaryPriority: true,
  },
  dictionary: [
    { id: '1', term: 'Novelle', category: 'product' },
    { id: '2', term: 'RePixelX', category: 'company' },
    { id: '3', term: 'Kriyon', category: 'name' },
    { id: '4', term: 'Recall AI', category: 'company' },
    { id: '5', term: 'Supabase', category: 'tech' },
  ],
  inputSettings: {
    selectedMicrophone: 'default',
    noiseHandling: true,
    silenceDetectionSeconds: 1.2,
    autoFinishAfterSpeaking: true,
    sensitivity: 'balanced',
  },
  advanced: {
    audioSampleRate: 16000,
    bufferLengthMs: 250,
    clipboardLatencyMs: 50,
    geminiEndpoint: 'gemini-3.8-flash',
  },
};

const STORAGE_KEY = 'recall_flow_settings';

export function getFlowSettings(): RecallFlowSettings {
  if (typeof window === 'undefined') return DEFAULT_FLOW_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLOW_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_FLOW_SETTINGS,
      ...parsed,
      smartTranscription: {
        ...DEFAULT_FLOW_SETTINGS.smartTranscription,
        ...(parsed.smartTranscription || {}),
      },
      inputSettings: {
        ...DEFAULT_FLOW_SETTINGS.inputSettings,
        ...(parsed.inputSettings || {}),
      },
      advanced: {
        ...DEFAULT_FLOW_SETTINGS.advanced,
        ...(parsed.advanced || {}),
      },
      dictionary: Array.isArray(parsed.dictionary) ? parsed.dictionary : DEFAULT_FLOW_SETTINGS.dictionary,
    };
  } catch (err) {
    console.warn('Failed to parse recall_flow_settings from localStorage:', err);
    return DEFAULT_FLOW_SETTINGS;
  }
}

export function saveFlowSettings(updates: Partial<RecallFlowSettings>): RecallFlowSettings {
  if (typeof window === 'undefined') return DEFAULT_FLOW_SETTINGS;
  try {
    const current = getFlowSettings();
    const updated: RecallFlowSettings = {
      ...current,
      ...updates,
      smartTranscription: {
        ...current.smartTranscription,
        ...(updates.smartTranscription || {}),
      },
      inputSettings: {
        ...current.inputSettings,
        ...(updates.inputSettings || {}),
      },
      advanced: {
        ...current.advanced,
        ...(updates.advanced || {}),
      },
      dictionary: updates.dictionary || current.dictionary,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('recall-flow-settings-changed', { detail: updated }));
    return updated;
  } catch (err) {
    console.error('Failed to save recall_flow_settings:', err);
    return DEFAULT_FLOW_SETTINGS;
  }
}
