'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Check,
  Zap,
  ArrowLeft,
  Shield,
  Clock,
  HelpCircle,
  ArrowRight,
  SlidersHorizontal,
  Mic,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { VoiceOrb } from '@/components/VoiceOrb';

export default function PricingPage() {
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'personal' | 'pro'>('personal');

  useEffect(() => {
    async function loadBilling() {
      try {
        const res = await fetch('/api/billing');
        const data = await res.json();
        if (data.success && data.subscription) {
          setSubscription(data.subscription);
          if (data.subscription.interval) {
            setInterval(data.subscription.interval);
          }
          if (data.subscription.planId) {
            setSelectedPlan(data.subscription.planId);
          }
        }
      } catch (e) {
        console.error('Failed to load billing:', e);
      }
    }
    loadBilling();
  }, []);

  const handleSelectPlan = async (planId: 'personal' | 'pro') => {
    setIsLoading(true);
    setSelectedPlan(planId);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch_plan', planId, interval }),
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleInterval = async () => {
    const nextInterval = interval === 'month' ? 'year' : 'month';
    setInterval(nextInterval);
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fbfbfd] text-zinc-900 apple-fade-in pb-28">
      {/* Top Navigation */}
      <header className="w-full border-b border-black/[0.05] bg-white/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Recall</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-full hover:bg-black/[0.04] transition-all"
            >
              Account
            </Link>
            <Link
              href="/settings"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-full hover:bg-black/[0.04] transition-all"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="max-w-4xl mx-auto pt-14 pb-8 px-4 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-semibold text-[#0052FF]">
          <Shield className="w-3.5 h-3.5" />
          <span>Simple, transparent pricing</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-zinc-900">
          SAY IT. RECALL HANDLES IT.
        </h1>
        <p className="text-sm sm:text-base text-zinc-500 max-w-xl mx-auto leading-relaxed">
          Your personal AI assistant that listens, writes, remembers, plans, schedules, reminds, and takes action.
        </p>

        {/* Billing Interval Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span className={`text-xs font-semibold ${interval === 'month' ? 'text-zinc-900' : 'text-zinc-400'}`}>
            Monthly
          </span>
          <button
            type="button"
            onClick={handleToggleInterval}
            disabled={isLoading}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              interval === 'year' ? 'bg-[#0052FF]' : 'bg-zinc-200'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-xs ${
                interval === 'year' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold ${interval === 'year' ? 'text-zinc-900' : 'text-zinc-400'}`}>
              Yearly
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[10px] font-bold text-emerald-700">
              Save 17%
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="max-w-4xl mx-auto px-4 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plan 1: Recall Personal */}
        <div
          className={`relative p-6 sm:p-8 rounded-[28px] border transition-all flex flex-col justify-between ${
            subscription?.planId === 'personal'
              ? 'bg-white border-[#0052FF] ring-2 ring-[#0052FF]/20 shadow-md'
              : 'bg-white/80 border-black/[0.08] hover:border-black/[0.15] shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Recall Personal</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Your core daily personal AI assistant</p>
              </div>
              {subscription?.planId === 'personal' && (
                <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#0052FF]">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-extrabold text-zinc-900">
                ${interval === 'year' ? '99' : '9.99'}
              </span>
              <span className="text-xs sm:text-sm text-zinc-400 font-medium">
                /{interval === 'year' ? 'year ($8.25/mo)' : 'month'}
              </span>
            </div>

            <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
              Complete intelligence for everyday planning, natural speech cleanup, and smart reminders.
            </p>

            <div className="mt-6 pt-6 border-t border-black/[0.05] space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Everything you get:
              </div>
              <ul className="space-y-2.5 text-xs text-zinc-700">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <span><strong>Full Personal AI Assistant</strong> (intent parsing for tasks, day plans & notes)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <span><strong>Recall Flow macOS Voice Layer</strong> (system-wide Option + Space)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <span><strong>Intelligent Day Planner</strong> with calendar auto-positioning</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <span><strong>Smart Multi-Channel Reminders</strong> (Desktop, Calendar, optional WhatsApp)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <span><strong>Speech Translation & Polish</strong> (English, Hindi, Hinglish)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <span><strong>Action History with 1-Click Undo</strong> on calendar events & tasks</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
                  <span><strong>Offline-First Local Vault</strong> with privacy-first architecture</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSelectPlan('personal')}
            disabled={isLoading || subscription?.planId === 'personal'}
            className={`w-full mt-8 py-3 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              subscription?.planId === 'personal'
                ? 'bg-zinc-100 text-zinc-400 cursor-default'
                : 'bg-zinc-900 hover:bg-black text-white active:scale-98'
            }`}
          >
            {subscription?.planId === 'personal' ? 'Current Plan Active' : 'Switch to Personal'}
          </button>
        </div>

        {/* Plan 2: Recall Pro */}
        <div
          className={`relative p-6 sm:p-8 rounded-[28px] border transition-all flex flex-col justify-between ${
            subscription?.planId === 'pro'
              ? 'bg-white border-[#0052FF] ring-2 ring-[#0052FF]/20 shadow-md'
              : 'bg-white/95 border-blue-200/80 hover:border-blue-300 shadow-sm'
          }`}
        >
          {/* Popular Tag */}
          <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-[#0052FF] via-[#0066FF] to-[#7928CA] text-white text-[10px] font-bold shadow-2xs">
            Most Popular
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-lg font-bold text-zinc-900">Recall Pro</h3>
                  <Zap className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">Deep reasoning & power automation</p>
              </div>
              {subscription?.planId === 'pro' && (
                <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#0052FF]">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-extrabold text-zinc-900">
                ${interval === 'year' ? '149' : '14.99'}
              </span>
              <span className="text-xs sm:text-sm text-zinc-400 font-medium">
                /{interval === 'year' ? 'year ($12.41/mo)' : 'month'}
              </span>
            </div>

            <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
              For ambitious professionals who need unlimited voice dictation, deep reasoning, and high priority.
            </p>

            <div className="mt-6 pt-6 border-t border-black/[0.05] space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Everything in Personal, plus:
              </div>
              <ul className="space-y-2.5 text-xs text-zinc-700">
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>Deep Reasoning Tier</strong> (Gemini 2.5 Pro priority depth for complex workflows)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>Unlimited Recall Flow Voice</strong> dictation, transcription, and rewriting</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>High-Priority Instant WhatsApp Dispatch</strong> for urgent notifications</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>Multi-Calendar Sync</strong> (up to 3 distinct Google accounts)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>Encrypted Cloud Sync</strong> for cross-device access</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span><strong>Early Access</strong> to new companion modules and custom dictionary features</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSelectPlan('pro')}
            disabled={isLoading || subscription?.planId === 'pro'}
            className={`w-full mt-8 py-3 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              subscription?.planId === 'pro'
                ? 'bg-zinc-100 text-zinc-400 cursor-default'
                : 'bg-gradient-to-r from-[#0052FF] via-[#0066FF] to-[#7928CA] text-white hover:opacity-95 active:scale-98'
            }`}
          >
            {subscription?.planId === 'pro' ? 'Current Plan Active' : 'Upgrade to Pro'}
          </button>
        </div>
      </section>

      {/* Feature Comparison Highlights */}
      <section className="max-w-4xl mx-auto px-4 pt-16">
        <h2 className="text-xl font-bold text-center text-zinc-900 tracking-tight">
          Feature Comparison
        </h2>
        <p className="text-xs text-center text-zinc-400 mt-1 mb-8">
          Clear, honest boundaries. No hidden fees or locked basic features.
        </p>

        <div className="rounded-[24px] bg-white border border-black/[0.06] overflow-hidden shadow-xs divide-y divide-black/[0.04]">
          <div className="grid grid-cols-3 p-4 text-xs font-semibold text-zinc-500 bg-zinc-50/50">
            <div>Capability</div>
            <div className="text-center">Personal ($9.99/mo)</div>
            <div className="text-center font-bold text-[#0052FF]">Pro ($14.99/mo)</div>
          </div>

          <div className="grid grid-cols-3 p-4 text-xs text-zinc-800 items-center">
            <div className="font-medium">Recall Flow macOS companion</div>
            <div className="text-center">Included (Option + Space)</div>
            <div className="text-center font-semibold text-emerald-600">Included (Priority)</div>
          </div>

          <div className="grid grid-cols-3 p-4 text-xs text-zinc-800 items-center">
            <div className="font-medium">AI Reasoning model</div>
            <div className="text-center">Gemini 2.5 Flash</div>
            <div className="text-center font-semibold text-emerald-600">Gemini 2.5 Pro Deep</div>
          </div>

          <div className="grid grid-cols-3 p-4 text-xs text-zinc-800 items-center">
            <div className="font-medium">Voice transcription minutes</div>
            <div className="text-center">600 mins/mo</div>
            <div className="text-center font-semibold text-emerald-600">Unlimited</div>
          </div>

          <div className="grid grid-cols-3 p-4 text-xs text-zinc-800 items-center">
            <div className="font-medium">Multi-channel reminders</div>
            <div className="text-center">Recall + Calendar + WhatsApp</div>
            <div className="text-center font-semibold text-emerald-600">Instant High-Priority</div>
          </div>

          <div className="grid grid-cols-3 p-4 text-xs text-zinc-800 items-center">
            <div className="font-medium">Action History & 1-Click Undo</div>
            <div className="text-center">Full support</div>
            <div className="text-center font-semibold text-emerald-600">Full support</div>
          </div>

          <div className="grid grid-cols-3 p-4 text-xs text-zinc-800 items-center">
            <div className="font-medium">Google Workspace sync</div>
            <div className="text-center">1 Account</div>
            <div className="text-center font-semibold text-emerald-600">Up to 3 Accounts</div>
          </div>
        </div>
      </section>

      {/* Trust & Guarantee */}
      <section className="max-w-4xl mx-auto px-4 pt-12 flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-zinc-100/70 border border-black/[0.04] mt-12">
        <div className="flex items-center gap-3.5">
          <Shield className="w-8 h-8 text-[#0052FF] shrink-0" />
          <div>
            <div className="text-xs font-bold text-zinc-900">14-Day Money-Back Guarantee</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              Try Recall risk-free. Cancel or switch plans anytime with one click in your account.
            </div>
          </div>
        </div>

        <Link
          href="/account"
          className="px-4 py-2 rounded-xl bg-white border border-black/[0.08] hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition-all cursor-pointer shadow-2xs shrink-0"
        >
          Manage in Account
        </Link>
      </section>
    </div>
  );
}
