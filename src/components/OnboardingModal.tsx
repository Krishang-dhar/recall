'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Folder,
  FolderCheck,
  Calendar,
  Sparkles,
  ShieldCheck,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PluginIcon } from './PluginIcon';
import { cn } from '@/lib/utils';
import { setSessionMode, getSessionMode, useUserSession } from '@/lib/user-session';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: (completedPrompt?: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { session } = useUserSession();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Google status
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Folder access status
  const [folderGranted, setFolderGranted] = useState(false);
  const [folderPath, setFolderPath] = useState<string>('~/Desktop/Recall_Vault');
  const [isGrantingFolder, setIsGrantingFolder] = useState(false);

  // Check Google & Vault status on mount or when opened
  useEffect(() => {
    if (!isOpen) return;

    // 1. Google Status
    fetch('/api/google/status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.google?.connected) {
          setGoogleConnected(true);
          setGoogleEmail(data.google.email || null);
        } else {
          setGoogleConnected(false);
          setGoogleEmail(null);
        }
      })
      .catch(() => {});

    // 2. Vault / Folder Status
    fetch('/api/vault')
      .then((res) => res.json())
      .then((data) => {
        if (data?.granted) {
          setFolderGranted(true);
          setFolderPath(data.path || '~/Desktop/Recall_Vault');
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('open-onboarding'));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('recall-onboarding-closed'));
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGrantFolderAccess = async () => {
    setIsGrantingFolder(true);
    try {
      // In supported browsers, optionally invoke File System Access API
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          // Attempt native directory picker if supported
          // @ts-ignore
          await window.showDirectoryPicker({ mode: 'readwrite' });
        } catch (pickErr: any) {
          // User aborted native picker or not allowed; fall back to local desktop vault creation
          console.info('Native directory picker skipped, using desktop vault path');
        }
      }

      const res = await fetch('/api/vault', { method: 'POST' });
      const data = await res.json();
      if (data.success || data.granted) {
        setFolderGranted(true);
        if (data.path) setFolderPath(data.path);
        localStorage.setItem('recall_folder_access_granted', 'true');
      }
    } catch (e) {
      console.error('Failed to grant folder access:', e);
    } finally {
      setIsGrantingFolder(false);
    }
  };

  const handleFinishOnboarding = (promptToTry?: string) => {
    try {
      localStorage.setItem('recall_onboarding_completed', 'true');
      localStorage.setItem('recall_demo_onboarding_completed', 'true');
    } catch {}
    window.dispatchEvent(new CustomEvent('recall-onboarding-closed'));
    onClose(promptToTry);
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as any);
    } else {
      handleFinishOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as any);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto selection:bg-blue-500/15 selection:text-blue-900 animate-in fade-in duration-300">
      {/* Heavy blurred backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xl transition-all duration-500" />

      {/* Living Ambient Gradient */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden flex items-center justify-center">
        <div className="w-[600px] sm:w-[750px] h-[500px] sm:h-[600px] bg-gradient-to-tr from-[#0052FF]/25 via-[#7928CA]/20 to-[#00D2FF]/25 blur-[100px] rounded-full siri-aura-flow opacity-75 animate-pulse duration-5000" />
      </div>

      {/* Crisp White Card */}
      <div className="relative w-full max-w-[500px] bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-[32px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.25)] p-6 sm:p-8 flex flex-col items-center text-center space-y-6 relative overflow-hidden transition-all duration-300">
        {/* Top Header: Step Back, Step Indicators */}
        <div className="w-full flex items-center justify-between text-xs">
          <div className="w-16 text-left">
            {currentStep > 1 ? (
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

          {/* 4 Step Indicators */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  currentStep === step
                    ? 'w-7 bg-gradient-to-r from-[#0052FF] via-[#00D2FF] to-[#7928CA]'
                    : currentStep > step
                    ? 'w-2 bg-blue-600/40'
                    : 'w-2 bg-zinc-200 dark:bg-zinc-800'
                )}
              />
            ))}
          </div>

          <div className="w-16 text-right">
            <span className="text-[11px] font-mono text-zinc-400">
              {currentStep}/4
            </span>
          </div>
        </div>

        {/* ── STEP 1: WELCOME TO RECALL ── */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-[#0052FF]/10 via-[#7928CA]/10 to-[#00D2FF]/10 border border-black/[0.06] dark:border-white/[0.1] shadow-lg flex items-center justify-center p-3.5 mx-auto my-2">
              <span className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#0052FF]/20 to-[#00D2FF]/20 blur-md opacity-60" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/recall-logo.png"
                alt="Recall"
                className="relative w-full h-full object-contain drop-shadow-[0_4px_16px_rgba(0,82,255,0.3)]"
              />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Welcome to Recall
              </h1>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Your private, local-first AI assistant and life OS.
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1 leading-relaxed max-w-sm">
                Say or type what you need. Real data, real tools, zero placeholders.
              </p>
            </div>

            <div className="w-full pt-2">
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-black text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group recall-btn-gradient"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: GOOGLE ACCOUNT & IDENTITY ── */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Google Workspace
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect your Google account to sync Calendar, Gmail, and meetings.
              </p>
            </div>

            {googleConnected ? (
              /* Already Connected State */
              <div className="w-full p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-left space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Google Account Connected
                    </div>
                    <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {googleEmail || 'hello@repixelx.tech'}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 pt-1">
                  Google Calendar events and Gmail integration are active and synced.
                </p>
              </div>
            ) : (
              /* Not Yet Connected Options */
              <div className="w-full space-y-3 pt-1">
                <a
                  href="/api/auth/google?returnTo=/"
                  className="w-full h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:shadow-xs text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-3 transition-all cursor-pointer"
                >
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
                  <span>Connect Google Account</span>
                </a>

                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                  <span className="text-[11px] font-medium text-zinc-400">or</span>
                  <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSessionMode('guest');
                    handleNext();
                  }}
                  className="w-full h-12 rounded-2xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer"
                >
                  <span>Continue as Guest (Local Session)</span>
                </Button>
              </div>
            )}

            <div className="w-full pt-1">
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

        {/* ── STEP 3: DESKTOP FOLDER ACCESS (MANDATORY) ── */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            <div className="relative w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#0052FF]">
              {folderGranted ? (
                <FolderCheck className="w-8 h-8 text-emerald-600" />
              ) : (
                <Folder className="w-8 h-8 text-[#0052FF]" />
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Desktop Folder Access
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                Recall stores all your chats, tasks, and memory right on your Mac Desktop. You own all files.
              </p>
            </div>

            {/* Folder Vault Status Box */}
            <div className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Desktop Vault Target
                </span>
                {folderGranted ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Access Granted</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Required
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.06] font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all select-all">
                {folderPath}
              </div>

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5">
                Every conversation is saved as a readable Markdown file in <code className="text-zinc-700 dark:text-zinc-300">Desktop/Recall_Vault/chats/</code>.
              </p>
            </div>

            {/* Grant Button or Confirmation */}
            <div className="w-full space-y-2 pt-1">
              {!folderGranted ? (
                <Button
                  onClick={handleGrantFolderAccess}
                  disabled={isGrantingFolder}
                  className="w-full h-12 rounded-2xl bg-[#0052FF] hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>{isGrantingFolder ? 'Connecting Desktop Vault…' : 'Grant Desktop Folder Access'}</span>
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-black text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group recall-btn-gradient"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: ALL CONNECTED & READY ── */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center w-full">
            <div className="relative w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto my-1 shadow-sm">
              <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                You’re All Set
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Recall is connected and ready to run your day.
              </p>
            </div>

            {/* Status Checklist Card */}
            <div className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/[0.05] dark:border-white/[0.06] space-y-2.5 text-left">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <PluginIcon id="calendar" size={16} />
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Google Workspace
                  </span>
                </div>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{googleConnected ? (googleEmail || 'Connected') : 'Local Session'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Desktop Vault
                  </span>
                </div>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Desktop/Recall_Vault</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    AI Intelligence
                  </span>
                </div>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Gemini 2.5 Active</span>
                </span>
              </div>
            </div>

            <div className="w-full pt-1">
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
