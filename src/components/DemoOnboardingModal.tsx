'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Mic,
  Calendar,
  Zap,
} from 'lucide-react';
import { VoiceOrb, VoiceOrbState } from './VoiceOrb';
import { Button } from '@/components/ui/button';
import { PluginIcon } from './PluginIcon';
import { cn } from '@/lib/utils';
import { setSessionMode, getSessionMode } from '@/lib/user-session';

interface DemoOnboardingModalProps {
  isOpen: boolean;
  onClose: (completedPrompt?: string) => void;
}

export const DemoOnboardingModal: React.FC<DemoOnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentScreen, setCurrentScreen] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [orbState, setOrbState] = useState<VoiceOrbState>('idle');
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1);

  // Notify system when onboarding opens/closes to hide any distracting overlays
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('open-demo-onboarding'));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('recall-onboarding-closed'));
    };
  }, [isOpen]);

  // Screen 3: Auto-cycle through the 3 simple Recall Flow visual steps
  useEffect(() => {
    if (currentScreen !== 3) return;
    const interval = setInterval(() => {
      setFlowStep((prev) => (prev === 3 ? 1 : ((prev + 1) as 1 | 2 | 3)));
    }, 1800);
    return () => clearInterval(interval);
  }, [currentScreen]);

  if (!isOpen) return null;

  const handleFinishOnboarding = (promptToTry?: string) => {
    try {
      localStorage.setItem('recall_demo_onboarding_completed', 'true');
      if (getSessionMode() !== 'google' && getSessionMode() !== 'owner') {
        setSessionMode('guest');
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('recall-onboarding-closed'));
    onClose(promptToTry);
  };

  const handleSkip = () => {
    handleFinishOnboarding();
  };

  const handleNext = () => {
    if (currentScreen < 6) {
      setCurrentScreen((prev) => (prev + 1) as any);
      setOrbState('idle');
    } else {
      handleFinishOnboarding();
    }
  };

  const handleBack = () => {
    if (currentScreen > 1) {
      setCurrentScreen((prev) => (prev - 1) as any);
      setOrbState('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto selection:bg-blue-500/15 selection:text-blue-900 animate-in fade-in duration-300">
      {/* ── HEAVILY SOFTENED / BLURRED BACKGROUND ── */}
      <div
        onClick={handleSkip}
        className="fixed inset-0 bg-black/25 backdrop-blur-xl transition-all duration-500"
      />

      {/* ── LIVING AMBIENT GRADIENT MOVING SLOWLY BEHIND THE CARD ── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden flex items-center justify-center">
        <div className="w-[600px] sm:w-[750px] h-[500px] sm:h-[600px] bg-gradient-to-tr from-[#0052FF]/25 via-[#7928CA]/20 to-[#00D2FF]/25 blur-[100px] rounded-full siri-aura-flow opacity-75 animate-pulse duration-5000" />
      </div>

      {/* ── CENTERED CRISP WHITE / GLASS ONBOARDING CARD ── */}
      <div className="relative w-full max-w-[480px] bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-[32px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.04)] p-6 sm:p-9 flex flex-col items-center text-center space-y-6 relative overflow-hidden transition-all duration-300">
        {/* Top Navigation Row: Back, 6-Dot Indicator, Skip */}
        <div className="w-full flex items-center justify-between text-xs">
          <div className="w-12 text-left">
            {currentScreen > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : null}
          </div>

          {/* 6 Step Indicators */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div
                key={step}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  currentScreen === step
                    ? 'w-6 bg-gradient-to-r from-[#0052FF] via-[#00D2FF] to-[#7928CA]'
                    : currentScreen > step
                    ? 'w-1.5 bg-blue-600/40'
                    : 'w-1.5 bg-zinc-200 dark:bg-zinc-800'
                )}
              />
            ))}
          </div>

          <div className="w-12 text-right">
            <button
              type="button"
              onClick={handleSkip}
              className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>

        {/* =========================================================================
            SCREEN 1 — WELCOME
           ========================================================================= */}
        {currentScreen === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            {/* Living Recall Orb */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center mx-auto my-2">
              <div className="absolute inset-[-10px] rounded-full bg-gradient-to-tr from-[#0052FF]/25 via-[#7928CA]/20 to-[#00D2FF]/25 blur-xl pointer-events-none siri-orb-breathing" />
              <VoiceOrb state="idle" size="xl" className="w-28 h-28 sm:w-32 sm:h-32" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Welcome to Recall
              </h1>
              <p className="text-sm sm:text-base font-medium text-zinc-600 dark:text-zinc-300">
                Your personal AI assistant.
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1 leading-relaxed">
                Say what you need. Recall handles the rest.
              </p>
            </div>

            <div className="pt-2 w-full">
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-black text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group recall-btn-gradient"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 2 — JUST TELL RECALL
           ========================================================================= */}
        {currentScreen === 2 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            {/* Smaller Orb Centerpiece */}
            <div className="relative w-20 h-20 flex items-center justify-center mx-auto my-1">
              <VoiceOrb state="idle" size="md" className="siri-orb-breathing" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Just tell Recall.
              </h1>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Speak or type in your own natural words.
              </p>
            </div>

            {/* 3 Short Examples Only (Minimal Pills) */}
            <div className="space-y-2.5 w-full pt-1">
              {[
                { text: '“Meeting tomorrow at 4.”', tag: 'Schedule' },
                { text: '“Remind me to send the proposal.”', tag: 'Reminder' },
                { text: '“Plan my day.”', tag: 'Organize' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-left hover:border-blue-300 dark:hover:border-blue-700/60 hover:bg-white dark:hover:bg-zinc-800 transition-all duration-200 shadow-2xs group"
                >
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {item.text}
                  </span>
                  <span className="text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60">
                    {item.tag}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 w-full">
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-black text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group recall-btn-gradient"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 3 — RECALL FLOW
           ========================================================================= */}
        {currentScreen === 3 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            <div className="relative w-16 h-16 flex items-center justify-center mx-auto">
              <VoiceOrb
                state={flowStep === 1 ? 'listening' : flowStep === 2 ? 'processing' : 'success'}
                size="md"
              />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Don’t type. Just speak.
              </h1>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Dictate, clean, or take action anywhere via Option + Space.
              </p>
            </div>

            {/* Visual Minimal Recall Flow Animation: Speak -> Clean text -> Inserted */}
            <div className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/[0.05] dark:border-white/[0.06] space-y-2 text-left">
              {/* 1. Speak */}
              <div
                className={cn(
                  'px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-300 flex items-center justify-between',
                  flowStep === 1
                    ? 'bg-blue-50/90 border-blue-200 text-blue-950 font-semibold shadow-2xs'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Mic className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">“Tell Rahul I’ll send it tomorrow”</span>
                </div>
                <span className="text-[10px] uppercase font-mono text-blue-600 font-semibold">
                  Speak
                </span>
              </div>

              {/* Arrow */}
              <div className="flex justify-center text-zinc-300 dark:text-zinc-700 text-xs font-bold">
                ↓
              </div>

              {/* 2. Clean Text */}
              <div
                className={cn(
                  'px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-300 flex items-center justify-between',
                  flowStep === 2
                    ? 'bg-purple-50/90 border-purple-200 text-purple-950 font-semibold shadow-2xs'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                )}
              >
                <span className="truncate">“Hi Rahul, I’ll send the proposal tomorrow.”</span>
                <span className="text-[10px] uppercase font-mono text-purple-600 font-semibold">
                  Clean
                </span>
              </div>

              {/* Arrow */}
              <div className="flex justify-center text-zinc-300 dark:text-zinc-700 text-xs font-bold">
                ↓
              </div>

              {/* 3. Inserted */}
              <div
                className={cn(
                  'px-3.5 py-2 rounded-xl border text-xs transition-all duration-300 flex items-center justify-center gap-1.5 font-semibold',
                  flowStep === 3
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Inserted into active app ✓</span>
              </div>
            </div>

            <div className="pt-2 w-full">
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-black text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group recall-btn-gradient"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 4 — CONNECT WHAT YOU USE
           ========================================================================= */}
        {currentScreen === 4 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Connect what you use.
              </h1>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Recall works better with the apps you already use.
              </p>
            </div>

            {/* Clean Official App Icons (No Giant Cards) */}
            <div className="grid grid-cols-5 gap-2.5 w-full pt-2">
              {[
                { name: 'Calendar', type: 'calendar' },
                { name: 'Gmail', type: 'gmail' },
                { name: 'Drive', type: 'drive' },
                { name: 'WhatsApp', type: 'whatsapp' },
                { name: 'Notion', type: 'notion' },
              ].map((app) => (
                <div
                  key={app.name}
                  className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center justify-center space-y-2 hover:scale-105 hover:bg-white dark:hover:bg-zinc-800 transition-all duration-200 shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-xs border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-center">
                    <PluginIcon id={app.type as any} size={20} />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                    {app.name}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
              You can connect or disconnect any tool at any time in Settings.
            </p>

            <div className="pt-2 w-full">
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-black text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group recall-btn-gradient"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 5 — CONTINUE WITH RECALL
           ========================================================================= */}
        {currentScreen === 5 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Continue with Recall
              </h1>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Choose how you’d like to begin.
              </p>
            </div>

            <div className="w-full space-y-3 pt-2">
              {/* Proper Official Google Sign-In Button */}
              <a
                href="/api/auth/google?returnTo=/"
                className="w-full h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:shadow-xs text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-3 transition-all cursor-pointer recall-btn-gradient"
              >
                {/* Official Google 4-Color G SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA3423"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </a>

              {/* Minimal Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                <span className="text-[11px] font-medium text-zinc-400">or</span>
                <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
              </div>

              {/* Continue as Guest */}
              <Button
                variant="outline"
                onClick={() => {
                  setSessionMode('guest');
                  handleNext();
                }}
                className="w-full h-12 rounded-2xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer"
              >
                <span>Continue as Guest</span>
              </Button>

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
                You can connect Google later.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 6 — YOU'RE READY
           ========================================================================= */}
        {currentScreen === 6 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            {/* Large Living Recall Orb */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center mx-auto my-2">
              <div className="absolute inset-[-12px] rounded-full bg-gradient-to-tr from-[#0052FF]/20 via-[#7928CA]/20 to-[#00D2FF]/20 blur-xl pointer-events-none siri-orb-breathing" />
              <VoiceOrb state="idle" size="xl" className="w-28 h-28 sm:w-32 sm:h-32" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                You’re ready.
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Click below to start using Recall.
              </p>
            </div>

            <div className="pt-2 w-full">
              <Button
                onClick={() => handleFinishOnboarding()}
                className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-black text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group recall-btn-gradient"
              >
                <span>Open Recall</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
