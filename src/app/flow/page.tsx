'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Mic,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { VoiceOrb } from '@/components/VoiceOrb';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlowDictionaryTerm } from '@/lib/flow-settings';
import { cn } from '@/lib/utils';
import { RecallSelect, SelectOption } from '@/components/RecallSelect';
import { useRecallFlowEngine } from '@/lib/useRecallFlowEngine';
import { PluginIcon } from '@/components/PluginIcon';

const INPUT_LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'auto', label: 'Auto Detect', sublabel: 'Listens to English, Hindi, Spanish, etc.' },
  { value: 'en', label: 'English', sublabel: 'All accents supported' },
  { value: 'hi', label: 'Hindi (हिंदी)', sublabel: 'Devanagari or Romanized' },
  { value: 'hinglish', label: 'Hinglish', sublabel: 'Colloquial blend' },
  { value: 'es', label: 'Spanish (Español)', sublabel: 'Castilian & Latin American' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'ja', label: 'Japanese (日本語)' },
  { value: 'pt', label: 'Portuguese (Português)' },
  { value: 'it', label: 'Italian (Italiano)' },
];

const OUTPUT_LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'auto', label: 'Auto (English)', sublabel: 'Transcribed & polished in English' },
  { value: 'same', label: 'Same as Spoken', sublabel: 'No language translation' },
  { value: 'en', label: 'English', sublabel: 'Standard English' },
  { value: 'hi', label: 'Hindi (हिंदी)', sublabel: 'Translated to Hindi' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'ja', label: 'Japanese (日本語)' },
];

export default function RecallFlowPage() {
  const {
    phase: flowPhase,
    transcript: liveTranscript,
    cleanedResult,
    volume,
    resultHeadline,
    resultDetails,
    askAnswer,
    toolInfo,
    choices,
    errorMessage,
    copiedSuccess,
    settings,
    startListening: startHeroFlow,
    stopAndProcess: stopAndProcessFlow,
    cancel: cancelHeroFlow,
    updateSettings: update,
    copyResult,
  } = useRecallFlowEngine({ autoInsert: false });

  const [isMounted, setIsMounted] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<'natural' | 'professional' | 'casual' | 'concise' | 'exact'>(
    (settings.style as any) || 'natural'
  );
  const [newWord, setNewWord] = useState('');
  const [isOrbHovered, setIsOrbHovered] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (settings.style && ['natural', 'professional', 'casual', 'concise', 'exact'].includes(settings.style)) {
      setSelectedStyle(settings.style as any);
    }
  }, [settings.style]);

  const handleRewrite = async (style: string = 'concise') => {
    const textToRewrite = cleanedResult || resultDetails || liveTranscript;
    if (!textToRewrite) return;
    setIsRewriting(true);
    try {
      const res = await fetch('/api/ai/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToRewrite,
          userPreferences: { style },
          chosenIntent: 'write',
        }),
      });
      const data = await res.json();
      if (data.success && data.rewrittenText) {
        copyResult();
      }
    } catch (e) {
      console.warn('Rewrite error:', e);
    } finally {
      setIsRewriting(false);
    }
  };

  // Keyboard shortcut listener: Enter to stop when listening, Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (flowPhase === 'listening') {
        if (e.key === 'Enter') {
          e.preventDefault();
          stopAndProcessFlow();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelHeroFlow();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flowPhase, stopAndProcessFlow, cancelHeroFlow]);

  // Keep success result permanent until user clicks Done or cross (X)

  const handleAddWord = () => {
    const trimmed = newWord.trim();
    if (!trimmed) return;
    const exists = settings.dictionary.some((d) => d.term.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const entry: FlowDictionaryTerm = {
        id: crypto.randomUUID(),
        term: trimmed,
        category: 'custom',
      };
      update({ dictionary: [...settings.dictionary, entry] });
    }
    setNewWord('');
  };

  const handleAddExampleWord = (term: string) => {
    const exists = settings.dictionary.some((d) => d.term.toLowerCase() === term.toLowerCase());
    if (!exists) {
      const entry: FlowDictionaryTerm = {
        id: crypto.randomUUID(),
        term,
        category: 'custom',
      };
      update({ dictionary: [...settings.dictionary, entry] });
    }
  };

  const handleRemoveWord = (id: string) => {
    update({ dictionary: settings.dictionary.filter((d) => d.id !== id) });
  };

  // Writing Style Sentence Previews
  const STYLE_PREVIEWS = {
    natural: 'We need to finalize the pitch deck before 3:00 PM tomorrow.',
    professional: 'We must finalize and approve the pitch deck prior to 3:00 PM tomorrow.',
    casual: "Let's get the pitch deck wrapped up by 3 PM tomorrow.",
    concise: 'Finalize pitch deck by 3 PM tomorrow.',
    exact: 'Yeah so basically, um, we need to finalize the pitch deck before 3 PM tomorrow, right?',
  };

  return (
    <div className="w-full max-w-[820px] mx-auto px-4 sm:px-6 pb-24 pt-2 space-y-14 selection:bg-blue-500/15 selection:text-blue-900">
      {/* ── TOP BREADCRUMB ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-1.5"
          >
            <span>Recall</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
          </Link>
          <span className="text-xs font-semibold text-zinc-900">Recall Flow</span>
        </div>

        {/* Minimal Apple-style Pure Green Indicator */}
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-600 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            </span>
            <span className="tracking-tight">Active</span>
          </div>
          <kbd className="px-2 py-0.5 rounded-md bg-zinc-100 border border-black/[0.08] text-[11px] font-mono font-semibold text-zinc-600 shadow-2xs">
            ⌥ Space
          </kbd>
        </div>
      </div>

      {/* ── TOP HERO: LIVING RECALL ORB ─────────────────────────────────── */}
      <section className="text-center relative flex flex-col items-center pt-2">
        {/* Ambient atmospheric aura */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-[#0052FF]/15 via-[#7928CA]/10 to-[#00D2FF]/15 blur-3xl pointer-events-none -z-10" />

        {/* Large Living Recall Orb */}
        <div
          onMouseEnter={() => setIsOrbHovered(true)}
          onMouseLeave={() => setIsOrbHovered(false)}
          className="relative mb-5 cursor-pointer"
          onClick={flowPhase === 'listening' ? () => stopAndProcessFlow() : startHeroFlow}
          title={
            flowPhase === 'listening'
              ? 'Click to finish & process (or press Enter)'
              : 'Click to start Recall Flow'
          }
        >
          {/* Subtle Outer Atmosphere with reactive glow */}
          <div
            className={cn(
              'absolute inset-[-12px] rounded-full blur-xl transition-all duration-500 pointer-events-none bg-gradient-to-tr from-[#0052FF]/35 via-[#7928CA]/25 to-[#00D2FF]/30',
              flowPhase === 'listening'
                ? 'scale-125 opacity-80 siri-aura-flow'
                : isOrbHovered
                ? 'scale-110 opacity-70'
                : 'opacity-40 siri-orb-breathing'
            )}
          />

          {/* Living Orb Centerpiece */}
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_8px_24px_rgba(0,82,255,0.3)]">
            <VoiceOrb
              state={
                flowPhase === 'listening'
                  ? 'listening'
                  : flowPhase === 'understanding' || flowPhase === 'writing' || flowPhase === 'acting'
                  ? 'processing'
                  : flowPhase === 'success'
                  ? 'success'
                  : 'idle'
              }
              audioVolume={volume}
              size="xl"
              withGlow={true}
              className="w-32 h-32 sm:w-36 sm:h-36"
            />
          </div>
        </div>

        {/* ── 1. ACTIVE LISTENING STATE ── */}
        {flowPhase === 'listening' && (
          <div className="max-w-md w-full px-4 animate-in fade-in zoom-in-95 duration-200 space-y-3 flex flex-col items-center">
            <div className="text-sm font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Listening…</span>
            </div>

            <div className="w-full p-4 rounded-2xl bg-white/95 backdrop-blur-xl border border-blue-200/80 shadow-sm text-center min-h-[56px] flex items-center justify-center">
              {liveTranscript ? (
                <span className="text-zinc-900 text-sm font-medium leading-relaxed">
                  “{liveTranscript}”
                </span>
              ) : (
                <span className="text-zinc-400 text-xs">
                  Listening for your speech…
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => stopAndProcessFlow()}
                className="h-8 px-4 rounded-full bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Stop & Process (Enter)
              </Button>
              <button
                type="button"
                onClick={cancelHeroFlow}
                className="text-xs text-zinc-400 hover:text-zinc-700 px-3 py-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        )}

        {/* ── 2. PROCESSING STATE ── */}
        {(flowPhase === 'understanding' || flowPhase === 'writing' || flowPhase === 'acting') && (
          <div className="max-w-md w-full px-4 animate-in fade-in duration-200 space-y-2 flex flex-col items-center">
            <div className="text-sm font-semibold text-purple-900 tracking-tight flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
              <span>
                {flowPhase === 'acting'
                  ? 'Running Recall action…'
                  : flowPhase === 'writing'
                  ? 'Cleaning message…'
                  : 'Processing…'}
              </span>
            </div>

            {liveTranscript && (
              <div className="w-full p-3.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-purple-200/80 shadow-sm text-center">
                <span className="text-zinc-700 text-xs italic">
                  “{liveTranscript}”
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── 3. NO SPEECH DETECTED ── */}
        {flowPhase === 'no_speech' && (
          <div className="max-w-md w-full px-4 animate-in fade-in zoom-in-95 duration-200 space-y-3 flex flex-col items-center">
            <div className="space-y-0.5 text-center">
              <div className="text-base font-semibold text-zinc-900">
                Didn’t catch that.
              </div>
              <div className="text-xs text-zinc-400">
                No speech was detected. Speak again when ready.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={startHeroFlow}
                className="h-10 px-5 rounded-full bg-zinc-950 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer recall-btn-gradient"
              >
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={cancelHeroFlow}
                className="h-10 px-4 rounded-full text-xs font-medium text-zinc-600 border-black/[0.08] hover:bg-black/5"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── 4. ERROR STATE ── */}
        {flowPhase === 'error' && (
          <div className="max-w-md w-full px-4 animate-in fade-in zoom-in-95 duration-200 space-y-3 flex flex-col items-center">
            <div className="space-y-0.5 text-center">
              <div className="text-base font-semibold text-zinc-900">
                Could not complete request
              </div>
              <div className="text-xs text-zinc-400">
                {errorMessage || 'Failed to connect to Recall engine. Please try again.'}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={startHeroFlow}
                className="h-10 px-5 rounded-full bg-zinc-950 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer recall-btn-gradient"
              >
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={cancelHeroFlow}
                className="h-10 px-4 rounded-full text-xs font-medium text-zinc-600 border-black/[0.08] hover:bg-black/5"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── 5. SUCCESS STATE ── */}
        {flowPhase === 'success' && (
          <div className="max-w-md w-full px-4 animate-in fade-in zoom-in-95 duration-200 space-y-3 flex flex-col items-center">
            <div className="w-full p-4.5 rounded-2xl bg-white dark:bg-[#1c1c1f] border border-black/[0.08] dark:border-white/[0.1] shadow-lg space-y-3 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-white">
                      {resultHeadline || 'Cleaned & formatted'}
                    </h4>
                    {/* Tool Badges if tools were triggered */}
                    {toolInfo && (toolInfo.calendar || toolInfo.whatsapp || toolInfo.task) && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {toolInfo.calendar && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            <PluginIcon id="calendar" size={12} />
                            <span>Calendar</span>
                          </span>
                        )}
                        {toolInfo.whatsapp && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            <PluginIcon id="whatsapp" size={12} />
                            <span>WhatsApp</span>
                          </span>
                        )}
                        {toolInfo.task && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Task</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cancelHeroFlow}
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="Dismiss (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Result Details / Cleaned Content */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/[0.04] dark:border-white/[0.04]">
                <p className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed break-words whitespace-pre-wrap">
                  {cleanedResult || resultDetails || liveTranscript}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyResult}
                    className="h-8 px-3 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {copiedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isRewriting}
                    onClick={() => handleRewrite('concise')}
                    className="h-8 px-2.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    {isRewriting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    )}
                    <span>Rewrite</span>
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={startHeroFlow}
                  className="h-8 px-3.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 mr-1" />
                  <span>Speak again</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. ASK / KNOWLEDGE STATE ── */}
        {flowPhase === 'ask' && (
          <div className="max-w-md w-full px-4 animate-in fade-in zoom-in-95 duration-200 space-y-3 flex flex-col items-center">
            <div className="w-full p-4.5 rounded-2xl bg-white dark:bg-[#1c1c1f] border border-black/[0.08] dark:border-white/[0.1] shadow-lg space-y-3 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/recall-logo.png" alt="Recall" className="w-3 h-3 object-contain" />
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-white">
                    Recall Intelligence
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={cancelHeroFlow}
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 transition-colors cursor-pointer"
                  title="Dismiss (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/[0.04] dark:border-white/[0.04]">
                <p className="text-xs sm:text-sm font-normal text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {askAnswer || 'Here is what was found.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(askAnswer);
                  }}
                  className="h-8 px-3 rounded-lg text-xs font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                  <span>Copy answer</span>
                </Button>

                <Button
                  size="sm"
                  onClick={startHeroFlow}
                  className="h-8 px-3.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 mr-1" />
                  <span>Ask again</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── 7. NEEDS CHOICE STATE ── */}
        {flowPhase === 'needs_choice' && (
          <div className="max-w-md w-full px-4 animate-in fade-in zoom-in-95 duration-200 space-y-3 flex flex-col items-center">
            <div className="w-full p-4.5 rounded-2xl bg-white dark:bg-[#1c1c1f] border border-black/[0.08] dark:border-white/[0.1] shadow-lg space-y-3 text-center">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                Choose mode for: “{liveTranscript}”
              </span>
              <div className="flex items-center justify-center gap-2 pt-1">
                {choices.map((c) => (
                  <Button
                    key={c.id}
                    onClick={() => stopAndProcessFlow(c.id)}
                    className="h-8 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-semibold cursor-pointer"
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 6. IDLE STATE ── */}
        {flowPhase === 'idle' && (
          <div className="space-y-3 max-w-lg mx-auto animate-in fade-in duration-200">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950">
              Recall Flow
            </h1>
            <p className="text-base sm:text-lg font-medium text-zinc-700">
              “Don’t type. Just speak.”
            </p>
            <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
              Speak naturally and Recall will clean, rewrite, translate, or insert your words wherever you are working.
            </p>

            {/* Action CTAs */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={startHeroFlow}
                className="h-10 px-6 rounded-full bg-zinc-950 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all active:scale-95 gap-2 cursor-pointer recall-btn-gradient"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Start Recall Flow</span>
              </Button>

              <Link href="/settings?tab=flow">
                <Button
                  variant="outline"
                  className="h-10 px-5 rounded-full text-xs font-semibold gap-1.5 border-black/[0.08] hover:bg-black/[0.03] text-zinc-700 shadow-2xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Open Settings</span>
                </Button>
              </Link>
            </div>

            <div className="pt-1 text-[11px] text-zinc-400 font-medium">
              Global shortcut: <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 border text-[10.5px] font-mono text-zinc-600">⌥ Space</kbd> anywhere
            </div>
          </div>
        )}
      </section>

      {/* ── 1. LANGUAGE ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          1. Language
        </div>

        {/* Clean gradient/glass section */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white to-blue-50/20 border border-black/[0.06] shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* I speak */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600 block">
                I speak:
              </label>
              <RecallSelect
                value={isMounted ? settings.inputLanguage : 'auto'}
                onChange={(val) => update({ inputLanguage: val })}
                options={INPUT_LANGUAGE_OPTIONS}
                ariaLabel="Spoken input language"
              />
            </div>

            {/* Output as */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600 block">
                Output as:
              </label>
              <RecallSelect
                value={isMounted ? settings.outputLanguage : 'auto'}
                onChange={(val) => update({ outputLanguage: val })}
                options={OUTPUT_LANGUAGE_OPTIONS}
                ariaLabel="Written output language"
              />
            </div>
          </div>

          {/* Quick example pill */}
          <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between text-xs text-zinc-500">
            <span className="text-[11px] text-zinc-400">Example translation:</span>
            <span className="font-medium text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full text-[11px]">
              Hindi → English
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. WRITING STYLE ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          2. Writing Style
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-black/[0.06] shadow-xs space-y-4">
          {/* Horizontal Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'natural', label: 'Clean & Natural' },
              { id: 'professional', label: 'Professional' },
              { id: 'casual', label: 'Casual' },
              { id: 'concise', label: 'Concise' },
              { id: 'exact', label: 'Exact' },
            ].map((style) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    setSelectedStyle(style.id as any);
                    update({ style: style.id as any });
                  }}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-xs transition-all duration-200 cursor-pointer border flex items-center gap-1.5',
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/60 border-blue-300 text-blue-950 font-semibold shadow-xs'
                      : 'bg-white text-zinc-700 border-black/[0.07] shadow-2xs hover:-translate-y-0.5 hover:shadow-xs hover:border-blue-200 hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-indigo-50/30'
                  )}
                >
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                  )}
                  <span>{style.label}</span>
                </button>
              );
            })}
          </div>

          {/* One Small Example Preview */}
          <div className="p-3.5 rounded-xl bg-zinc-50/80 border border-black/[0.04] space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Preview Output:
            </div>
            <p className="text-xs font-medium text-zinc-900 leading-relaxed">
              “{STYLE_PREVIEWS[selectedStyle]}”
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. PERSONAL DICTIONARY ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          3. Personal Dictionary
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-black/[0.06] shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Teach Recall your names and words.
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Saved words are strongly prioritized over phonetic guesses.
            </p>
          </div>

          {/* Input Row */}
          <div className="flex items-center gap-2">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
              placeholder="Add a name, company or custom word…"
              className="h-10 text-xs bg-zinc-50/60"
            />
            <Button
              type="button"
              onClick={handleAddWord}
              className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-semibold shrink-0 gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </Button>
          </div>

          {/* Example Suggestions */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] text-zinc-400">Suggestions:</span>
            {['Novelle', 'RePixelX', 'Kriyon'].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => handleAddExampleWord(ex)}
                className="px-2.5 py-1 rounded-xl bg-white text-zinc-600 border border-black/[0.07] text-[11px] font-medium shadow-2xs hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer"
              >
                + {ex}
              </button>
            ))}
          </div>

          {/* Saved Dictionary Chips */}
          {settings.dictionary.length > 0 && (
            <div className="pt-2 border-t border-black/[0.04] flex flex-wrap gap-1.5">
              {settings.dictionary.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-black/[0.07] text-xs font-medium text-zinc-800 shadow-2xs hover:border-zinc-300 transition-all group"
                >
                  <span>{item.term}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveWord(item.id)}
                    className="text-zinc-400 hover:text-red-600 transition-colors p-0.5 rounded cursor-pointer"
                    title="Remove word"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 4. QUICK OPTIONS ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          4. Quick Options
        </div>

        <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.04] shadow-xs overflow-hidden">
          {/* Smart formatting */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Smart formatting</div>
              <div className="text-[11px] text-zinc-400">Capitalization, punctuation, and structured lists</div>
            </div>
            <Switch
              checked={settings.smartTranscription.smartFormatting}
              onCheckedChange={(checked) =>
                update({
                  smartTranscription: { ...settings.smartTranscription, smartFormatting: checked },
                })
              }
            />
          </div>

          {/* Remove filler words */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Remove filler words</div>
              <div className="text-[11px] text-zinc-400">Eliminates “um”, “uh”, “like”, and “you know”</div>
            </div>
            <Switch
              checked={settings.smartTranscription.removeFillers}
              onCheckedChange={(checked) =>
                update({
                  smartTranscription: { ...settings.smartTranscription, removeFillers: checked },
                })
              }
            />
          </div>

          {/* Auto insert */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Auto insert</div>
              <div className="text-[11px] text-zinc-400">Pastes directly into your active text field</div>
            </div>
            <Switch
              checked={settings.autoInsert}
              onCheckedChange={(checked) => update({ autoInsert: checked })}
            />
          </div>

          {/* Show transcript */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Show transcript</div>
              <div className="text-[11px] text-zinc-400">Displays floating words preview while speaking</div>
            </div>
            <Switch
              checked={settings.showTranscript}
              onCheckedChange={(checked) => update({ showTranscript: checked })}
            />
          </div>
        </div>
      </section>

      {/* ── SUPPORTED APPS ──────────────────────────────────────────────── */}
      <section className="pt-2 text-center space-y-3">
        <div className="text-xs font-medium text-zinc-400">
          Works where you work
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {['Gmail', 'WhatsApp', 'Chrome', 'Notes', 'Notion', 'Slack', 'ChatGPT'].map((app) => (
            <span
              key={app}
              className="px-3 py-1.5 rounded-xl bg-white border border-black/[0.06] text-xs font-medium text-zinc-700 shadow-2xs"
            >
              {app}
            </span>
          ))}
          <span className="text-xs text-zinc-400 font-medium px-2">and more</span>
        </div>
      </section>
    </div>
  );
}
