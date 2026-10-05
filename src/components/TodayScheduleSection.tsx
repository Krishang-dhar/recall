'use client';

import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Plus,
  MoreVertical,
  Trash2,
  Bell,
  ExternalLink,
  MapPin,
  Check,
} from 'lucide-react';
import { Task } from '@/lib/types';
import { PluginIcon } from './PluginIcon';

interface TodayScheduleSectionProps {
  tasks: Task[];
  isLoading: boolean;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onSnoozeTask: (id: string, minutes: number) => Promise<any>;
  onOpenComposer: () => void;
  onEditTask: (task: Task) => void;
  onAskRecall: (prompt: string) => void;
}

export const TodayScheduleSection: React.FC<TodayScheduleSectionProps> = ({
  tasks,
  isLoading,
  onUpdateTask,
  onDeleteTask,
  onSnoozeTask,
  onOpenComposer,
  onEditTask,
  onAskRecall,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Date formatting for the prominent header block
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = now.toLocaleDateString('en-US', { month: 'short' });
  const fullDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const dayNumber = now.getDate();

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Filter tasks that belong to today (or overdue pending)
  const todayItems = tasks.filter((t) => {
    if (t.status === 'completed') return true;
    const due = new Date(t.due_at);
    return due <= todayEnd;
  }).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  const pendingCount = todayItems.filter((t) => t.status === 'pending').length;
  const meetingsCount = todayItems.filter((t) => t.is_meeting).length;

  const formatItemTime = (dueAt: string, endTime?: string | null) => {
    try {
      const s = new Date(dueAt);
      const fmt = (d: Date) =>
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      if (endTime) {
        return `${fmt(s)} – ${fmt(new Date(endTime))}`;
      }
      return fmt(s);
    } catch {
      return 'Today';
    }
  };

  return (
    <section className="flex flex-col gap-4 mt-2">
      {/* ── 1. PROMINENT TODAY DATE & SCHEDULE HEADER BLOCK ──────────────────── */}
      <div className="rounded-[24px] bg-white border border-black/[0.07] p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Day Name, Full Date & Summary Counter */}
        <div className="flex items-center gap-4">
          {/* iOS Style Calendar Date Tile */}
          <div className="w-14 h-14 rounded-2xl bg-white border border-black/[0.08] shadow-xs flex flex-col items-center justify-center shrink-0 overflow-hidden">
            <div className="w-full bg-[#FF3B30] text-white text-[9px] font-bold uppercase tracking-wider text-center py-0.5">
              {monthName}
            </div>
            <div className="text-xl font-bold text-zinc-900 leading-tight pt-0.5">
              {dayNumber}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                {dayName}
              </h2>
              <span className="text-xs text-zinc-400 font-normal">·</span>
              <span className="text-xs sm:text-sm font-medium text-zinc-500">
                {fullDate}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-[#0052FF] text-[11px] font-semibold border border-blue-100">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
                <span>
                  {todayItems.length === 0
                    ? 'All clear today'
                    : `${todayItems.length} scheduled (${meetingsCount} meetings)`}
                </span>
              </span>

              <span className="text-zinc-300">·</span>

              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <PluginIcon id="calendar" size={11} />
                  <span>Google Calendar</span>
                </span>
                <span>+</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <PluginIcon id="whatsapp" size={11} />
                  <span>WhatsApp</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Add Task Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenComposer}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add task</span>
          </button>
        </div>
      </div>

      {/* ── 2. REDESIGNED TODAY SCHEDULE TABLE / LIST ────────────────────────── */}
      <div className="rounded-[24px] bg-white border border-black/[0.07] shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-black/[0.05] bg-zinc-50/70 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          <div className="col-span-3 sm:col-span-2">Time</div>
          <div className="col-span-6 sm:col-span-7">Schedule Item</div>
          <div className="col-span-3 sm:col-span-3 text-right">Destinations & Action</div>
        </div>

        {/* Table Body Content */}
        {todayItems.length === 0 ? (
          /* Calm Clean Empty State */
          <div className="py-14 sm:py-16 px-4 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-black/[0.05] flex items-center justify-center text-zinc-400 shadow-2xs">
              <CalendarIcon className="w-6 h-6 stroke-[1.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight">
                No items scheduled for today
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Say: &ldquo;Tomorrow 4 PM meeting with Rahul&rdquo; or click below to organize your day.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onAskRecall('Plan my day around meetings and work')}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-black/[0.08] text-xs font-semibold text-zinc-800 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span>Plan my day</span>
              </button>

              <button
                type="button"
                onClick={() => onAskRecall('Schedule a 4 PM meeting with Rahul tomorrow')}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-black/[0.08] text-xs font-semibold text-zinc-800 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <PluginIcon id="calendar" size={13} />
                <span>Schedule 4 PM meeting</span>
              </button>

              <button
                type="button"
                onClick={onOpenComposer}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-black/[0.08] text-xs font-semibold text-zinc-800 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual task</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {todayItems.map((item) => {
              const isCompleted = item.status === 'completed';
              const timeString = formatItemTime(item.due_at, item.end_time);

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-zinc-50/80 transition-colors group ${
                    isCompleted ? 'opacity-50' : ''
                  }`}
                >
                  {/* Column 1: Time with Clock Pill */}
                  <div className="col-span-3 sm:col-span-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100/70 border border-black/[0.04] text-[11px] font-semibold text-zinc-700">
                      <Clock className="w-3 h-3 text-[#0052FF]" />
                      <span>{timeString}</span>
                    </div>
                  </div>

                  {/* Column 2: Item Name, Category & Note */}
                  <div className="col-span-6 sm:col-span-7 flex flex-col justify-center min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs sm:text-[13px] font-semibold text-zinc-900 truncate ${
                          isCompleted ? 'line-through text-zinc-400' : ''
                        }`}
                      >
                        {item.title}
                      </span>

                      {item.is_meeting && (
                        <span className="px-2 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold shrink-0">
                          Meeting
                        </span>
                      )}
                    </div>

                    {(item.note || item.location) && (
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                        {item.location ? (
                          <>
                            <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                            <span>{item.location}</span>
                          </>
                        ) : (
                          item.note
                        )}
                      </p>
                    )}
                  </div>

                  {/* Column 3: Destination Badges + Action Checkbox */}
                  <div className="col-span-3 sm:col-span-3 flex items-center justify-end gap-2 shrink-0">
                    {/* Destination Badges: Google Calendar + WhatsApp */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      {item.calendar_event_id && (
                        <span
                          title="Synced to Google Calendar"
                          className="w-6 h-6 rounded-md bg-blue-50/80 border border-blue-100/80 flex items-center justify-center shrink-0"
                        >
                          <PluginIcon id="calendar" size={12} />
                        </span>
                      )}

                      <span
                        title="WhatsApp reminder scheduled"
                        className="w-6 h-6 rounded-md bg-emerald-50/80 border border-emerald-100/80 flex items-center justify-center shrink-0"
                      >
                        <PluginIcon id="whatsapp" size={12} />
                      </span>
                    </div>

                    {/* Interactive Completion Toggle Button */}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTask(item.id, {
                          status: isCompleted ? 'pending' : 'completed',
                        })
                      }
                      title={isCompleted ? 'Mark incomplete' : 'Mark completed'}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                        isCompleted
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : 'border-black/[0.16] hover:border-black/[0.3] text-transparent hover:text-zinc-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Options menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(activeMenuId === item.id ? null : item.id)
                        }
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-800 transition-opacity rounded cursor-pointer"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuId === item.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 z-30 w-32 p-1 rounded-xl bg-white border border-black/[0.08] shadow-md space-y-0.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onEditTask(item);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-50 text-zinc-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSnoozeTask(item.id, 60);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-50 text-zinc-700"
                          >
                            Snooze 1h
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteTask(item.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
