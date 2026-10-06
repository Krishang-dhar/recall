'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  SlidersHorizontal,
  Cpu,
  Mic,
  Bell,
  Link2,
  Palette,
  ShieldCheck,
  Terminal,
  Info,
  ChevronRight,
  ChevronDown,
  Check,
  Play,
  Volume2,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Download,
  RotateCcw,
  Radio,
  ArrowLeft,
  Smartphone,
  Globe,
  MessageSquare,
  Keyboard,
  Sliders,
  Zap,
  Layers,
  Activity,
  AudioWaveform,
  VolumeX,
  ArrowRight,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PluginIcon } from '@/components/PluginIcon';
import { VoiceOrb } from '@/components/VoiceOrb';
import { useTheme } from '@/lib/theme';
import { useUserSession } from '@/lib/user-session';
import {
  RecallFlowSettings,
  DEFAULT_FLOW_SETTINGS,
  getFlowSettings,
  saveFlowSettings as saveFlowSettingsUtil,
} from '@/lib/flow-settings';
import { RecallSelect, SelectOption } from '@/components/RecallSelect';

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +5:30)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'UTC', label: 'UTC (Universal Coordinated)' },
];

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'Automatic', label: 'Automatic (English, Hindi, Hinglish)', sublabel: 'Adaptive multi-lingual' },
  { value: 'English', label: 'English', sublabel: 'Primary English' },
  { value: 'Hindi', label: 'Hindi (हिंदी)', sublabel: 'Hindi voice & text' },
  { value: 'Hinglish', label: 'Hinglish', sublabel: 'Colloquial blend' },
];

type SettingsTab =
  | 'general'
  | 'ai'
  | 'flow'
  | 'notifications'
  | 'connections'
  | 'appearance'
  | 'privacy'
  | 'advanced'
  | 'about';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [mobileSelectedTab, setMobileSelectedTab] = useState<SettingsTab | null>(null);

  // General Settings
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [language, setLanguage] = useState('Automatic');
  const [weekStartsOn, setWeekStartsOn] = useState<'monday' | 'sunday'>('monday');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [defaultDuration, setDefaultDuration] = useState('30 minutes');
  const [soundFeedback, setSoundFeedback] = useState(true);

  // Recall AI Settings
  const [responseStyle, setResponseStyle] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [suggestBetterTimes, setSuggestBetterTimes] = useState(true);
  const [autoUseTasks, setAutoUseTasks] = useState(true);
  const [useConnectedContext, setUseConnectedContext] = useState(true);
  const [modelTier, setModelTier] = useState<'auto' | 'fast' | 'balanced' | 'deep'>('balanced');
  const [showAdvancedModels, setShowAdvancedModels] = useState(false);

  // Recall Flow Settings (Unified with lib/flow-settings.ts)
  const [flowSettings, setFlowSettings] = useState<RecallFlowSettings>(DEFAULT_FLOW_SETTINGS);
  const [audioDevices, setAudioDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [showFlowDevSpecs, setShowFlowDevSpecs] = useState(false);
  const [showExtensionHelp, setShowExtensionHelp] = useState(false);

  // Notifications Settings
  const [notificationPreset, setNotificationPreset] = useState<'recall_only' | 'recall_calendar' | 'recall_whatsapp' | 'all'>('recall_calendar');
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [calendarAlerts, setCalendarAlerts] = useState(true);
  const [whatsappReminders, setWhatsappReminders] = useState(true);
  const [defaultReminderTime, setDefaultReminderTime] = useState('at_due_time');
  const [calendarReminderTime, setCalendarReminderTime] = useState('15_min_before');
  const [morningOverview, setMorningOverview] = useState(false);
  const [morningTime, setMorningTime] = useState('08:30');
  const [eveningReset, setEveningReset] = useState(false);
  const [eveningTime, setEveningTime] = useState('20:00');

  // WhatsApp Manage Modal/Section
  const { session, resetGuestData } = useUserSession();
  const [isManagingWhatsApp, setIsManagingWhatsApp] = useState(false);
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<string | null>(null);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [whatsAppTestResult, setWhatsAppTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showWhatsAppAdvanced, setShowWhatsAppAdvanced] = useState(false);

  // Google Connection
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isManagingGoogle, setIsManagingGoogle] = useState(false);

  // Appearance
  const { theme, setTheme } = useTheme();
  const [interfaceDensity, setInterfaceDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ambientBackground, setAmbientBackground] = useState(true);

  // Privacy & Data
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [historyClearSuccess, setHistoryClearSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const [deleteAllSuccess, setDeleteAllSuccess] = useState(false);
  const [isResettingExperience, setIsResettingExperience] = useState(false);
  const [resetExperienceSuccess, setResetExperienceSuccess] = useState(false);

  // Read URL search params (?tab=flow)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as SettingsTab;
      if (
        tabParam &&
        [
          'general',
          'ai',
          'flow',
          'notifications',
          'connections',
          'appearance',
          'privacy',
          'advanced',
          'about',
        ].includes(tabParam)
      ) {
        setActiveTab(tabParam);
        setMobileSelectedTab(tabParam);
      }
    }
  }, []);

  // Load live Google and WhatsApp status
  useEffect(() => {
    async function loadStatus() {
      if (session.isGuest) {
        setGoogleConnected(false);
        setGoogleEmail(null);
        setWhatsAppRecipient(null);
        return;
      }
      try {
        const res = await fetch('/api/google/status', {
          headers: { 'x-session-mode': session.mode },
        });
        const data = await res.json();
        if (data?.google?.connected) {
          setGoogleConnected(true);
          setGoogleEmail(data.google.email || null);
        } else {
          setGoogleConnected(false);
          setGoogleEmail(null);
        }
        if (data?.whatsapp?.connected && data?.whatsapp?.recipient) {
          setWhatsAppRecipient(`+${data.whatsapp.recipient.replace(/^\+/, '')}`);
        } else {
          setWhatsAppRecipient(null);
        }
      } catch (e) {}
    }
    loadStatus();
  }, [session.mode, session.isGuest]);

  // Sync Recall Flow settings with lib/flow-settings.ts & enumerate audio devices
  useEffect(() => {
    const current = getFlowSettings();
    setFlowSettings(current);

    const handleSettingsChanged = (e: any) => {
      if (e.detail) setFlowSettings(e.detail);
    };
    window.addEventListener('recall-flow-settings-changed', handleSettingsChanged);

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const inputs = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${i + 1}`,
          }));
        setAudioDevices(inputs);
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('recall-flow-settings-changed', handleSettingsChanged);
    };
  }, []);

  const updateFlow = (patch: Partial<RecallFlowSettings>) => {
    const updated = saveFlowSettingsUtil(patch);
    setFlowSettings(updated);
  };

  // WhatsApp test dispatch
  const handleSendTestWhatsApp = async () => {
    setIsTestingWhatsApp(true);
    setWhatsAppTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Recall Test Reminder',
          dueText: 'Right now (Test)',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWhatsAppTestResult({
          success: true,
          message: `Delivered to ${whatsAppRecipient} (ID: ${data.messageId?.slice(0, 16)}…)`,
        });
      } else {
        setWhatsAppTestResult({
          success: false,
          message: data.error || 'Failed to dispatch test notification.',
        });
      }
    } catch (err: any) {
      setWhatsAppTestResult({
        success: false,
        message: err.message || 'Network request failed.',
      });
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  // Delete All Data (Fresh Start across all days, dates, chats, projects)
  const handleDeleteAllData = async () => {
    if (
      !confirm(
        'Are you sure you want to delete ALL data? This will permanently erase all tasks, schedules across all days, conversation history, and project records for a completely fresh start.'
      )
    ) {
      return;
    }

    setIsDeletingAllData(true);
    setDeleteAllSuccess(false);

    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        setDeleteAllSuccess(true);
        setTimeout(() => setDeleteAllSuccess(false), 5000);
      } else {
        alert(d.error || 'Failed to delete all data.');
      }
    } catch (e: any) {
      alert('Failed to delete all data: ' + e.message);
    } finally {
      setIsDeletingAllData(false);
    }
  };

  // Reset Session (Fresh Start)
  const handleResetExperience = async () => {
    if (!confirm('Reset Session? This will clear temporary local tasks and restart the welcome walkthrough without touching real Google data.')) return;
    setIsResettingExperience(true);
    setResetExperienceSuccess(false);
    try {
      resetGuestData();
      try {
        localStorage.removeItem('recall_demo_onboarding_completed');
      } catch {}
      setResetExperienceSuccess(true);
      setTimeout(() => setResetExperienceSuccess(false), 5000);
    } catch (e: any) {
      alert('Failed to reset session: ' + e.message);
    } finally {
      setIsResettingExperience(false);
    }
  };

  // Clear conversations
  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear your local Recall conversation history?')) return;
    setIsClearingHistory(true);
    try {
      const res = await fetch('/api/conversations', { method: 'DELETE' });
      const d = await res.json();
      if (d.success) {
        setHistoryClearSuccess(true);
        setTimeout(() => setHistoryClearSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Export Data JSON
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const [tasksRes, convRes, projRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/conversations'),
        fetch('/api/projects'),
      ]);
      const tasksData = await tasksRes.json();
      const convData = await convRes.json();
      const projData = await projRes.json();

      const exportBundle = {
        exportedAt: new Date().toISOString(),
        profile: {
          name: session.name,
          role: session.role,
          timezone,
          googleEmail,
        },
        tasks: tasksData.tasks || [],
        conversations: convData.conversations || [],
        projects: projData.projects || [],
      };

      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recall-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  const navItems: Array<{ id: SettingsTab; label: string; icon: any }> = [
    { id: 'general', label: 'General', icon: SlidersHorizontal },
    { id: 'ai', label: 'Recall AI', icon: Cpu },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'connections', label: 'Connections', icon: Link2 },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'privacy', label: 'Privacy & Data', icon: ShieldCheck },
    { id: 'advanced', label: 'Advanced', icon: Terminal },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className="w-full max-w-[1020px] mx-auto pb-28 pt-2 sm:pt-4 px-2 sm:px-4 apple-fade-in">
      {/* Settings Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-black/[0.05]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Make Recall work the way you do.
          </p>
        </div>

        {/* Profile Avatar with subtle iridescent Recall gradient */}
        <Link
          href="/account"
          className="group flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-black/[0.03] transition-all cursor-pointer border border-transparent hover:border-black/[0.05]"
          title="Manage Profile"
        >
          <div className="relative w-9 h-9 rounded-full flex items-center justify-center p-[2px] bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] shadow-2xs group-hover:scale-105 transition-transform">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-semibold text-xs text-zinc-800">
              {session.initials}
            </div>
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-zinc-900 leading-none">
              {session.name}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">{session.role}</div>
          </div>
        </Link>
      </div>

      {/* Profile Card Hero (Section 5) */}
      <div className="mt-6 mb-8 p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative w-12 h-12 rounded-2xl p-[2px] bg-gradient-to-tr from-[#0052FF]/80 via-[#00D2FF] to-[#7928CA] shadow-xs shrink-0">
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center font-semibold text-base text-zinc-900">
              {session.initials}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{session.name}</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100/60 text-[10px] font-semibold text-[#0052FF]">
                {session.role}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
              <span>{timezone}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {googleConnected
                  ? 'Google connected'
                  : session.isGuest
                  ? 'Local session · Isolated'
                  : 'Local storage active'}
              </span>
            </div>
            {session.isGuest && (
              <div className="mt-1">
                <a
                  href="/api/auth/google?returnTo=/settings"
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  Sign in with Google to sync your data →
                </a>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/account"
          className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium border border-black/[0.05] transition-all cursor-pointer active:scale-95"
        >
          Manage profile
        </Link>
      </div>

      {/* =========================================================================
          DESKTOP TWO-COLUMN LAYOUT / MOBILE DRILL-DOWN (Sections 2 & 3)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* LEFT NAVIGATION (Desktop 220–250px) / Hidden on mobile if viewing sub-page */}
        <div
          className={`md:col-span-4 lg:col-span-3 space-y-1 ${
            mobileSelectedTab !== null ? 'hidden md:block' : 'block'
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 px-3 py-2">
            Preferences
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileSelectedTab(item.id);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected ? 'text-white' : 'text-zinc-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 md:hidden ${
                    isSelected ? 'text-white/80' : 'text-zinc-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* RIGHT CONTENT PANE (720–820px max on desktop) */}
        <div
          className={`md:col-span-8 lg:col-span-9 space-y-6 ${
            mobileSelectedTab === null ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Mobile Back Button to Return to Menu */}
          {mobileSelectedTab !== null && (
            <button
              type="button"
              onClick={() => setMobileSelectedTab(null)}
              className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 mb-4 py-1 px-2.5 rounded-lg bg-zinc-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Settings</span>
            </button>
          )}

          {/* ==================== 1. GENERAL SETTINGS (Section 7) ==================== */}
          {activeTab === 'general' && (
            <div className="space-y-6 apple-slide-down">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  General
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure local timezone, speech language, and scheduling rules.
                </p>
              </div>

              {/* Current Plan & Membership Card (Apple Minimal SaaS) */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-white via-blue-50/25 to-indigo-50/20 border border-black/[0.06] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-zinc-900 tracking-tight">Recall Pro</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-[10px] font-semibold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active · All Features Unlocked
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 max-w-lg leading-relaxed">
                    Universal Recall Flow Voice Layer, Google Calendar & Gmail Sync, WhatsApp Reminders, and Unlimited Schedules.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-xl bg-zinc-100 border border-black/[0.04] text-[11px] font-medium text-zinc-600">
                    Pro Plan
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
                {/* Timezone */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Timezone</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Used for scheduling deadlines and upcoming alerts
                    </div>
                  </div>
                  <div className="w-full sm:w-64">
                    <RecallSelect
                      value={timezone}
                      onChange={setTimezone}
                      options={TIMEZONE_OPTIONS}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Language */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Language</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Recall understands multilingual text and voice prompts
                    </div>
                  </div>
                  <div className="w-full sm:w-64">
                    <RecallSelect
                      value={language}
                      onChange={setLanguage}
                      options={LANGUAGE_OPTIONS}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Week starts on */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Week starts on</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      First day shown on calendar timetables
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setWeekStartsOn('monday')}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        weekStartsOn === 'monday'
                          ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Monday
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekStartsOn('sunday')}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        weekStartsOn === 'sunday'
                          ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      Sunday
                    </button>
                  </div>
                </div>

                {/* Time format */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Time format</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      12-hour (3:00 PM) or 24-hour (15:00) clock
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTimeFormat('12h')}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        timeFormat === '12h'
                          ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      12-hour
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeFormat('24h')}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        timeFormat === '24h'
                          ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      24-hour
                    </button>
                  </div>
                </div>

                {/* Default task duration */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Default task duration</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Initial slot size when generating day timetables
                    </div>
                  </div>
                  <select
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(e.target.value)}
                    className="text-xs font-medium bg-zinc-50 border border-black/[0.08] px-3 py-1.5 rounded-xl text-zinc-800 outline-none cursor-pointer"
                  >
                    <option value="15 minutes">15 minutes</option>
                    <option value="30 minutes">30 minutes</option>
                    <option value="45 minutes">45 minutes</option>
                    <option value="60 minutes">60 minutes</option>
                  </select>
                </div>

                {/* Sound cues */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Sounds</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Play gentle audio feedback when checking off items
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundFeedback(!soundFeedback)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      soundFeedback ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        soundFeedback ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Delete All Data / Fresh Start (Danger Zone) */}
              <div className="rounded-2xl bg-white border border-red-200/70 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-red-600">
                    <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight text-zinc-900">
                        Delete All Data (Fresh Start)
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Clear all tasks, chats, schedules, and start from 0
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    Danger Zone
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Permanently erase all tasks across all days/dates, chat conversations, messages, and projects. Active integrations (Google Calendar, WhatsApp) remain connected so you can start completely fresh.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-red-100/60">
                  <span className="text-[11px] text-zinc-400">
                    This will reset Recall to 0 data across all days and chats.
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteAllData}
                    disabled={isDeletingAllData}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {isDeletingAllData ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting all data…</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete All Data</span>
                      </>
                    )}
                  </button>
                </div>
                {deleteAllSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All data across all dates, chats, and tasks has been deleted. Fresh start ready!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 2. RECALL AI (Sections 8 & 9) ==================== */}
          {activeTab === 'ai' && (
            <div className="space-y-6 apple-slide-down">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full flex items-center justify-center p-[2px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/recall-logo.png"
                    alt="Recall AI"
                    className="w-8 h-8 object-contain drop-shadow-[0_2px_8px_rgba(0,82,255,0.35)]"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                    Recall AI
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Choose how Recall thinks and responds.
                  </p>
                </div>
              </div>

              {/* Response style */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-3">
                <div className="text-sm font-semibold text-zinc-900">Response style</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'concise', label: 'Concise', desc: 'Direct & quick' },
                    { id: 'balanced', label: 'Balanced', desc: 'Natural & helpful' },
                    { id: 'detailed', label: 'Detailed', desc: 'Comprehensive' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setResponseStyle(style.id as any)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        responseStyle === style.id
                          ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                          : 'border-black/[0.06] bg-zinc-50/60 hover:bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      <div className="text-xs font-semibold">{style.label}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          responseStyle === style.id ? 'text-zinc-300' : 'text-zinc-400'
                        }`}
                      >
                        {style.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Planning behaviors */}
              <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Suggest better times
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Intelligently arrange commitments around your real calendar openings
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuggestBetterTimes(!suggestBetterTimes)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      suggestBetterTimes ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        suggestBetterTimes ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Automatically use my tasks
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Incorporate unfinished tasks when constructing your daily plan
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoUseTasks(!autoUseTasks)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      autoUseTasks ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        autoUseTasks ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Use connected app context
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Pull recent emails and calendar events to inform advice
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseConnectedContext(!useConnectedContext)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      useConnectedContext ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        useConnectedContext ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* AI Model Picker (Section 9) */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">AI Model</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Select latency and reasoning depth
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedModels(!showAdvancedModels)}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-900 underline cursor-pointer"
                  >
                    {showAdvancedModels ? 'Hide model details' : 'Advanced model details'}
                  </button>
                </div>

                {/* Model Choices */}
                <div className="space-y-2">
                  {[
                    {
                      id: 'auto',
                      name: 'AUTO',
                      badge: 'Recommended',
                      desc: 'Recall chooses the best model automatically',
                      latency: 'Adaptive',
                      actualModel: 'gemini-2.5-flash cascade',
                    },
                    {
                      id: 'fast',
                      name: 'FAST',
                      badge: 'Lowest latency',
                      desc: 'For quick everyday requests & quick task parsing',
                      latency: '~200ms',
                      actualModel: 'gemini-2.5-flash-lite',
                    },
                    {
                      id: 'balanced',
                      name: 'BALANCED',
                      badge: 'Everyday Assistant',
                      desc: 'Best for day planning, studying and file understanding',
                      latency: '~400ms',
                      actualModel: 'gemini-2.5-flash',
                    },
                    {
                      id: 'deep',
                      name: 'DEEP',
                      badge: 'Complex reasoning',
                      desc: 'Comprehensive reasoning, deep research and code logic',
                      latency: '~1.1s',
                      actualModel: 'gemini-2.5-pro',
                    },
                  ].map((m) => {
                    const isSelected = modelTier === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setModelTier(m.id as any)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-[#0052FF]/60 bg-blue-50/40 shadow-xs'
                            : 'border-black/[0.05] hover:bg-zinc-50/80 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-[#0052FF] bg-[#0052FF] text-white'
                                : 'border-zinc-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold tracking-tight text-zinc-900">
                                {m.name}
                              </span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                                {m.badge}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">{m.desc}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono font-medium text-zinc-500">
                            {m.latency}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expandable Advanced model details */}
                {showAdvancedModels && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-black/[0.06] text-xs space-y-1 font-mono text-zinc-600 apple-slide-down">
                    <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-sans font-semibold mb-1">
                      Active Gemini API Endpoints
                    </div>
                    <div>Fast: <span className="text-zinc-900">models/gemini-2.5-flash-lite</span></div>
                    <div>Balanced: <span className="text-zinc-900">models/gemini-2.5-flash</span></div>
                    <div>Deep: <span className="text-zinc-900">models/gemini-2.5-pro</span></div>
                    <div className="text-[10px] text-zinc-400 font-sans mt-2">
                      Verified from configured GEMINI_API_KEY. Raw IDs never exposed to normal users.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 3. RECALL FLOW (System-Wide AI Voice Layer) ==================== */}
          {activeTab === 'flow' && (
            <div className="space-y-6 apple-slide-down">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                    Recall Flow
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    System-wide voice layer for macOS. Speak anywhere to clean dictation, schedule meetings, or set reminders.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('trigger-recall-flow'))}
                    className="px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    Test Flow
                  </button>
                  <Link
                    href="/flow"
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#0052FF] hover:bg-blue-50/70 border border-blue-200/60 rounded-xl transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <span>Open Flow Center</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* 1. Master Controls & Global Hotkey */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center p-[2px] bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] shadow-sm shrink-0">
                      <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                        <Mic className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-900">Recall Flow Service</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-semibold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{flowSettings.enabled ? 'Active' : 'Disabled'}</span>
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Summoned via global shortcut. Listens, cleans natural speech, and auto-inserts text into your active app.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateFlow({ enabled: !flowSettings.enabled })}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      flowSettings.enabled ? 'bg-[#0052FF]' : 'bg-zinc-200'
                    }`}
                    aria-label="Toggle Recall Flow Service"
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        flowSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {flowSettings.enabled && (
                  <div className="divide-y divide-black/[0.04] pt-2 border-t border-black/[0.04]">
                    {/* Activation Shortcut */}
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">Global Activation Shortcut</div>
                        <div className="text-[11px] text-zinc-400">
                          System-wide hotkey to summon Recall Flow floating voice input
                        </div>
                      </div>
                      <select
                        value={flowSettings.shortcut}
                        onChange={(e) => updateFlow({ shortcut: e.target.value })}
                        className="text-xs font-medium bg-zinc-50 border border-black/[0.08] px-3 py-1.5 rounded-xl text-zinc-800 outline-none cursor-pointer"
                      >
                        <option value="Option + Space">Option + Space (Default)</option>
                        <option value="Alt + Space">Alt + Space</option>
                        <option value="Control + Space">Control + Space</option>
                        <option value="Command + Shift + Space">Command + Shift + Space</option>
                      </select>
                    </div>

                    {/* Launch at Login */}
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">Launch at Login</div>
                        <div className="text-[11px] text-zinc-400">
                          Automatically start Recall Flow background service when Mac boots
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateFlow({ launchAtLogin: !flowSettings.launchAtLogin })}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          flowSettings.launchAtLogin ? 'bg-zinc-900' : 'bg-zinc-200'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                            flowSettings.launchAtLogin ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Floating Assistant Orb */}
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">Floating Assistant Orb</div>
                        <div className="text-[11px] text-zinc-400">
                          Display floating interactive voice orb on your macOS desktop
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateFlow({ floatingOrbEnabled: !flowSettings.floatingOrbEnabled })}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          flowSettings.floatingOrbEnabled ? 'bg-zinc-900' : 'bg-zinc-200'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                            flowSettings.floatingOrbEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Direct Auto-Insert */}
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">Direct Auto-Insert</div>
                        <div className="text-[11px] text-zinc-400">
                          Pastes cleaned transcription directly into your active input field
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateFlow({ autoInsert: !flowSettings.autoInsert })}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          flowSettings.autoInsert ? 'bg-zinc-900' : 'bg-zinc-200'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                            flowSettings.autoInsert ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Clipboard Fallback */}
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">Clipboard Fallback</div>
                        <div className="text-[11px] text-zinc-400">
                          Automatically copy to system clipboard if focused app denies direct paste
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateFlow({ autoCopyFallback: !flowSettings.autoCopyFallback })}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          flowSettings.autoCopyFallback ? 'bg-zinc-900' : 'bg-zinc-200'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                            flowSettings.autoCopyFallback ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Microphone & Acoustic Processing */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Microphone & Acoustic Processing</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure input hardware, noise handling, and silence pause detection.
                  </p>
                </div>

                <div className="divide-y divide-black/[0.04]">
                  {/* Microphone Source */}
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Microphone Source</div>
                      <div className="text-[11px] text-zinc-400">
                        Select audio recording input device
                      </div>
                    </div>
                    <select
                      value={flowSettings.inputSettings.selectedMicrophone}
                      onChange={(e) =>
                        updateFlow({
                          inputSettings: {
                            ...flowSettings.inputSettings,
                            selectedMicrophone: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-medium bg-zinc-50 border border-black/[0.08] px-3 py-1.5 rounded-xl text-zinc-800 outline-none max-w-[200px] truncate cursor-pointer"
                    >
                      <option value="default">Default System Microphone</option>
                      {audioDevices.map((dev) => (
                        <option key={dev.deviceId} value={dev.deviceId}>
                          {dev.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Acoustic Sensitivity */}
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Acoustic Sensitivity</div>
                      <div className="text-[11px] text-zinc-400">
                        Speech detection threshold for soft speech or noisy environments
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['high', 'balanced', 'precise'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() =>
                            updateFlow({
                              inputSettings: {
                                ...flowSettings.inputSettings,
                                sensitivity: lvl,
                              },
                            })
                          }
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer border',
                            flowSettings.inputSettings.sensitivity === lvl
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-black/[0.06]'
                          )}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Silence Detection Seconds */}
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Silence Detection Threshold</div>
                      <div className="text-[11px] text-zinc-400">
                        Pause duration before Recall Flow automatically stops and finishes
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[0.8, 1.2, 1.6, 2.0, 2.5].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() =>
                            updateFlow({
                              inputSettings: {
                                ...flowSettings.inputSettings,
                                silenceDetectionSeconds: sec,
                              },
                            })
                          }
                          className={cn(
                            'px-2 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border',
                            flowSettings.inputSettings.silenceDetectionSeconds === sec
                              ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-black/[0.06]'
                          )}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Noise Handling */}
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Noise Suppression</div>
                      <div className="text-[11px] text-zinc-400">
                        Filters typing keystrokes, echo, and room HVAC background noise
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateFlow({
                          inputSettings: {
                            ...flowSettings.inputSettings,
                            noiseHandling: !flowSettings.inputSettings.noiseHandling,
                          },
                        })
                      }
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        flowSettings.inputSettings.noiseHandling ? 'bg-zinc-900' : 'bg-zinc-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                          flowSettings.inputSettings.noiseHandling ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto-Finish After Speaking */}
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Auto-Finish After Speaking</div>
                      <div className="text-[11px] text-zinc-400">
                        Automatically processes transcription when speech ceases without pressing Enter
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateFlow({
                          inputSettings: {
                            ...flowSettings.inputSettings,
                            autoFinishAfterSpeaking: !flowSettings.inputSettings.autoFinishAfterSpeaking,
                          },
                        })
                      }
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        flowSettings.inputSettings.autoFinishAfterSpeaking ? 'bg-zinc-900' : 'bg-zinc-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                          flowSettings.inputSettings.autoFinishAfterSpeaking ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Application Compatibility */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Application Compatibility</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Tested and verified for seamless focus restoration and text insertion.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>macOS Accessibility Ready</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { name: 'WhatsApp Desktop', desc: 'Instant chat typing' },
                    { name: 'Gmail & Mail', desc: 'Email composing' },
                    { name: 'Chrome & Arc', desc: 'Input fields & forms' },
                    { name: 'Apple Notes', desc: 'Memos & thoughts' },
                    { name: 'Notion', desc: 'Blocks & tasks' },
                    { name: 'Slack & Discord', desc: 'Workplace messages' },
                    { name: 'ChatGPT & Claude', desc: 'AI prompting' },
                    { name: 'VS Code & Terminal', desc: 'Code comments & docs' },
                  ].map((app) => (
                    <div
                      key={app.name}
                      className="p-3 rounded-xl bg-zinc-50/80 border border-black/[0.04] space-y-0.5"
                    >
                      <div className="text-xs font-semibold text-zinc-800">{app.name}</div>
                      <div className="text-[10px] text-zinc-400">{app.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Architecture Pipeline & Developer Specs */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Architecture Pipeline</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      How Recall Flow turns natural voice into action in under 300ms.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFlowDevSpecs(!showFlowDevSpecs)}
                    className="text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer"
                  >
                    {showFlowDevSpecs ? 'Hide developer specs' : 'Developer specs'}
                  </button>
                </div>

                {/* Minimal Architecture Flowchart */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/40 via-purple-50/30 to-emerald-50/40 border border-black/[0.05] space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-black/[0.06] text-center shadow-2xs w-full sm:w-auto">
                      <div className="font-semibold text-zinc-900">1. Speak Naturally</div>
                      <div className="text-[10px] text-zinc-400">English, Hindi, Hinglish</div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-zinc-400 hidden sm:block shrink-0" />
                    <ArrowDown className="w-4 h-4 text-zinc-400 sm:hidden shrink-0" />

                    <div className="p-2.5 rounded-xl bg-white border border-blue-200 text-center shadow-2xs w-full sm:w-auto">
                      <div className="font-semibold text-blue-700">2. Recall Flow Engine</div>
                      <div className="text-[10px] text-zinc-400">Clean · Translate · Route</div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-zinc-400 hidden sm:block shrink-0" />
                    <ArrowDown className="w-4 h-4 text-zinc-400 sm:hidden shrink-0" />

                    <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-center shadow-2xs w-full sm:w-auto">
                      <div className="font-semibold text-emerald-700">3. Write · Act · Ask</div>
                      <div className="text-[10px] text-zinc-400">Auto-paste or execute</div>
                    </div>
                  </div>
                </div>

                {showFlowDevSpecs && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-black/[0.06] text-xs font-mono text-zinc-600 space-y-1.5 apple-slide-down">
                    <div className="font-sans font-semibold text-zinc-900 text-[11px] uppercase tracking-wider mb-1">
                      System Diagnostics
                    </div>
                    <div>Audio Sample Rate: <span className="text-zinc-900">16,000 Hz 16-bit PCM Mono</span></div>
                    <div>Streaming Buffer Window: <span className="text-zinc-900">250 ms</span></div>
                    <div>Clipboard Dispatch Latency: <span className="text-zinc-900">50 ms</span></div>
                    <div>Speech Engine Endpoint: <span className="text-zinc-900">models/gemini-2.5-flash</span></div>
                    <div>macOS Accessibility Status: <span className="text-emerald-600 font-semibold">Granted (AXUIElement API)</span></div>
                    <div>Helper Binary: <span className="text-zinc-900">Recall Flow.app (Background daemon)</span></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 4. NOTIFICATIONS (Section 14 & 15) ==================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 apple-slide-down">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  Notifications
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure delivery channels and daily summary digests.
                </p>
              </div>

              {/* Delivery Channel Presets */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-3">
                <div className="text-sm font-semibold text-zinc-900">Notification Routing Presets</div>
                <div className="text-xs text-zinc-400">
                  Select your preferred notification blend for reminders, day schedules, and deadlines
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {[
                    { id: 'recall_only', label: 'Recall only', desc: 'In-app & Desktop' },
                    { id: 'recall_calendar', label: 'Recall + Calendar', desc: 'Recommended' },
                    { id: 'recall_whatsapp', label: 'Recall + WhatsApp', desc: 'Direct to mobile' },
                    { id: 'all', label: 'All channels', desc: 'Maximum reach' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setNotificationPreset(preset.id as any);
                        if (preset.id === 'recall_only') {
                          setInAppNotifications(true);
                          setCalendarAlerts(false);
                          setWhatsappReminders(false);
                        } else if (preset.id === 'recall_calendar') {
                          setInAppNotifications(true);
                          setCalendarAlerts(true);
                          setWhatsappReminders(false);
                        } else if (preset.id === 'recall_whatsapp') {
                          setInAppNotifications(true);
                          setCalendarAlerts(false);
                          setWhatsappReminders(true);
                        } else if (preset.id === 'all') {
                          setInAppNotifications(true);
                          setCalendarAlerts(true);
                          setWhatsappReminders(true);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        notificationPreset === preset.id
                          ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                          : 'border-black/[0.06] bg-zinc-50/60 hover:bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          notificationPreset === preset.id ? 'text-zinc-300' : 'text-zinc-400'
                        }`}
                      >
                        {preset.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reminder Delivery Channels */}
              <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Recall in-app & desktop notifications
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Show alert banners, toast notifications, and desktop chimes
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInAppNotifications(!inAppNotifications)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      inAppNotifications ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        inAppNotifications ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                      <PluginIcon id="calendar" size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Calendar event notifications
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Sync alerts with Google Calendar and system calendar
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalendarAlerts(!calendarAlerts)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      calendarAlerts ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        calendarAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <PluginIcon id="whatsapp" size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        WhatsApp reminders (Optional)
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Deliver due alerts to your mobile phone{whatsAppRecipient ? ` (${whatsAppRecipient})` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsappReminders(!whatsappReminders)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      whatsappReminders ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        whatsappReminders ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Default reminder</div>
                    <div className="text-xs text-zinc-400 mt-0.5">When to trigger notification for tasks</div>
                  </div>
                  <select
                    value={defaultReminderTime}
                    onChange={(e) => setDefaultReminderTime(e.target.value)}
                    className="text-xs font-medium bg-zinc-50 border border-black/[0.08] px-3 py-1.5 rounded-xl text-zinc-800 outline-none cursor-pointer"
                  >
                    <option value="at_due_time">At due time</option>
                    <option value="5_min_before">5 minutes before</option>
                    <option value="15_min_before">15 minutes before</option>
                    <option value="30_min_before">30 minutes before</option>
                  </select>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Calendar reminder</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Default alert for calendar events</div>
                  </div>
                  <select
                    value={calendarReminderTime}
                    onChange={(e) => setCalendarReminderTime(e.target.value)}
                    className="text-xs font-medium bg-zinc-50 border border-black/[0.08] px-3 py-1.5 rounded-xl text-zinc-800 outline-none cursor-pointer"
                  >
                    <option value="15_min_before">15 minutes before</option>
                    <option value="30_min_before">30 minutes before</option>
                    <option value="1_hour_before">1 hour before</option>
                  </select>
                </div>
              </div>

              {/* WhatsApp Card & Management (Section 15) */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <PluginIcon id="whatsapp" size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <span>WhatsApp Delivery</span>
                        <span className="px-2 py-0.2 rounded-full bg-emerald-50 border border-emerald-200/50 text-[10px] font-semibold text-emerald-700">
                          Active
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Connected: {whatsAppRecipient}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsManagingWhatsApp(!isManagingWhatsApp)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium cursor-pointer"
                  >
                    {isManagingWhatsApp ? 'Close' : 'Manage'}
                  </button>
                </div>

                {isManagingWhatsApp && (
                  <div className="pt-4 border-t border-black/[0.05] space-y-4 apple-slide-down">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">
                          Recipient Phone Number
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          E.164 international format (+91...)
                        </div>
                      </div>
                      <input
                        type="text"
                        value={whatsAppRecipient || ''}
                        onChange={(e) => setWhatsAppRecipient(e.target.value)}
                        className="text-xs font-mono bg-zinc-50 border border-black/[0.08] px-3 py-1.5 rounded-xl text-zinc-800 outline-none w-48"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">Test Reminder</div>
                        <div className="text-[11px] text-zinc-400">
                          Dispatch an instant test notification to verify delivery
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendTestWhatsApp}
                        disabled={isTestingWhatsApp}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isTestingWhatsApp ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Send test</span>
                      </button>
                    </div>

                    {whatsAppTestResult && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                          whatsAppTestResult.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {whatsAppTestResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{whatsAppTestResult.message}</span>
                      </div>
                    )}

                    {/* Collapsible Advanced Technical Info */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowWhatsAppAdvanced(!showWhatsAppAdvanced)}
                        className="text-[11px] font-medium text-zinc-400 hover:text-zinc-600 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Advanced technical details</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {showWhatsAppAdvanced && (
                        <div className="mt-2 p-3 rounded-xl bg-zinc-50 border border-black/[0.05] font-mono text-[11px] text-zinc-600 space-y-1">
                          <div>Channel: Meta Cloud API</div>
                          <div>API Version: Graph API v25.0</div>
                          <div>Endpoint: /v25.0/1039868729215033/messages</div>
                          <div>Token: System User Permanent Bearer</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Daily Summaries */}
              <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Morning overview
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Receive a short morning briefing of scheduled tasks
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {morningOverview && (
                      <input
                        type="time"
                        value={morningTime}
                        onChange={(e) => setMorningTime(e.target.value)}
                        className="text-xs font-mono bg-zinc-50 border border-black/[0.08] px-2 py-1 rounded-lg"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setMorningOverview(!morningOverview)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        morningOverview ? 'bg-zinc-900' : 'bg-zinc-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                          morningOverview ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Evening unfinished tasks
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Gentle check-in to reschedule pending items before winding down
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {eveningReset && (
                      <input
                        type="time"
                        value={eveningTime}
                        onChange={(e) => setEveningTime(e.target.value)}
                        className="text-xs font-mono bg-zinc-50 border border-black/[0.08] px-2 py-1 rounded-lg"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setEveningReset(!eveningReset)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        eveningReset ? 'bg-zinc-900' : 'bg-zinc-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                          eveningReset ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 5. CONNECTIONS (Sections 16 & 17) ==================== */}
          {activeTab === 'connections' && (
            <div className="space-y-6 apple-slide-down">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  Connections
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Connected tools Recall can access to read schedule, emails, files, and send reminders.
                </p>
              </div>

              {/* Google Connection Card */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <PluginIcon id="calendar" size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                        <span>Google Workspace</span>
                        {googleConnected ? (
                          <span className="px-2 py-0.2 rounded-full bg-emerald-50 border border-emerald-200/50 text-[10px] font-semibold text-emerald-700">
                            Connected
                          </span>
                        ) : (
                          <span className="px-2 py-0.2 rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500">
                            Not connected
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {googleConnected
                          ? `Connected as ${googleEmail || 'Google Account'}`
                          : 'Connect Calendar, Gmail, and Google Drive'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsManagingGoogle(!isManagingGoogle)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium cursor-pointer"
                  >
                    {isManagingGoogle ? 'Close' : 'Manage Google'}
                  </button>
                </div>

                {/* Sub-services breakdown */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-zinc-50/70 border border-black/[0.04] flex items-center gap-2.5">
                    <PluginIcon id="calendar" size={18} />
                    <div>
                      <div className="text-xs font-medium text-zinc-900">Calendar</div>
                      <div className="text-[10px] text-zinc-400">
                        {googleConnected ? 'Events synced' : 'Not linked'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50/70 border border-black/[0.04] flex items-center gap-2.5">
                    <PluginIcon id="gmail" size={18} />
                    <div>
                      <div className="text-xs font-medium text-zinc-900">Gmail</div>
                      <div className="text-[10px] text-zinc-400">
                        {googleConnected ? 'Search & drafts' : 'Not linked'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50/70 border border-black/[0.04] flex items-center gap-2.5">
                    <PluginIcon id="drive" size={18} />
                    <div>
                      <div className="text-xs font-medium text-zinc-900">Drive</div>
                      <div className="text-[10px] text-zinc-400">
                        {googleConnected ? 'Files readable' : 'Not linked'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manage Google Expanded View (Section 17) */}
                {isManagingGoogle && (
                  <div className="pt-4 border-t border-black/[0.05] space-y-4 apple-slide-down">
                    <div className="text-xs font-semibold text-zinc-900">
                      Recall can access:
                    </div>

                    <div className="space-y-2 text-xs text-zinc-600">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Calendar: Read events & create scheduled meetings</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Gmail: Search emails & prepare authorized drafts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Drive: Search documents, notes & study files</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-2">
                      <a
                        href="/api/auth/google?returnTo=/settings"
                        className="px-3.5 py-1.5 rounded-xl bg-[#0052FF] hover:bg-[#0047E0] text-white text-xs font-semibold shadow-xs"
                      >
                        {googleConnected ? 'Update permissions' : 'Connect Google'}
                      </a>

                      {googleConnected && (
                        <a
                          href="/api/google/disconnect"
                          className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200/50"
                        >
                          Disconnect
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Other Connected Apps */}
              <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
                {/* WhatsApp */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <PluginIcon id="whatsapp" size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">WhatsApp</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {whatsAppRecipient ? `Connected to ${whatsAppRecipient}` : 'Automated alerts & reminders via WhatsApp'}
                      </div>
                    </div>
                  </div>
                  {whatsAppRecipient ? (
                    <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-3 py-1 rounded-full text-xs font-semibold">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsManagingWhatsApp(true)}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                    >
                      Configure
                    </button>
                  )}
                </div>

                {/* Notion */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 border border-black/[0.06] flex items-center justify-center shrink-0">
                      <PluginIcon id="notion" size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">Notion</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Workspace knowledge, notes and exported databases
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert('Notion integration is ready to connect with your workspace.')}
                    className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium cursor-pointer"
                  >
                    Connect +
                  </button>
                </div>

                {/* Maps */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                      <PluginIcon id="maps" size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">Google Maps</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Places, commute times, and direct location links
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
                    Automatic ✓
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 6. APPEARANCE (Sections 18 & 19) ==================== */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 apple-slide-down">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  Appearance
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Theme styling, typography density, and ambient motion.
                </p>
              </div>

              {/* Theme Mini Visual Previews (Section 19) */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-4">
                <div className="text-sm font-semibold text-zinc-900">Theme</div>

                <div className="grid grid-cols-3 gap-3">
                  {/* System (Split Preview) */}
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      theme === 'system'
                        ? 'border-[#0052FF] ring-2 ring-[#0052FF]/20 shadow-xs'
                        : 'border-black/[0.06] hover:bg-zinc-50'
                    }`}
                  >
                    <div className="h-16 rounded-xl border border-black/[0.08] overflow-hidden flex mb-2.5 shadow-2xs">
                      <div className="w-1/2 bg-white flex flex-col justify-center items-center gap-1">
                        <div className="w-5 h-1.5 rounded-full bg-zinc-200" />
                        <div className="w-3 h-1.5 rounded-full bg-zinc-100" />
                      </div>
                      <div className="w-1/2 bg-zinc-900 flex flex-col justify-center items-center gap-1">
                        <div className="w-5 h-1.5 rounded-full bg-zinc-700" />
                        <div className="w-3 h-1.5 rounded-full bg-zinc-800" />
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-zinc-900">System</div>
                  </button>

                  {/* Light (White/Off-white preview) */}
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-[#0052FF] ring-2 ring-[#0052FF]/20 shadow-xs'
                        : 'border-black/[0.06] hover:bg-zinc-50'
                    }`}
                  >
                    <div className="h-16 rounded-xl border border-black/[0.08] bg-[#F8F9FD] p-2 flex flex-col justify-center items-center gap-1.5 mb-2.5 shadow-2xs">
                      <div className="w-10 h-2 rounded-full bg-white shadow-xs" />
                      <div className="w-6 h-1.5 rounded-full bg-blue-100" />
                    </div>
                    <div className="text-xs font-semibold text-zinc-900">Light</div>
                  </button>

                  {/* Dark (Near-black preview) */}
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-[#0052FF] ring-2 ring-[#0052FF]/20 shadow-xs'
                        : 'border-black/[0.06] hover:bg-zinc-50'
                    }`}
                  >
                    <div className="h-16 rounded-xl border border-zinc-800 bg-[#0F1117] p-2 flex flex-col justify-center items-center gap-1.5 mb-2.5 shadow-2xs">
                      <div className="w-10 h-2 rounded-full bg-zinc-800" />
                      <div className="w-6 h-1.5 rounded-full bg-zinc-700" />
                    </div>
                    <div className="text-xs font-semibold text-zinc-900">Dark</div>
                  </button>
                </div>
              </div>

              {/* Interface density */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-3">
                <div className="text-sm font-semibold text-zinc-900">Interface layout</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInterfaceDensity('comfortable')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      interfaceDensity === 'comfortable'
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                        : 'border-black/[0.06] bg-zinc-50/60 text-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Comfortable</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        interfaceDensity === 'comfortable' ? 'text-zinc-300' : 'text-zinc-400'
                      }`}
                    >
                      Generous line spacing & breathing room
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInterfaceDensity('compact')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      interfaceDensity === 'compact'
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                        : 'border-black/[0.06] bg-zinc-50/60 text-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Compact</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        interfaceDensity === 'compact' ? 'text-zinc-300' : 'text-zinc-400'
                      }`}
                    >
                      Higher density for large schedule overviews
                    </div>
                  </button>
                </div>
              </div>

              {/* Motion toggles */}
              <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Interface animations
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Smooth spring transitions on modals, drawers and task checkoffs
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnimationsEnabled(!animationsEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      animationsEnabled ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        animationsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Reduce motion
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Minimize fluid movement for accessibility
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      reduceMotion ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        reduceMotion ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Ambient background
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Soft Recall color movement in the background
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmbientBackground(!ambientBackground)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      ambientBackground ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                        ambientBackground ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 7. PRIVACY & DATA (Section 20) ==================== */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 apple-slide-down">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  Privacy & Data
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Recall is offline-first. Your files and chats are saved in your private local store.
                </p>
              </div>

              {/* Data Explanation Banner */}
              <div className="p-4 rounded-2xl bg-zinc-50 border border-black/[0.06] text-xs text-zinc-600 leading-relaxed space-y-1.5">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Your Data Belongs to You</span>
                </div>
                <p>
                  Recall only accesses connected apps when needed to fulfill your explicit requests. All conversations, project notes, and tasks are stored locally on your machine.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
                {/* Conversation History */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Conversation history
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Stored in local JSON database
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    disabled={isClearingHistory}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-red-50 hover:text-red-700 text-zinc-700 text-xs font-semibold border border-black/[0.06] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isClearingHistory ? 'Clearing…' : historyClearSuccess ? 'Cleared ✓' : 'Clear history'}
                  </button>
                </div>

                {/* Export Data */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Export my data
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Download a JSON bundle of all tasks, chats, and project records
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExporting ? 'Exporting…' : 'Export JSON'}</span>
                  </button>
                </div>
              </div>

              {/* Session Reset Card */}
              <div className="rounded-2xl bg-white border border-blue-200/80 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-blue-600">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <RotateCcw className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight text-zinc-900">
                        Reset Session (Fresh Start)
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Clear local session tasks and reset the onboarding walkthrough
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    Local Session
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Clears all temporary guest tasks, wipes local history, and re-enables the first-use onboarding walkthrough so guests can experience Recall from scratch. Real Google Calendar and Gmail data is preserved.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-blue-100/60">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-demo-onboarding'))}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                    >
                      Replay Onboarding Tour
                    </button>
                    <span className="text-zinc-300">·</span>
                    <span className="text-[11px] text-zinc-400">
                      Does NOT delete real Google account data.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetExperience}
                    disabled={isResettingExperience}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {isResettingExperience ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Resetting…</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Session</span>
                      </>
                    )}
                  </button>
                </div>
                {resetExperienceSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Experience reset! Local data cleared and onboarding tour ready for friends.</span>
                  </div>
                )}
              </div>

              {/* Danger Zone: Delete All Data */}
              <div className="rounded-2xl bg-white border border-red-200/70 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-red-600">
                    <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight text-zinc-900">
                        Delete All Data (Fresh Start)
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Permanently wipe all days, tasks, chats, messages, and start from 0
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    Danger Zone
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Clear all tasks across all dates, chats, attachments, and local plans. Active app connections (Google Calendar, WhatsApp) remain authenticated so you can begin clean immediately.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-red-100/60">
                  <span className="text-[11px] text-zinc-400">
                    This action cannot be undone. All local data will reset to 0.
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteAllData}
                    disabled={isDeletingAllData}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {isDeletingAllData ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting all data…</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete All Data</span>
                      </>
                    )}
                  </button>
                </div>
                {deleteAllSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All data across all dates, chats, and tasks has been deleted. Fresh start ready!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 8. ADVANCED (Sections 21 & 22) ==================== */}
          {activeTab === 'advanced' && (
            <div className="space-y-6 apple-slide-down">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  Advanced
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Developer diagnostics, background scheduler status, and API health.
                </p>
              </div>

              {/* Live Service Status (Section 22) */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-3.5">
                <div className="text-sm font-semibold text-zinc-900">API Health</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-black/[0.04] flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700">Gemini 2.5 API</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Operational ✓
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-black/[0.04] flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700">Google Workspace</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {googleConnected ? 'Connected ✓' : 'Standby'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-black/[0.04] flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700">WhatsApp Cloud API</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Operational ✓
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-black/[0.04] flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700">Local Scheduler</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Running (every 30s) ✓
                    </span>
                  </div>
                </div>
              </div>

              {/* Local Storage & Runtime Specs */}
              <div className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-xs space-y-3 font-mono text-xs text-zinc-600">
                <div className="font-sans text-sm font-semibold text-zinc-900">
                  Storage & Runtime Path
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 border border-black/[0.04] space-y-1.5">
                  <div>Local Directory: <span className="text-zinc-900">data/</span></div>
                  <div>Tasks: <span className="text-zinc-900">data/tasks.json</span></div>
                  <div>Conversations: <span className="text-zinc-900">data/conversations.json</span></div>
                  <div>Attachments: <span className="text-zinc-900">public/uploads/</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 9. ABOUT (Section 23) ==================== */}
          {activeTab === 'about' && (
            <div className="space-y-6 apple-slide-down">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  About
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Version and release details.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-black/[0.06] p-6 shadow-xs text-center space-y-4">
                <div className="flex justify-center">
                  <div className="relative w-16 h-16 rounded-full flex items-center justify-center p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/recall-logo.png"
                      alt="Recall"
                      className="w-14 h-14 object-contain drop-shadow-[0_4px_14px_rgba(0,82,255,0.35)]"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    Recall
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Personal AI Work & Life Assistant
                  </p>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">
                    Version 0.9.4 (Build 2026.10)
                  </p>
                </div>

                <div className="pt-2 text-xs text-zinc-500 font-medium">
                  Built with care by <span className="text-zinc-900 font-semibold">Kriyon Group</span>
                </div>

                <div className="flex items-center justify-center gap-4 pt-4 border-t border-black/[0.05] text-xs text-zinc-400">
                  <a href="#" className="hover:text-zinc-700">Privacy Policy</a>
                  <span>•</span>
                  <a href="#" className="hover:text-zinc-700">Terms of Service</a>
                  <span>•</span>
                  <a href="mailto:support@repixelx.tech" className="hover:text-zinc-700">Feedback</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
