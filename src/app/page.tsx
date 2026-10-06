'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTasks } from '@/lib/TasksContext';
import { RecallAIComposer } from '@/components/RecallAIComposer';
import { ConnectedPluginsBar } from '@/components/ConnectedPluginsBar';
import { ConnectorSidePanel } from '@/components/ConnectorSidePanel';
import { PLUGINS_DATA, PluginMeta } from '@/components/PluginIcon';
import { DayScheduleSection } from '@/components/DayScheduleSection';
import { TaskComposer } from '@/components/TaskComposer';
import { OnboardingModal } from '@/components/OnboardingModal';
import { Task } from '@/lib/types';
import { Plus } from 'lucide-react';
import { useUserSession } from '@/lib/user-session';

function TodayPageContent() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chatId');
  const { tasks, isLoading, createTask, updateTask, deleteTask, snoozeTask } =
    useTasks();

  const { session } = useUserSession();
  const [plugins, setPlugins] = useState<PluginMeta[]>(PLUGINS_DATA);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [showStarterChips, setShowStarterChips] = useState(true);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const handleItemsCreated = (itemIds: string[], targetDate?: Date) => {
    if (itemIds.length > 0) {
      setHighlightedItemIds(itemIds);
      if (targetDate) {
        setSelectedDate(targetDate);
      }
      setTimeout(() => {
        setHighlightedItemIds([]);
      }, 4000);
    }
  };

  // Check URL params for OAuth status or messages
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'google_not_configured') {
        setBannerNotice('Google Sign-In is not configured yet. You can continue as Guest.');
        window.history.replaceState({}, '', '/');
      } else if (params.get('connected') === 'google') {
        setBannerNotice('Connected with Google successfully.');
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  useEffect(() => {
    const handleOpenComposer = () => setIsComposerOpen(true);
    const handleOpenConnector = (e: any) => {
      const pluginId = e.detail?.pluginId;
      setPlugins((currentPlugins) => {
        const target = currentPlugins.find((p) => p.id === pluginId);
        if (target) {
          setActivePanelPlugin(target);
          setIsSidePanelOpen(true);
        }
        return currentPlugins;
      });
    };

    window.addEventListener('open-task-composer', handleOpenComposer);
    window.addEventListener('open-connector-panel', handleOpenConnector as EventListener);

    try {
      const completed = localStorage.getItem('recall_onboarding_completed') || localStorage.getItem('recall_demo_onboarding_completed');
      if (!completed) {
        setIsOnboardingOpen(true);
      }
    } catch {}

    const handleOpenOnboarding = () => setIsOnboardingOpen(true);
    window.addEventListener('open-onboarding', handleOpenOnboarding);
    window.addEventListener('open-demo-onboarding', handleOpenOnboarding);

    return () => {
      window.removeEventListener('open-task-composer', handleOpenComposer);
      window.removeEventListener('open-connector-panel', handleOpenConnector as EventListener);
      window.removeEventListener('open-onboarding', handleOpenOnboarding);
      window.removeEventListener('open-demo-onboarding', handleOpenOnboarding);
    };
  }, []);

  // Side Panel & Pulse States
  const [activePanelPlugin, setActivePanelPlugin] = useState<PluginMeta | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [pulsingPluginId, setPulsingPluginId] = useState<string | null>(null);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  // Check live connection status on mount and session changes
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/google/status', {
          headers: { 'x-session-mode': session.mode },
        });
        const data = await res.json();
        setPlugins((prev) =>
          prev.map((p) => {
            if (p.id === 'gmail' || p.id === 'calendar' || p.id === 'drive') {
              const isConn = Boolean(data?.google?.connected);
              return { ...p, connected: isConn, statusText: isConn ? 'Connected' : 'Configure' };
            }
            if (p.id === 'whatsapp') {
              return { ...p, connected: false, statusText: 'Disabled' };
            }
            if (p.id === 'maps') {
              return { ...p, connected: true, statusText: 'Automatic' };
            }
            return p;
          })
        );
      } catch (e) {
        console.warn('Could not check connection status', e);
      }
    }
    checkStatus();
  }, [session.mode]);

  const handleTogglePlugin = (plugin: PluginMeta) => {
    // Never force full document reload; open the side panel smoothly as client-side state
    setActivePanelPlugin(plugin);
    setIsSidePanelOpen(true);
  };

  const handleOpenSidePanel = (plugin: PluginMeta) => {
    setActivePanelPlugin(plugin);
    setIsSidePanelOpen(true);
  };

  const handleConnectorPulse = (pluginId: string) => {
    setPulsingPluginId(pluginId);
    setTimeout(() => setPulsingPluginId(null), 1200);
  };

  const handleAskRecall = (promptText: string) => {
    setExternalPrompt(promptText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';


  const handleComposerSave = async (data: {
    id?: string;
    title: string;
    note?: string | null;
    due_at: string;
    end_time?: string | null;
    priority?: any;
    location?: string | null;
    is_meeting?: boolean;
  }) => {
    if (data.id) {
      await updateTask(data.id, {
        title: data.title,
        note: data.note,
        due_at: data.due_at,
        end_time: data.end_time,
        priority: data.priority,
        location: data.location,
        is_meeting: data.is_meeting,
      });
    } else {
      await createTask({
        title: data.title,
        note: data.note,
        due_at: data.due_at,
        end_time: data.end_time,
        priority: data.priority,
        location: data.location,
        is_meeting: data.is_meeting,
      });
    }
    setEditingTask(null);
  };

  const handleComposerDelete = async (id: string) => {
    await deleteTask(id);
    setEditingTask(null);
  };

  return (
    <div className="w-full flex flex-col gap-7 pb-24 md:pb-12 max-w-[860px] mx-auto">
        {/* Banner Notice (e.g. Google auth error or success) */}
        {bannerNotice && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-black/[0.06] shadow-2xs animate-in fade-in">
            <span>{bannerNotice}</span>
            <button
              onClick={() => setBannerNotice(null)}
              className="text-zinc-400 hover:text-zinc-700 ml-3 cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Calm Ambient Hero Header */}
        <section className="pt-2 sm:pt-4 space-y-2">
          <div>
            <h2 className="text-sm font-medium text-zinc-400 tracking-tight">
              {greeting}{session.isGuest ? '.' : `, ${session.name}.`}
            </h2>
            <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight mt-0.5">
              What needs your attention?
            </h1>
          </div>
        </section>

      {/* 2. THE HERO: One Unified Recall AI Composer & Inline Workspace */}
      <section className="flex flex-col gap-2">
        <RecallAIComposer
          externalPrompt={externalPrompt}
          conversationId={chatId}
          onConnectorPulse={handleConnectorPulse}
          onTaskCreated={() => handleConnectorPulse('whatsapp')}
          onOpenTaskComposer={() => setIsComposerOpen(true)}
          onItemsCreated={handleItemsCreated}
        />
        <ConnectedPluginsBar
          plugins={plugins}
          onTogglePlugin={handleTogglePlugin}
          onOpenSidePanel={handleOpenSidePanel}
          onAskRecall={handleAskRecall}
          pulsingPluginId={pulsingPluginId}
        />
      </section>

      {/* 3. Day-Wise Schedule System */}
      <DayScheduleSection
        tasks={tasks}
        isLoading={isLoading}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onSnoozeTask={snoozeTask}
        onOpenComposer={() => {
          setEditingTask(null);
          setIsComposerOpen(true);
        }}
        onEditTask={(t) => {
          setEditingTask(t);
          setIsComposerOpen(true);
        }}
        onAskRecall={handleAskRecall}
        highlightedItemIds={highlightedItemIds}
      />

      {/* Secondary Quick Manual Task Sheet */}
      <TaskComposer
        isOpen={isComposerOpen}
        initialTask={editingTask}
        onClose={() => {
          setIsComposerOpen(false);
          setEditingTask(null);
        }}
        onSave={handleComposerSave}
        onDelete={handleComposerDelete}
      />

      {/* Unified Connector Side Panel */}
      <ConnectorSidePanel
        plugin={activePanelPlugin}
        isOpen={isSidePanelOpen}
        onClose={() => setIsSidePanelOpen(false)}
        onAskRecall={handleAskRecall}
        onScheduleReminder={(t, due) => {
          createTask({ title: t, due_at: new Date(Date.now() + 24 * 3600000).toISOString() });
          handleConnectorPulse('whatsapp');
        }}
      />

      {/* Mandatory Onboarding & Workspace Setup Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={(promptToTry) => {
          setIsOnboardingOpen(false);
          if (promptToTry) {
            handleAskRecall(promptToTry);
          }
        }}
      />
    </div>
  );
}

export default function TodayPage() {
  return (
    <React.Suspense fallback={<div className="w-full min-h-[400px] flex items-center justify-center text-xs text-zinc-400">Loading workspace…</div>}>
      <TodayPageContent />
    </React.Suspense>
  );
}
