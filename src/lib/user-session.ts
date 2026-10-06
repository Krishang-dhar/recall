'use client';

import { useState, useEffect } from 'react';

export type SessionMode = 'guest' | 'google' | 'owner';

export interface UserIdentity {
  mode: SessionMode;
  name: string;
  role: string;
  initials: string;
  email: string | null;
  isGuest: boolean;
  avatarUrl?: string | null;
}

export const GUEST_USER: UserIdentity = {
  mode: 'guest',
  name: 'Guest',
  role: 'Local Session',
  initials: 'G',
  email: null,
  isGuest: true,
};

export const OWNER_USER: UserIdentity = {
  mode: 'owner',
  name: 'Krishang',
  role: 'Workspace Owner',
  initials: 'K',
  email: 'krishangsharma2005@gmail.com',
  isGuest: false,
};

export function getSessionMode(): SessionMode {
  if (typeof window === 'undefined') return 'guest';
  const stored = localStorage.getItem('recall_session_mode');
  if (stored === 'owner') return 'owner';
  if (stored === 'google') return 'google';
  return 'guest';
}

export function getUserIdentity(): UserIdentity {
  if (typeof window === 'undefined') return GUEST_USER;
  const mode = getSessionMode();
  if (mode === 'owner') return OWNER_USER;
  if (mode === 'google') {
    try {
      const googleUserRaw = localStorage.getItem('recall_google_user');
      if (googleUserRaw) {
        const parsed = JSON.parse(googleUserRaw);
        const name = parsed.name || parsed.email?.split('@')[0] || 'Google User';
        return {
          mode: 'google',
          name,
          role: 'Google Account',
          initials: name.charAt(0).toUpperCase(),
          email: parsed.email || null,
          isGuest: false,
          avatarUrl: parsed.picture || null,
        };
      }
    } catch {}
    return {
      mode: 'google',
      name: 'Google User',
      role: 'Google Account',
      initials: 'G',
      email: null,
      isGuest: false,
    };
  }
  return GUEST_USER;
}

export function setSessionMode(
  mode: SessionMode,
  extraData?: { email?: string; name?: string; picture?: string }
) {
  if (typeof window === 'undefined') return;
  const prevMode = localStorage.getItem('recall_session_mode');
  const prevUser = localStorage.getItem('recall_google_user');

  localStorage.setItem('recall_session_mode', mode);
  if (mode === 'google' && extraData) {
    localStorage.setItem('recall_google_user', JSON.stringify(extraData));
  } else if (mode === 'guest') {
    localStorage.removeItem('recall_google_user');
  }

  // Only dispatch if actual change occurred to prevent re-render cascades
  if (prevMode !== mode || (extraData && JSON.stringify(extraData) !== prevUser)) {
    window.dispatchEvent(new CustomEvent('recall-session-changed', { detail: { mode } }));
  }
}

export function clearGuestData() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('recall_guest_tasks');
  localStorage.removeItem('recall_guest_conversations');
  localStorage.removeItem('recall_guest_projects');
  localStorage.removeItem('recall_guest_settings');
  window.dispatchEvent(new CustomEvent('recall-tasks-changed'));
  window.dispatchEvent(new CustomEvent('recall-session-changed', { detail: { mode: 'guest' } }));
}

// Module-level single check to prevent spamming /api/google/status across multiple components
let isStatusChecking = false;
let statusCheckedOnce = false;

function syncServerGoogleStatus() {
  if (typeof window === 'undefined' || isStatusChecking || statusCheckedOnce) return;
  isStatusChecking = true;

  fetch('/api/google/status')
    .then((res) => res.json())
    .then((data) => {
      statusCheckedOnce = true;
      if (data?.google?.connected && data.google?.email) {
        const currentMode = localStorage.getItem('recall_session_mode');
        if (currentMode !== 'owner') {
          const newUserData = {
            email: data.google.email,
            name: data.google.name || data.google.email.split('@')[0],
          };
          setSessionMode('google', newUserData);
        }
      } else if (data?.google?.connected === false) {
        const currentMode = localStorage.getItem('recall_session_mode');
        if (currentMode === 'google') {
          setSessionMode('guest');
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      isStatusChecking = false;
    });
}

export function useUserSession(): {
  session: UserIdentity;
  setMode: (mode: SessionMode, extraData?: any) => void;
  resetGuestData: () => void;
  isHydrated: boolean;
} {
  // Start with GUEST_USER on both server and initial client render to guarantee 100% hydration match
  const [session, setSession] = useState<UserIdentity>(GUEST_USER);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // 1. Immediately hydrate real client identity from localStorage on mount
    queueMicrotask(() => {
      setSession(getUserIdentity());
      setIsHydrated(true);
    });

    // 2. Handle URL redirect params from OAuth
    const searchParams = new URLSearchParams(window.location.search);
    const isConnectedGoogle = searchParams.get('connected') === 'google';
    const urlEmail = searchParams.get('email');
    const urlName = searchParams.get('name');

    if (isConnectedGoogle || urlEmail) {
      const email = urlEmail || undefined;
      const name = urlName || (email ? email.split('@')[0] : 'Google User');
      setSessionMode('google', { email, name });
      setSession(getUserIdentity());

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('connected');
      cleanUrl.searchParams.delete('mode');
      cleanUrl.searchParams.delete('email');
      cleanUrl.searchParams.delete('name');
      window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search || ''));
    }

    // 3. Centralized single status check
    syncServerGoogleStatus();

    const handleUpdate = () => {
      setSession(getUserIdentity());
    };

    window.addEventListener('recall-session-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('recall-session-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return {
    session,
    setMode: setSessionMode,
    resetGuestData: clearGuestData,
    isHydrated,
  };
}
