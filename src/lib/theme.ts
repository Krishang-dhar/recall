'use client';

import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'recall-theme';
const EVENT_NAME = 'recall-theme-change';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch (e) {}
  return 'light';
}

export function isSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;

  const shouldBeDark = mode === 'dark' || (mode === 'system' && isSystemDark());
  const root = document.documentElement;

  if (shouldBeDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (e) {}

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { theme: mode, isDark: shouldBeDark } }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const initialTheme = getStoredTheme();
    setThemeState(initialTheme);
    const activeDark = initialTheme === 'dark' || (initialTheme === 'system' && isSystemDark());
    setIsDark(activeDark);
    applyTheme(initialTheme);

    const handleThemeChange = (e: any) => {
      if (e.detail?.theme) {
        setThemeState(e.detail.theme);
        setIsDark(Boolean(e.detail.isDark));
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const current = getStoredTheme();
      if (current === 'system') {
        applyTheme('system');
      }
    };

    window.addEventListener(EVENT_NAME, handleThemeChange as EventListener);
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener(EVENT_NAME, handleThemeChange as EventListener);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    setIsDark(mode === 'dark' || (mode === 'system' && isSystemDark()));
    applyTheme(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = isDark ? 'light' : 'dark';
    setTheme(next);
  }, [isDark, setTheme]);

  return { theme, isDark, toggleTheme, setTheme, mounted };
}
