'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  SlidersHorizontal,
  MessageSquare,
  Trash2,
  Mic,
  RotateCcw,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ExternalLink,
} from 'lucide-react';
import { PluginIcon } from './PluginIcon';
import { useTasks } from '@/lib/TasksContext';
import { Conversation } from '@/lib/types';
import { useUserSession } from '@/lib/user-session';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  activeConversationId,
  onSelectConversation,
  onNewChat,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { tasks } = useTasks();
  const { session } = useUserSession();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Load conversations and Google status based on session mode
  useEffect(() => {
    async function loadData() {
      if (session.isGuest) {
        try {
          const raw = localStorage.getItem('recall_guest_conversations');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setConversations(parsed);
          } else {
            setConversations([]);
          }
        } catch {
          setConversations([]);
        }
        setGoogleConnected(false);
        return;
      }

      try {
        const [convRes, statusRes] = await Promise.all([
          fetch('/api/conversations'),
          fetch('/api/google/status', {
            headers: { 'x-session-mode': session.mode },
          }),
        ]);
        const convData = await convRes.json();
        const statusData = await statusRes.json();
        if (convData.success) setConversations(convData.conversations || []);
        if (statusData?.google?.connected) setGoogleConnected(true);
      } catch (e) {
        console.warn('Could not load sidebar data', e);
      }
    }
    loadData();
  }, [session.mode, session.isGuest]);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayCount = tasks.filter((t) => {
    if (t.status !== 'pending') return false;
    return new Date(t.due_at) <= todayEnd;
  }).length;

  const upcomingCount = tasks.filter((t) => {
    if (t.status !== 'pending') return false;
    return new Date(t.due_at) > todayEnd;
  }).length;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {}
  };

  const navItems = [
    {
      label: 'Today',
      href: '/',
      count: todayCount,
      icon: (
        <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect width="18" height="18" x="3" y="4" rx="4" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Upcoming',
      href: '/upcoming',
      count: upcomingCount,
      icon: (
        <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      href: '/completed',
      count: completedCount,
      icon: (
        <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: 'Recall Flow',
      href: '/flow',
      count: 0,
      icon: (
        <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ),
    },
    {
      label: 'Tools & Features',
      href: '/tools',
      count: 0,
      icon: (
        <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] md:hidden transition-opacity"
        />
      )}

      {/* Modern Apple / Linear Style Spacious Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-20 h-screen w-72 sm:w-[285px] bg-white/90 dark:bg-[#1a1a1e]/90 backdrop-blur-2xl border-r border-black/[0.06] dark:border-white/[0.07] flex flex-col justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shadow-[4px_0_30px_rgba(0,0,0,0.02)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full md:w-0 md:opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.06] space-y-3.5 bg-gradient-to-b from-white via-white to-zinc-50/50 dark:from-[#1a1a1e] dark:to-[#18181b]">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-transform active:scale-95"
            >
              <div className="relative w-8 h-8 rounded-full shrink-0 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0052FF]/25 via-[#7928CA]/20 to-[#00D2FF]/25 blur-xs opacity-70 group-hover:opacity-100 transition-opacity" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/recall-logo.png"
                  alt="Recall"
                  className="relative w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,82,255,0.25)] transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <span className="font-semibold text-base tracking-tight text-zinc-900 dark:text-white">
                Recall
              </span>
            </Link>

            <button
              type="button"
              onClick={onToggle}
              title="Close sidebar (⌘\)"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4 stroke-[1.8]" />
            </button>
          </div>

          {/* Quick Search Button */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors border border-black/[0.04] dark:border-white/[0.06] cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-medium">Search thoughts & tasks</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-black/[0.06] dark:border-white/[0.08] shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* 1. Quick Actions Bar ("wiht action and all") */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Quick Actions
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-task-composer'));
                  if (window.innerWidth < 768) onToggle();
                }}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New task</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onNewChat) onNewChat();
                  else router.push('/');
                  if (window.innerWidth < 768) onToggle();
                }}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-black/[0.03] hover:bg-black/[0.06] text-zinc-800 text-xs font-medium border border-black/[0.05] transition-all active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                <span>New chat</span>
              </button>
            </div>
          </div>

          {/* 2. Primary Navigation */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Views
            </div>

            <nav className="space-y-0.5 pt-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 768) onToggle();
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-black/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-white' : 'text-zinc-500'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>

                    {item.count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-black/[0.05] text-zinc-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 3. Connected Workspaces & Integrations */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Workspaces
              </span>
              <span className="text-[10px] font-semibold text-emerald-600">
                Live
              </span>
            </div>

            <div className="space-y-0.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-connector-panel', { detail: { pluginId: 'calendar' } })
                  );
                  if (window.innerWidth < 768) onToggle();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <PluginIcon id="calendar" size={16} />
                  <span>Google Calendar</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-connector-panel', { detail: { pluginId: 'whatsapp' } })
                  );
                  if (window.innerWidth < 768) onToggle();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <PluginIcon id="whatsapp" size={16} />
                  <span>WhatsApp</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-connector-panel', { detail: { pluginId: 'gmail' } })
                  );
                  if (window.innerWidth < 768) onToggle();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <PluginIcon id="gmail" size={16} />
                  <span>Gmail</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-connector-panel', { detail: { pluginId: 'drive' } })
                  );
                  if (window.innerWidth < 768) onToggle();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <PluginIcon id="drive" size={16} />
                  <span>Google Drive</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-connector-panel', { detail: { pluginId: 'notion' } })
                  );
                  if (window.innerWidth < 768) onToggle();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <PluginIcon id="notion" size={16} />
                  <span>Notion</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
              </button>
            </div>
          </div>

          {/* 4. Recent Conversations */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Recent Chats
              </span>
            </div>

            <div className="space-y-0.5 pt-1">
              {conversations.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-zinc-400 font-normal">
                  No previous chats
                </div>
              ) : (
                conversations.slice(0, 5).map((conv) => {
                  const isSelected = activeConversationId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (onSelectConversation) onSelectConversation(conv.id);
                        if (window.innerWidth < 768) onToggle();
                      }}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 text-zinc-900 font-medium'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{conv.title}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-600 transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom User Profile & Settings */}
        <div className="p-3 border-t border-black/[0.05] flex items-center justify-between bg-white/50">
          <Link
            href="/settings"
            onClick={() => {
              if (window.innerWidth < 768) onToggle();
            }}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0052FF] to-[#7928CA] text-white flex items-center justify-center font-semibold text-xs shadow-xs group-hover:scale-105 transition-transform">
              {session.initials}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-zinc-900 leading-tight">
                {session.name}
              </span>
              <span className="text-[10px] text-zinc-400">{session.role}</span>
            </div>
          </Link>

          <Link
            href="/settings"
            title="Settings"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.8]" />
          </Link>
        </div>
      </aside>
    </>
  );
};
