'use client';

import React, { useState } from 'react';
import { Calendar, Check, Clock3, Mail, Pencil } from 'lucide-react';
import { PluginIcon } from './PluginIcon';

export interface ProposedPlanItem {
  id: string;
  actionIndex: number;
  title: string;
  start: string;
  end?: string;
  timeLabel: string;
  reminderMinutes: number;
  reminderLabel: string;
  reminderReason: string;
  calendar: boolean;
  gmailContext: boolean;
}

interface ProposedPlanCardProps {
  items: ProposedPlanItem[];
  summary?: string;
  autoSave: boolean;
  isApplying?: boolean;
  onApprove: (items: ProposedPlanItem[]) => void;
  onChange: (items: ProposedPlanItem[]) => void;
  onDismiss?: () => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

export const ProposedPlanCard: React.FC<ProposedPlanCardProps> = ({
  items,
  summary,
  autoSave,
  isApplying = false,
  onApprove,
  onChange,
  onDismiss,
}) => {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const firstDate = items[0] ? new Date(items[0].start) : null;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const relativeDate = firstDate
    ? firstDate.toDateString() === today.toDateString()
      ? 'Today'
      : firstDate.toDateString() === tomorrow.toDateString()
      ? 'Tomorrow'
      : firstDate.toLocaleDateString('en-US', { weekday: 'long' })
    : '';
  const dateLabel = firstDate
    ? `${relativeDate} · ${firstDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })}`
    : '';

  const updateItem = (index: number, updates: Partial<ProposedPlanItem>) => {
    const next = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...updates } : item
    );
    onChange(next);
  };

  const updateTime = (index: number, value: string) => {
    const item = items[index];
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;

    const previousStart = new Date(item.start);
    const previousEnd = item.end ? new Date(item.end) : null;
    const duration = previousEnd
      ? Math.max(15 * 60000, previousEnd.getTime() - previousStart.getTime())
      : 60 * 60000;

    const nextStart = new Date(previousStart);
    nextStart.setHours(hours, minutes, 0, 0);
    const nextEnd = new Date(nextStart.getTime() + duration);
    const nextReminder = new Date(nextStart.getTime() - item.reminderMinutes * 60000);
    const reasonSuffix = item.reminderReason.includes(' — ')
      ? item.reminderReason.split(' — ').slice(1).join(' — ')
      : 'a comfortable buffer before it starts.';
    const reminderTime = nextReminder.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    updateItem(index, {
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
      timeLabel: formatTime(nextStart.toISOString()),
      reminderReason: `I’ll remind you at ${reminderTime} — ${reasonSuffix}`,
    });
  };

  return (
    <div className="w-full rounded-[24px] bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgba(0,82,255,0.06)] overflow-hidden apple-slide-down">
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-black/[0.05] dark:border-white/[0.07] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-blue-600 dark:text-blue-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>PROPOSED PLAN</span>
          </div>
          <p className="mt-1.5 text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {summary || 'I found a calm, conflict-aware order for your day. Review it before I add anything.'}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 rounded-full bg-black/[0.03] dark:bg-white/[0.06] px-2.5 py-1 border border-black/[0.04] dark:border-white/[0.06]">
          <span className={`w-1.5 h-1.5 rounded-full ${autoSave ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
          {autoSave ? 'Auto Save on' : 'Approval required'}
        </div>
      </div>

      <div className="px-3 sm:px-5 py-2">
        {dateLabel && (
          <div className="px-1 pt-1.5 pb-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tracking-tight">
            {dateLabel}
          </div>
        )}
        {items.map((item, index) => {
          const localTime = new Date(item.start);
          const timeValue = `${String(localTime.getHours()).padStart(2, '0')}:${String(localTime.getMinutes()).padStart(2, '0')}`;

          return (
            <div
              key={item.id}
              className="group grid grid-cols-[82px_minmax(0,1fr)] sm:grid-cols-[100px_minmax(0,1fr)] gap-2.5 sm:gap-4 py-3 border-b last:border-b-0 border-black/[0.05] dark:border-white/[0.06]"
            >
              <div className="pt-0.5">
                {isAdjusting ? (
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(event) => updateTime(index, event.target.value)}
                    className="w-[78px] sm:w-[92px] rounded-lg bg-zinc-50 dark:bg-white/[0.06] border border-black/[0.07] dark:border-white/[0.08] px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100 outline-none focus:border-blue-400"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <Clock3 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{item.timeLabel}</span>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                {isAdjusting ? (
                  <input
                    type="text"
                    value={item.title}
                    onChange={(event) => updateItem(index, { title: event.target.value })}
                    className="w-full rounded-lg bg-zinc-50 dark:bg-white/[0.06] border border-black/[0.07] dark:border-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-400"
                  />
                ) : (
                  <div className="text-[13px] sm:text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                    {item.title}
                  </div>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400">
                  {item.calendar && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Calendar
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <PluginIcon id="whatsapp" size={11} /> {item.reminderLabel}
                  </span>
                  {item.gmailContext && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Gmail context found
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-500">
                  {item.reminderReason}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 sm:px-5 py-3.5 border-t border-black/[0.05] dark:border-white/[0.07] bg-zinc-50/60 dark:bg-white/[0.025] flex items-center justify-between gap-3">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        ) : <span />}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdjusting((current) => !current)}
            disabled={isApplying}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-white/[0.06] border border-black/[0.07] dark:border-white/[0.08] hover:bg-zinc-50 dark:hover:bg-white/[0.09] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isAdjusting ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {isAdjusting ? 'Done adjusting' : 'Adjust'}
          </button>
          <button
            type="button"
            onClick={() => onApprove(items)}
            disabled={isApplying || items.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-white dark:text-zinc-900 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isApplying ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/70 dark:border-zinc-500 border-t-transparent rounded-full animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" /> Apply Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
