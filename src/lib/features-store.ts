export interface FeatureToggleItem {
  id: string;
  section:
    | 'Core Recall Tools'
    | 'Recall Flow'
    | 'Calendar'
    | 'Gmail'
    | 'Drive'
    | 'Reminders'
    | 'Search & Memory'
    | 'Automations'
    | 'Integrations & Plugins'
    | 'Experimental Features';
  name: string;
  description: string;
  iconName: string;
  defaultEnabled: boolean;
  requiresIntegration?: 'google' | 'whatsapp' | 'mac';
  badge?: string;
  configHref?: string;
}

export const RECALL_FEATURES: FeatureToggleItem[] = [
  // 1. Core Recall Tools
  {
    id: 'core_tasks',
    section: 'Core Recall Tools',
    name: 'Task Manager',
    description: 'Autonomous creation, rescheduling, and day timeline integration.',
    iconName: 'check-square',
    defaultEnabled: true,
  },
  {
    id: 'core_day_planner',
    section: 'Core Recall Tools',
    name: 'AI Day Planner',
    description: 'Conflict-aware day optimization with realistic buffers.',
    iconName: 'calendar',
    defaultEnabled: true,
  },
  {
    id: 'core_focus',
    section: 'Core Recall Tools',
    name: 'Focus Mode',
    description: 'Spotlights your highest-leverage task for deep work.',
    iconName: 'target',
    defaultEnabled: true,
  },
  {
    id: 'core_undo',
    section: 'Core Recall Tools',
    name: 'Action Undo',
    description: 'One-click reversible audit history for any action.',
    iconName: 'rotate-ccw',
    defaultEnabled: true,
  },

  // 2. Recall Flow
  {
    id: 'flow_enabled',
    section: 'Recall Flow',
    name: 'Voice Layer',
    description: 'Option + Space global dictation across macOS.',
    iconName: 'mic',
    defaultEnabled: true,
    requiresIntegration: 'mac',
    badge: '⌥ Space',
    configHref: '/settings?tab=flow',
  },
  {
    id: 'flow_auto_paste',
    section: 'Recall Flow',
    name: 'Direct Auto-Paste',
    description: 'Pastes cleaned speech directly into active text field.',
    iconName: 'arrow-down-to-line',
    defaultEnabled: true,
    requiresIntegration: 'mac',
  },
  {
    id: 'flow_auto_mode',
    section: 'Recall Flow',
    name: 'Auto-Inferred Modes',
    description: 'Auto-detects Write dictation vs Action scheduling.',
    iconName: 'sliders',
    defaultEnabled: true,
  },

  // 3. Calendar
  {
    id: 'calendar_sync',
    section: 'Calendar',
    name: 'Calendar 2-Way Sync',
    description: 'Live bidirectional sync with Google Calendar.',
    iconName: 'calendar',
    defaultEnabled: true,
    requiresIntegration: 'google',
    configHref: '/settings?tab=connections',
  },
  {
    id: 'calendar_buffering',
    section: 'Calendar',
    name: 'Smart Buffers',
    description: 'Inserts 15m travel or prep buffer before meetings.',
    iconName: 'clock',
    defaultEnabled: true,
  },

  // 4. Gmail
  {
    id: 'gmail_context',
    section: 'Gmail',
    name: 'Email Context',
    description: 'Scans inbox for meeting invites, Zoom links, and notes.',
    iconName: 'mail',
    defaultEnabled: true,
    requiresIntegration: 'google',
    configHref: '/settings?tab=connections',
  },
  {
    id: 'gmail_actions',
    section: 'Gmail',
    name: 'Mail Actions',
    description: 'Archive and manage email via natural voice instructions.',
    iconName: 'archive',
    defaultEnabled: true,
    requiresIntegration: 'google',
  },

  // 5. Drive
  {
    id: 'drive_search',
    section: 'Drive',
    name: 'Drive Search',
    description: 'Instant search across Google Docs, Sheets, and PDFs.',
    iconName: 'folder',
    defaultEnabled: true,
    requiresIntegration: 'google',
    configHref: '/settings?tab=connections',
  },

  // 6. Reminders
  {
    id: 'reminder_smart_lead',
    section: 'Reminders',
    name: 'Smart Lead Times',
    description: 'Calculates alerts (10m Zoom, 30m local, 60m in-person).',
    iconName: 'bell',
    defaultEnabled: true,
  },
  {
    id: 'reminder_whatsapp',
    section: 'Reminders',
    name: 'WhatsApp Dispatch',
    description: 'Delivers scheduled alerts directly to WhatsApp.',
    iconName: 'message-circle',
    defaultEnabled: true,
    requiresIntegration: 'whatsapp',
    configHref: '/settings?tab=notifications',
  },

  // 7. Search & Memory
  {
    id: 'search_universal',
    section: 'Search & Memory',
    name: 'Universal Search',
    description: 'Fuzzy search across tasks, events, and notes.',
    iconName: 'search',
    defaultEnabled: true,
    badge: '⌘K',
  },
  {
    id: 'search_context_memory',
    section: 'Search & Memory',
    name: 'Conversational Memory',
    description: 'Maintains context across consecutive instructions.',
    iconName: 'cpu',
    defaultEnabled: true,
  },

  // 8. Automations
  {
    id: 'automation_briefing',
    section: 'Automations',
    name: 'Morning Briefing',
    description: 'Daily agenda and priority breakdown on first launch.',
    iconName: 'sun',
    defaultEnabled: true,
  },
  {
    id: 'automation_conflict_resolve',
    section: 'Automations',
    name: 'Conflict Resolver',
    description: 'Auto-detects overlaps and proposes alternate slots.',
    iconName: 'shield',
    defaultEnabled: true,
  },

  // 9. Integrations / Plugins
  {
    id: 'plugin_google',
    section: 'Integrations & Plugins',
    name: 'Google Workspace',
    description: 'Connected Calendar, Gmail, and Drive sync.',
    iconName: 'globe',
    defaultEnabled: true,
    requiresIntegration: 'google',
    configHref: '/settings?tab=connections',
  },
  {
    id: 'plugin_whatsapp',
    section: 'Integrations & Plugins',
    name: 'WhatsApp API',
    description: 'Automated notification and alert dispatch channel.',
    iconName: 'message-circle',
    defaultEnabled: true,
    requiresIntegration: 'whatsapp',
    configHref: '/settings?tab=notifications',
  },

  // 10. Experimental Features
  {
    id: 'exp_nlp_time_shift',
    section: 'Experimental Features',
    name: 'Dynamic Time Shifting',
    description: 'Shifts subsequent tasks when a meeting runs over.',
    iconName: 'zap',
    defaultEnabled: true,
    badge: 'Beta',
  },
  {
    id: 'exp_ambient_waveform',
    section: 'Experimental Features',
    name: 'Fluid Gradient Orb',
    description: 'Apple-grade canvas orb animation during voice capture.',
    iconName: 'activity',
    defaultEnabled: true,
    badge: 'Lab',
  },
];

const STORAGE_KEY = 'recall-tools-features-state';

export function getFeaturesState(): Record<string, boolean> {
  if (typeof window === 'undefined') {
    return RECALL_FEATURES.reduce((acc, f) => ({ ...acc, [f.id]: f.defaultEnabled }), {});
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return RECALL_FEATURES.reduce((acc, f) => ({ ...acc, [f.id]: f.defaultEnabled }), {});
    }
    const parsed = JSON.parse(raw);
    return RECALL_FEATURES.reduce((acc, f) => ({
      ...acc,
      [f.id]: typeof parsed[f.id] === 'boolean' ? parsed[f.id] : f.defaultEnabled,
    }), {});
  } catch {
    return RECALL_FEATURES.reduce((acc, f) => ({ ...acc, [f.id]: f.defaultEnabled }), {});
  }
}

export function setFeatureEnabled(featureId: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  const current = getFeaturesState();
  current[featureId] = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new CustomEvent('recall-features-changed', {
        detail: { featureId, enabled, all: current },
      })
    );
  } catch (e) {
    console.warn('Could not save feature toggle', e);
  }
}
