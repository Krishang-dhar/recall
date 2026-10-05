'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Globe,
  Smartphone,
  Database,
  CheckCircle2,
  ExternalLink,
  LogOut,
  SlidersHorizontal,
  Folder,
  MessageSquare,
  CheckSquare,
  CreditCard,
  Zap,
  Check,
} from 'lucide-react';
import { PluginIcon } from '@/components/PluginIcon';
import { useUserSession } from '@/lib/user-session';

export default function AccountPage() {
  const { session } = useUserSession();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    conversations: 0,
    tasks: 0,
    projects: 0,
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [userName, setUserName] = useState('');
  const [subscription, setSubscription] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    setUserName(session.name);
  }, [session.name]);

  useEffect(() => {
    async function loadData() {
      if (session.isGuest) {
        setGoogleConnected(false);
        setGoogleEmail(null);
        setWhatsAppRecipient(null);
        try {
          const guestTasks = JSON.parse(localStorage.getItem('recall_guest_tasks') || '[]');
          const guestConvs = JSON.parse(localStorage.getItem('recall_guest_conversations') || '[]');
          setStats({
            tasks: Array.isArray(guestTasks) ? guestTasks.length : 0,
            conversations: Array.isArray(guestConvs) ? guestConvs.length : 0,
            projects: 0,
          });
        } catch {
          setStats({ tasks: 0, conversations: 0, projects: 0 });
        }
        return;
      }

      try {
        const [statusRes, tasksRes, convsRes, projsRes, billRes] = await Promise.all([
          fetch('/api/google/status', {
            headers: { 'x-session-mode': session.mode },
          }),
          fetch('/api/tasks'),
          fetch('/api/conversations'),
          fetch('/api/projects'),
          fetch('/api/billing'),
        ]);

        const statusData = await statusRes.json();
        if (statusData?.google?.connected) {
          setGoogleConnected(true);
          setGoogleEmail(statusData.google.email || null);
        } else {
          setGoogleConnected(false);
          setGoogleEmail(null);
        }

        if (statusData?.whatsapp?.connected && statusData?.whatsapp?.recipient) {
          setWhatsAppRecipient(`+${statusData.whatsapp.recipient.replace(/^\+/, '')}`);
        } else {
          setWhatsAppRecipient(null);
        }

        const tasksData = await tasksRes.json();
        const convsData = await convsRes.json();
        const projsData = await projsRes.json();
        const billData = await billRes.json();

        setStats({
          tasks: tasksData.tasks?.length || 0,
          conversations: convsData.conversations?.length || 0,
          projects: projsData.projects?.length || 0,
        });

        if (billData?.subscription) {
          setSubscription(billData.subscription);
        }
      } catch (e) {}
    }
    loadData();
  }, [session.mode, session.isGuest]);

  const handleSwitchPlan = async (planId: 'personal' | 'pro') => {
    setBillingLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch_plan', planId }),
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleToggleInterval = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_interval' }),
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 md:pb-12 max-w-[760px] mx-auto apple-fade-in px-2 sm:px-4 pt-2 sm:pt-4">
      {/* Top Header */}
      <section className="flex items-center justify-between pb-4 border-b border-black/[0.05]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
            Account
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Your local Recall identity and connected services.
          </p>
        </div>

        <Link
          href="/settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Settings</span>
        </Link>
      </section>

      {/* Profile Card Hero */}
      <div className="p-6 rounded-2xl bg-white border border-black/[0.06] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl p-[2px] bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] shadow-sm shrink-0">
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center font-bold text-xl text-zinc-900">
              {session.initials}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
                {userName || session.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-semibold text-[#0052FF]">
                {session.role}
              </span>
            </div>
            {googleConnected && googleEmail ? (
              <div className="text-xs text-zinc-400 mt-0.5 font-mono">{googleEmail}</div>
            ) : session.isGuest ? (
              <div className="mt-1">
                <a
                  href="/api/auth/google?returnTo=/account"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  Sign in with Google to sync your data →
                </a>
              </div>
            ) : session.email ? (
              <div className="text-xs text-zinc-400 mt-0.5 font-mono">{session.email}</div>
            ) : null}
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{session.isGuest ? 'Local session · Private & Isolated' : 'Offline-first local store active'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const newName = prompt('Enter profile name:', userName);
            if (newName && newName.trim()) setUserName(newName.trim());
          }}
          className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold border border-black/[0.05] cursor-pointer"
        >
          Edit profile
        </button>
      </div>

      {/* Personal Details */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">
          Personal details
        </h3>

        <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-400">Name</div>
              <div className="text-sm font-semibold text-zinc-900 mt-0.5">{userName}</div>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-400">Timezone</div>
              <div className="text-sm font-semibold text-zinc-900 mt-0.5">Asia/Kolkata (IST +5:30)</div>
            </div>
          </div>
        </div>
      </section>

      {/* SaaS Subscription & Plan */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Subscription & Plan
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className={subscription?.interval === 'month' ? 'font-semibold text-zinc-900' : 'text-zinc-400'}>
              Monthly
            </span>
            <button
              type="button"
              onClick={handleToggleInterval}
              disabled={billingLoading}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                subscription?.interval === 'year' ? 'bg-[#0052FF]' : 'bg-zinc-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                  subscription?.interval === 'year' ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={subscription?.interval === 'year' ? 'font-semibold text-zinc-900' : 'text-zinc-400'}>
              Yearly <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded">Save 17%</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recall Personal */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              subscription?.planId === 'personal'
                ? 'bg-white border-[#0052FF] ring-2 ring-[#0052FF]/20 shadow-xs'
                : 'bg-white/80 border-black/[0.06] hover:border-black/[0.12]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Recall Personal</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Your core personal AI assistant</p>
              </div>
              {subscription?.planId === 'personal' && (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-[#0052FF]">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-zinc-900">
                ${subscription?.interval === 'year' ? '99.00' : '9.99'}
              </span>
              <span className="text-xs text-zinc-400">/{subscription?.interval === 'year' ? 'yr' : 'mo'}</span>
            </div>

            <ul className="mt-4 space-y-2 text-xs text-zinc-600">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Recall Flow macOS layer (Option + Space)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Intelligent day planner with real calendar auto-positioning</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Smart Reminders (Desktop, Calendar, optional WhatsApp)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Local-first vault + Action History with Undo</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => handleSwitchPlan('personal')}
              disabled={billingLoading || subscription?.planId === 'personal'}
              className={`w-full mt-5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                subscription?.planId === 'personal'
                  ? 'bg-zinc-100 text-zinc-400 cursor-default'
                  : 'bg-zinc-900 hover:bg-black text-white'
              }`}
            >
              {subscription?.planId === 'personal' ? 'Active' : 'Switch to Personal'}
            </button>
          </div>

          {/* Recall Pro */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              subscription?.planId === 'pro'
                ? 'bg-white border-[#0052FF] ring-2 ring-[#0052FF]/20 shadow-xs'
                : 'bg-white/80 border-black/[0.06] hover:border-black/[0.12]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-zinc-900">Recall Pro</h4>
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">Deep reasoning & power automation</p>
              </div>
              {subscription?.planId === 'pro' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-[#0052FF]">
                  Current Plan
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-[10px] font-bold text-white shadow-2xs">
                  Upgrade
                </span>
              )}
            </div>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-zinc-900">
                ${subscription?.interval === 'year' ? '149.00' : '14.99'}
              </span>
              <span className="text-xs text-zinc-400">/{subscription?.interval === 'year' ? 'yr' : 'mo'}</span>
            </div>

            <ul className="mt-4 space-y-2 text-xs text-zinc-600">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Everything in Personal included</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Deep Reasoning AI (Gemini 2.5 Pro priority tier)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Unlimited Recall Flow dictation & transcription</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>High-priority WhatsApp dispatch & cloud sync</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => handleSwitchPlan('pro')}
              disabled={billingLoading || subscription?.planId === 'pro'}
              className={`w-full mt-5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                subscription?.planId === 'pro'
                  ? 'bg-zinc-100 text-zinc-400 cursor-default'
                  : 'bg-gradient-to-r from-[#0052FF] via-[#0066FF] to-[#7928CA] text-white hover:opacity-95 shadow-2xs'
              }`}
            >
              {subscription?.planId === 'pro' ? 'Active' : 'Upgrade to Pro'}
            </button>
          </div>
        </div>
      </section>

      {/* Connected Identities */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">
          Connected identity
        </h3>

        <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
          {/* Google */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <PluginIcon id="calendar" size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900">Google Workspace</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {googleConnected ? (googleEmail || 'Connected') : 'Not linked'}
                </div>
              </div>
            </div>

            {googleConnected ? (
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-3 py-1 rounded-full text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Connected</span>
              </span>
            ) : (
              <a
                href="/api/auth/google?returnTo=/account"
                className="px-3.5 py-1.5 rounded-xl bg-[#0052FF] text-white text-xs font-semibold cursor-pointer"
              >
                Connect
              </a>
            )}
          </div>

          {/* WhatsApp */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <PluginIcon id="whatsapp" size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900">WhatsApp Reminder Channel</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {whatsAppRecipient ? `Connected to ${whatsAppRecipient}` : 'Not connected · Configure in Settings'}
                </div>
              </div>
            </div>

            {whatsAppRecipient ? (
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-3 py-1 rounded-full text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Connected</span>
              </span>
            ) : (
              <Link
                href="/settings"
                className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold cursor-pointer"
              >
                Configure
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Local Workspace Data Summary */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">
          Local data vault
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>Conversations</span>
            </div>
            <div className="text-xl font-bold text-zinc-900 mt-1.5">
              {stats.conversations}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>Tasks</span>
            </div>
            <div className="text-xl font-bold text-zinc-900 mt-1.5">
              {stats.tasks}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <Folder className="w-3.5 h-3.5 text-purple-500" />
              <span>Projects</span>
            </div>
            <div className="text-xl font-bold text-zinc-900 mt-1.5">
              {stats.projects}
            </div>
          </div>
        </div>
      </section>

      {/* Disconnect Google if connected */}
      {googleConnected && (
        <section className="pt-2 flex justify-end">
          <button
            onClick={async () => {
              if (confirm('Disconnect Google account from Recall?')) {
                await fetch('/api/google/disconnect');
                window.location.reload();
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer p-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect Google</span>
          </button>
        </section>
      )}
    </div>
  );
}
