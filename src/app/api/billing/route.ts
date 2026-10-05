import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const BILLING_FILE = path.join(DATA_DIR, 'billing.json');

export interface SubscriptionInfo {
  planId: 'personal' | 'pro';
  planName: string;
  priceMonthly: number;
  priceYearly: number;
  interval: 'month' | 'year';
  status: 'active' | 'trialing' | 'canceled';
  trialEndsAt?: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  limits: {
    voiceMinutes: number | 'unlimited';
    reasoningTier: 'balanced' | 'deep';
    multiLanguage: boolean;
    calendarAccounts: number;
    cloudSync: boolean;
    whatsappPriority: boolean;
  };
}

const DEFAULT_BILLING: SubscriptionInfo = {
  planId: 'personal',
  planName: 'Recall Personal',
  priceMonthly: 9.99,
  priceYearly: 99.0,
  interval: 'month',
  status: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancelAtPeriodEnd: false,
  limits: {
    voiceMinutes: 600,
    reasoningTier: 'balanced',
    multiLanguage: true,
    calendarAccounts: 1,
    cloudSync: true,
    whatsappPriority: false,
  },
};

function getBillingData(): SubscriptionInfo {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BILLING_FILE)) {
      fs.writeFileSync(BILLING_FILE, JSON.stringify(DEFAULT_BILLING, null, 2), 'utf-8');
      return DEFAULT_BILLING;
    }
    const raw = fs.readFileSync(BILLING_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return DEFAULT_BILLING;
  }
}

function saveBillingData(data: SubscriptionInfo): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BILLING_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save billing data:', err);
  }
}

export async function GET() {
  const current = getBillingData();
  const tiers = [
    {
      id: 'personal',
      name: 'Recall Personal',
      priceMonthly: 9.99,
      priceYearly: 99.0,
      description: 'Your complete personal AI assistant that listens, writes, remembers, and plans.',
      features: [
        'Full Personal AI Assistant (SAY IT. RECALL HANDLES IT.)',
        'Recall Flow macOS system-wide voice layer (Option + Space)',
        'Intelligent day planner with real calendar auto-positioning',
        'Smart Reminders (Desktop, Calendar, optional WhatsApp)',
        'Natural speech cleaning (English, Hindi, Hinglish)',
        'Local-first vault with offline resilience',
        'Universal search across chats, tasks, events & files',
        'Instant Action History with one-click Undo',
      ],
      isPopular: false,
    },
    {
      id: 'pro',
      name: 'Recall Pro',
      priceMonthly: 14.99,
      priceYearly: 149.0,
      description: 'For power users needing deep reasoning, unlimited dictation, and priority dispatch.',
      features: [
        'Everything in Personal',
        'Deep Reasoning AI model (Gemini 2.5 Pro priority tier)',
        'Unlimited Recall Flow voice minutes & live transcription',
        'High-priority instant WhatsApp reminder dispatch',
        'Multi-calendar and advanced Google Workspace automation',
        'Encrypted cross-device cloud sync',
        'Early access to new Recall companion updates',
      ],
      isPopular: true,
    },
  ];

  return NextResponse.json({
    success: true,
    subscription: current,
    tiers,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, planId, interval } = body;

    const current = getBillingData();

    if (action === 'switch_plan') {
      const isPro = planId === 'pro';
      const updated: SubscriptionInfo = {
        ...current,
        planId: isPro ? 'pro' : 'personal',
        planName: isPro ? 'Recall Pro' : 'Recall Personal',
        priceMonthly: isPro ? 14.99 : 9.99,
        priceYearly: isPro ? 149.0 : 99.0,
        interval: interval || current.interval,
        status: 'active',
        limits: {
          voiceMinutes: isPro ? 'unlimited' : 600,
          reasoningTier: isPro ? 'deep' : 'balanced',
          multiLanguage: true,
          calendarAccounts: isPro ? 3 : 1,
          cloudSync: true,
          whatsappPriority: isPro,
        },
      };

      saveBillingData(updated);
      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === 'toggle_interval') {
      const updated: SubscriptionInfo = {
        ...current,
        interval: current.interval === 'month' ? 'year' : 'month',
      };
      saveBillingData(updated);
      return NextResponse.json({ success: true, subscription: updated });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
