'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, SlidersHorizontal, Save, PanelLeft } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useUserSession } from '@/lib/user-session';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { session } = useUserSession();
  const [autoSave, setAutoSave] = useState(false);

  useEffect(() => {
    try {
      const savedAutoSave = localStorage.getItem('recall-auto-save') === 'true';
      queueMicrotask(() => setAutoSave(savedAutoSave));
    } catch {}
  }, []);

  const toggleAutoSave = () => {
    const next = !autoSave;
    setAutoSave(next);
    try {
      localStorage.setItem('recall-auto-save', String(next));
    } catch {}
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent('recall-auto-save-changed', { detail: { enabled: next } })
      );
    });
  };

  const navLinks = [
    { label: 'Today', href: '/' },
    { label: 'Upcoming', href: '/upcoming' },
    { label: 'Completed', href: '/completed' },
    { label: 'Recall Flow', href: '/flow' },
    { label: 'Tools', href: '/tools' },
  ];

  const isSettingsOrAccount = pathname.startsWith('/settings') || pathname.startsWith('/account');

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F8F9FD]/85 dark:bg-[#212121]/85 backdrop-blur-xl border-b border-black/[0.04] dark:border-white/[0.06] transition-colors py-2.5 px-4 sm:px-8">
      <div className="max-w-[1020px] mx-auto flex items-center justify-between">
        {/* Left: Sidebar Toggle + Recall 3D Logo + Title / Back Link */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
            title="Toggle sidebar (⌘\)"
            aria-label="Toggle sidebar"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors border border-black/[0.04] dark:border-white/[0.08] cursor-pointer active:scale-95 shrink-0"
          >
            <PanelLeft className="w-4 h-4 stroke-[1.8]" />
          </button>

          {isSettingsOrAccount ? (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors py-1 px-3 rounded-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/[0.04] dark:border-white/[0.08]"
            >
              <span>←</span>
              <span>Recall</span>
            </Link>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-transform duration-200 active:scale-95"
            >
              <div className="relative w-8 h-8 rounded-full shrink-0 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0052FF]/30 to-[#00D2FF]/30 blur-xs opacity-60 group-hover:opacity-100 transition-opacity" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/recall-logo.png"
                  alt="Recall"
                  className="relative w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,82,255,0.28)] transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-[#ececec]">
                Recall
              </span>
            </Link>
          )}
        </div>

        {/* Center: Clean Segmented Pill Navigation (Only on standard pages) */}
        {!isSettingsOrAccount ? (
          <nav className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.05] backdrop-blur-xl rounded-full border border-white/60 dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-none">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-1.5 text-[13px] font-medium rounded-full transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-[#2d2d2d] text-zinc-900 dark:text-[#ececec] shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#ececec] hover:bg-white/40 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
            {pathname.startsWith('/settings') ? 'Settings' : 'Account'}
          </div>
        )}

        {/* Right: Minimal controls — Auto Save sits beside the profile */}
        <div className="flex items-center gap-2">
          {/* Clean ChatGPT-Style Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode (ChatGPT Style)'}
            aria-label="Toggle dark mode"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-amber-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all border border-black/[0.04] dark:border-white/[0.08] cursor-pointer active:scale-90"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 stroke-[2] transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-600 stroke-[2] transition-transform duration-300 -rotate-12 hover:rotate-0" />
            )}
          </button>

          <Link
            href="/settings"
            title="Settings"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.08] transition-all border border-black/[0.04] dark:border-white/[0.08]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.8]" />
          </Link>

          {!isSettingsOrAccount && (
            <button
              type="button"
              role="switch"
              aria-checked={autoSave}
              aria-label={`Auto Save ${autoSave ? 'on' : 'off'}`}
              onClick={toggleAutoSave}
              title={autoSave ? 'Auto Save on — plans apply automatically' : 'Auto Save off — review plans before applying'}
              className={`relative w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer active:scale-90 ${
                autoSave
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                  : 'bg-black/[0.03] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 border-black/[0.04] dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]'
              }`}
            >
              <Save className="w-3.5 h-3.5 stroke-[1.9]" />
              <span
                aria-hidden="true"
                className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#F8F9FD] dark:border-[#212121] transition-colors ${
                  autoSave ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              />
            </button>
          )}

          <Link
            href="/account"
            suppressHydrationWarning
            title={`Account (${session.name})`}
            className="w-8 h-8 rounded-full bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center border border-white dark:border-white/[0.1] shadow-xs cursor-pointer select-none transition-all active:scale-95"
          >
            {session.initials}
          </Link>
        </div>
      </div>
    </header>
  );
};
