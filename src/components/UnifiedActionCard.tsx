'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  RotateCcw,
  X,
  Clock,
  ArrowRight,
  Bell,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';

export interface ActionCardStep {
  id: string;
  icon: 'calendar' | 'recall' | 'whatsapp' | 'gmail' | 'drive' | 'notion' | 'maps';
  label: string;
  status: 'pending' | 'running' | 'completed' | 'needs_connect' | 'error';
  detail?: string;
  connectUrl?: string;
}

export interface CreatedActionItem {
  id?: string;
  title: string;
  time?: string;
  channel?: 'calendar' | 'tasks' | 'whatsapp' | 'gmail' | 'drive';
  note?: string;
}

export interface UnifiedActionData {
  id: string;
  phase: 'progress' | 'completed';
  title: string;
  headline: string;
  subheadline?: string;
  primaryChannel: 'calendar' | 'tasks' | 'whatsapp' | 'gmail' | 'drive' | 'recall';
  usedApps?: PluginId[];
  steps: ActionCardStep[];
  items?: CreatedActionItem[];
  planSlots?: Array<{ time: string; title: string; note?: string }>;
  aiReply?: string;
  recommendations?: Array<{ id: string; iconType: string; label: string; prompt: string }>;
  externalLink?: string;
  externalLinkLabel?: string;
  linkedIds?: {
    taskId?: string;
    calendarEventId?: string;
  };
}

interface UnifiedActionCardProps {
  data: UnifiedActionData;
  onUndo?: () => void;
  onSelectRecommendation?: (prompt: string) => void;
  onDismiss?: () => void;
}

export const UnifiedActionCard: React.FC<UnifiedActionCardProps> = ({
  data,
  onUndo,
  onSelectRecommendation,
  onDismiss,
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isUndone, setIsUndone] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Smooth step progression while task is being executed
  useEffect(() => {
    if (data.phase === 'progress') {
      setActiveStepIndex(0);
      setIsCollapsing(false);

      const interval = setInterval(() => {
        setActiveStepIndex((prev) => {
          if (prev < data.steps.length - 1) {
            return prev + 1;
          } else {
            clearInterval(interval);
            return prev;
          }
        });
      }, 640);

      return () => clearInterval(interval);
    }
  }, [data.phase, data.steps.length]);

  // Gentle auto-collapse after 9s of inactivity (paused while user hovers over card)
  useEffect(() => {
    if (data.phase === 'completed' && !isUndone && !isHovered) {
      const timer = setTimeout(() => {
        setIsCollapsing(true);
        setTimeout(() => {
          onDismiss?.();
        }, 400);
      }, 9000);

      return () => clearTimeout(timer);
    }
  }, [data.phase, isUndone, isHovered, onDismiss]);

  const handleUndoClick = () => {
    setIsUndone(true);
    onUndo?.();
  };

  const handleManualDismiss = () => {
    setIsCollapsing(true);
    setTimeout(() => {
      onDismiss?.();
    }, 280);
  };

  const getStepIcon = (iconName: string, size = 13) => {
    if (iconName === 'recall') {
      return (
        <div className="relative w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/recall-logo.png"
            alt="Recall"
            className="w-full h-full object-contain"
          />
        </div>
      );
    }
    return <PluginIcon id={iconName as PluginId} size={size} />;
  };

  const usedApps: PluginId[] =
    data.usedApps && data.usedApps.length > 0
      ? data.usedApps
      : data.primaryChannel
      ? [data.primaryChannel as PluginId]
      : [];

  if (isUndone) {
    return (
      <div className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-black/[0.06] dark:border-white/[0.08] p-3 px-4 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 apple-fade-in shadow-2xs">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-medium">Action undone · Reverted</span>
        </div>
        <button
          type="button"
          onClick={handleManualDismiss}
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ── PHASE 1: DYNAMIC LIVE PROGRESS CHECKLIST ─────────────────────────────
  if (data.phase === 'progress') {
    return (
      <div
        className={`w-full rounded-[22px] bg-white/95 dark:bg-zinc-900/95 border border-black/[0.08] dark:border-white/[0.08] p-4.5 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] apple-slide-down relative overflow-hidden backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isCollapsing
            ? 'opacity-0 -translate-y-2 max-h-0 py-0 my-0 overflow-hidden'
            : 'opacity-100 max-h-[520px]'
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-cyan-400/20 to-violet-500/20" />

        {/* Progress Header */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
            </span>
            <span className="text-xs sm:text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
              {data.headline || 'Working…'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {usedApps.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                {usedApps.map((appId, i) => (
                  <React.Fragment key={appId}>
                    {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">·</span>}
                    <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                      <PluginIcon id={appId} size={11} />
                      <span className="capitalize">
                        {appId === 'calendar'
                          ? 'Calendar'
                          : appId === 'whatsapp'
                          ? 'WhatsApp'
                          : appId === 'gmail'
                          ? 'Gmail'
                          : appId === 'drive'
                          ? 'Drive'
                          : 'Recall'}
                      </span>
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleManualDismiss}
              title="Dismiss"
              className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Step Progression Checklist with connector line */}
        <div className="relative pl-1">
          {data.steps.length > 1 && (
            <div className="absolute left-[13px] top-3 bottom-3 w-px bg-zinc-200/80 dark:bg-zinc-800/80 -z-0" />
          )}

          <div className="space-y-2.5">
            {data.steps.map((step, idx) => {
              const isCompleted = activeStepIndex > idx;
              const isRunning = activeStepIndex === idx;

              return (
                <div
                  key={step.id || idx}
                  className={`relative z-10 flex items-center justify-between gap-3 text-xs transition-all duration-300 ${
                    activeStepIndex >= idx ? 'opacity-100' : 'opacity-35'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.08] shadow-2xs shrink-0">
                      {getStepIcon(step.icon, 13)}
                    </div>
                    <span
                      className={`truncate transition-colors ${
                        isCompleted
                          ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                          : isRunning
                          ? 'text-zinc-900 dark:text-white font-semibold'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center pr-1">
                    {isCompleted ? (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-in zoom-in-75 duration-200 shadow-2xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    ) : isRunning ? (
                      <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 2: LUXURIOUS APPLE-GRADE COMPLETED RESULT CARD ────────────────
  const displayItem = data.items && data.items.length > 0 ? data.items[0] : null;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full rounded-[22px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.08] p-4.5 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] apple-slide-down relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isCollapsing
          ? 'opacity-0 -translate-y-2 max-h-0 py-0 my-0 overflow-hidden'
          : 'opacity-100 max-h-[600px]'
      }`}
    >
      {/* Top row: Status, Headline, and Actions */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(16,185,129,0.35)] shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <div className="min-w-0">
            <span className="text-xs sm:text-[13px] font-semibold text-zinc-900 dark:text-white tracking-tight">
              {data.headline || 'Done'}
            </span>
            {data.subheadline && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal ml-2 truncate">
                · {data.subheadline}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {usedApps.length > 0 && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-black/[0.06] dark:border-white/[0.08]">
              {usedApps.map((appId) => (
                <span key={appId} className="w-4 h-4 flex items-center justify-center">
                  <PluginIcon id={appId} size={12} />
                </span>
              ))}
            </div>
          )}

          {onUndo && (
            <button
              type="button"
              onClick={handleUndoClick}
              className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleManualDismiss}
            title="Dismiss"
            className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Structured Details Box */}
      {(displayItem || data.title) && (
        <div className="p-3.5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.05] space-y-2 mb-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
              {displayItem?.title || data.title}
            </span>

            {displayItem?.time && (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 shrink-0">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{displayItem.time}</span>
              </span>
            )}
          </div>

          {/* Quick Context Pills */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3 text-blue-500" />
              <span>Google Calendar</span>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="flex items-center gap-1">
              <Bell className="w-3 h-3 text-amber-500" />
              <span>Smart alert 30m before</span>
            </span>
          </div>
        </div>
      )}

      {/* AI Reply Note (if available) */}
      {data.aiReply && (
        <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal pt-1">
          {data.aiReply}
        </div>
      )}

      {/* Recommendations Chips */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          {data.recommendations.map((rec) => (
            <button
              key={rec.id}
              type="button"
              onClick={() => onSelectRecommendation?.(rec.prompt)}
              className="px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{rec.label}</span>
              <ArrowRight className="w-2.5 h-2.5 text-zinc-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
