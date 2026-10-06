'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  MoreVertical,
  Check,
  MapPin,
  Bell,
  Pencil,
  Trash2,
} from 'lucide-react';
import { PluginIcon } from './PluginIcon';
import { decideReminderTiming } from '@/lib/action-routing';
import { Task } from '@/lib/types';
import { useUserSession } from '@/lib/user-session';

function calculateReminderText(dueAt: string, reminderTime?: string | null, title?: string, location?: string | null, isMeeting?: boolean) {
  if (reminderTime) {
    const diff = Math.round((new Date(dueAt).getTime() - new Date(reminderTime).getTime()) / 60000);
    if (diff > 0) return `Reminder · ${diff} min before`;
  }
  const timing = decideReminderTiming(new Date(dueAt), Boolean(isMeeting), { title, location });
  return `Reminder · ${timing.minutesBefore} min before`;
}

export interface DayScheduleItem {
  id: string;
  title: string;
  due_at: string;
  end_time?: string | null;
  is_meeting: boolean;
  type: 'calendar' | 'task';
  note?: string | null;
  location?: string | null;
  status: 'pending' | 'completed';
  calendar_event_id?: string | null;
  reminder_time?: string | null;
  has_reminder?: boolean;
  reminder_text?: string;
  source: 'google' | 'recall';
  htmlLink?: string;
}

interface DayScheduleSectionProps {
  tasks: Task[];
  isLoading: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onSnoozeTask: (id: string, minutes: number) => Promise<any>;
  onOpenComposer: () => void;
  onEditTask: (task: Task) => void;
  onAskRecall: (prompt: string) => void;
  highlightedItemIds?: string[];
}

export const DayScheduleSection: React.FC<DayScheduleSectionProps> = ({
  tasks,
  isLoading,
  selectedDate,
  onSelectDate,
  onUpdateTask,
  onDeleteTask,
  onSnoozeTask,
  onOpenComposer,
  onEditTask,
  onAskRecall,
  highlightedItemIds = [],
}) => {
  const { session } = useUserSession();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Helper date comparisons (Local time based)
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const isToday = isSameDay(selectedDate, today);
  const isTomorrow = isSameDay(selectedDate, tomorrow);

  // Fetch Google Calendar events for the currently selected date (only for authenticated Google users)
  useEffect(() => {
    let cancelled = false;

    async function fetchDayCalendar() {
      if (session.isGuest) {
        setGoogleEvents([]);
        setIsCalendarLoading(false);
        return;
      }

      setIsCalendarLoading(true);
      try {
        const startOfDay = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          0,
          0,
          0,
          0
        );
        const endOfDay = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23,
          59,
          59,
          999
        );

        const res = await fetch(
          `/api/google/calendar/events?timeMin=${encodeURIComponent(
            startOfDay.toISOString()
          )}&timeMax=${encodeURIComponent(endOfDay.toISOString())}`,
          {
            headers: { 'x-session-mode': session.mode },
          }
        );
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.events)) {
          setGoogleEvents(data.events);
        }
      } catch (e) {
        console.warn('Failed to fetch calendar events for day', e);
      } finally {
        if (!cancelled) setIsCalendarLoading(false);
      }
    }

    fetchDayCalendar();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, session.mode, session.isGuest]);

  // Merge Recall tasks and Google Calendar events into one unified day timeline
  const dayItems: DayScheduleItem[] = useMemo(() => {
    const list: DayScheduleItem[] = [];

    // 1. Add tasks that fall on this selected date
    tasks.forEach((t) => {
      try {
        const dueDate = new Date(t.due_at);
        if (isSameDay(dueDate, selectedDate)) {
          const hasReminder = Boolean(
            t.reminder_time || t.is_meeting || t.calendar_event_id
          );
          list.push({
            id: t.id,
            title: t.title,
            due_at: t.due_at,
            end_time: t.end_time,
            is_meeting: Boolean(t.is_meeting || t.calendar_event_id),
            type: t.is_meeting || t.calendar_event_id ? 'calendar' : 'task',
            note: t.note,
            location: t.location,
            status: t.status,
            calendar_event_id: t.calendar_event_id,
            reminder_time: t.reminder_time,
            has_reminder: hasReminder,
            reminder_text: hasReminder
              ? calculateReminderText(t.due_at, t.reminder_time, t.title, t.location, t.is_meeting)
              : undefined,
            source: 'recall',
          });
        }
      } catch (e) {}
    });

    // 2. Merge Google Calendar events that aren't already represented in local tasks
    googleEvents.forEach((ge) => {
      const alreadyLinked = list.some(
        (item) =>
          item.calendar_event_id === ge.id ||
          item.title.trim().toLowerCase() === ge.summary?.trim().toLowerCase()
      );

      if (!alreadyLinked && ge.start?.dateTime) {
        try {
          const startDate = new Date(ge.start.dateTime);
          if (isSameDay(startDate, selectedDate)) {
            list.push({
              id: `gcal-${ge.id}`,
              title: ge.summary || '(Untitled Event)',
              due_at: ge.start.dateTime,
              end_time: ge.end?.dateTime,
              is_meeting: true,
              type: 'calendar',
              note: ge.description,
              location: ge.location,
              status: 'pending',
              calendar_event_id: ge.id,
              has_reminder: true,
              reminder_text: calculateReminderText(ge.start.dateTime, undefined, ge.summary, ge.location, true),
              source: 'google',
              htmlLink: ge.htmlLink,
            });
          }
        } catch (e) {}
      }
    });

    // Sort chronologically by due time
    return list.sort((a, b) => {
      const timeA = new Date(a.due_at).getTime();
      const timeB = new Date(b.due_at).getTime();
      return timeA - timeB;
    });
  }, [tasks, googleEvents, selectedDate]);

  // Navigation handlers
  const handlePrevDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() - 1);
    onSelectDate(next);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    onSelectDate(next);
  };

  const handleTodayClick = () => {
    onSelectDate(new Date());
  };

  const handleTomorrowClick = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    onSelectDate(d);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [year, month, day] = e.target.value.split('-').map(Number);
      if (year && month && day) {
        const d = new Date(year, month - 1, day);
        onSelectDate(d);
      }
    }
  };

  // Date strings for display
  const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long' });
  const dayNumber = selectedDate.getDate();
  const year = selectedDate.getFullYear();

  // Summary counts
  const meetingsCount = dayItems.filter((i) => i.is_meeting).length;
  const tasksCount = dayItems.filter((i) => !i.is_meeting).length;

  const summaryParts: string[] = [];
  if (meetingsCount > 0) {
    summaryParts.push(`${meetingsCount} ${meetingsCount === 1 ? 'meeting' : 'meetings'}`);
  }
  if (tasksCount > 0) {
    summaryParts.push(`${tasksCount} ${tasksCount === 1 ? 'task' : 'tasks'}`);
  }
  const summaryText =
    summaryParts.length > 0 ? summaryParts.join(' · ') : 'Nothing scheduled';

  // Format time for timeline row
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  // Close menus on document click
  useEffect(() => {
    const handleClick = () => setActiveMenuId(null);
    if (activeMenuId) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [activeMenuId]);

  return (
    <section className="flex flex-col gap-4 mt-1">
      {/* ── 1. DAY-WISE NAVIGATION BAR ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Left: Previous / Current Day / Next Day Controls */}
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] rounded-full p-1 shadow-2xs">
          <button
            type="button"
            onClick={handlePrevDay}
            title="Previous day"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-[#ececec] hover:bg-white dark:hover:bg-[#2c2c2c] transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <div className="px-3 text-xs sm:text-[13px] font-semibold text-zinc-900 dark:text-[#ececec] select-none tracking-tight">
            {dayOfWeek}, {monthName} {dayNumber}
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            title="Next day"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-[#ececec] hover:bg-white dark:hover:bg-[#2c2c2c] transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Right: Quick Jumps (Today, Tomorrow, Date Picker) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTodayClick}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              isToday
                ? 'bg-zinc-900 text-white dark:bg-[#ececec] dark:text-[#171717] font-semibold shadow-2xs'
                : 'bg-white hover:bg-zinc-50 dark:bg-[#262626] dark:hover:bg-[#303030] text-zinc-600 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08]'
            }`}
          >
            Today
          </button>

          <button
            type="button"
            onClick={handleTomorrowClick}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              isTomorrow
                ? 'bg-zinc-900 text-white dark:bg-[#ececec] dark:text-[#171717] font-semibold shadow-2xs'
                : 'bg-white hover:bg-zinc-50 dark:bg-[#262626] dark:hover:bg-[#303030] text-zinc-600 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08]'
            }`}
          >
            Tomorrow
          </button>

          {/* Date Picker Button with hidden input */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (dateInputRef.current) {
                  try {
                    dateInputRef.current.showPicker();
                  } catch {
                    dateInputRef.current.focus();
                  }
                }
              }}
              title="Select specific date"
              className="w-8 h-8 rounded-full bg-white hover:bg-zinc-50 dark:bg-[#262626] dark:hover:bg-[#303030] text-zinc-600 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center shadow-2xs cursor-pointer transition-colors"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="sr-only"
              onChange={handleDateInputChange}
            />
          </div>
        </div>
      </div>

      {/* ── 2. DAY HEADER (Elegant & Compact) ──────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-3 px-1 pt-2 pb-1 border-b border-black/[0.05] dark:border-white/[0.08]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#ececec]">
            {dayOfWeek}
          </h2>
          <p className="text-xs sm:text-sm font-normal text-zinc-500 dark:text-zinc-400">
            {monthName} {dayNumber}, {year}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100/80 dark:bg-white/[0.06] px-2.5 py-1 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
            {summaryText}
          </span>

          <button
            type="button"
            onClick={onOpenComposer}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-900 hover:bg-black dark:bg-[#ececec] dark:hover:bg-white text-white dark:text-[#171717] text-xs font-medium shadow-2xs cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* ── 3. CLEAN TIMELINE / LIST (NO HEAVY SPREADSHEET) ────────────────── */}
      <div className="flex flex-col">
        {dayItems.length === 0 ? (
          /* Clean Minimal Empty State */
          <div className="py-14 sm:py-16 px-4 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-zinc-50 border border-black/[0.05] flex items-center justify-center text-zinc-400">
              <CalendarIcon className="w-5 h-5 stroke-[1.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                Nothing needs your attention yet.
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Tell Recall what’s going on, or add your first task to get started.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onAskRecall('Plan my day around meetings and work')}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-black/[0.08] text-xs font-medium text-zinc-700 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span>Plan my day</span>
              </button>

              <button
                type="button"
                onClick={() => onAskRecall('Schedule a 4 PM meeting with Rahul tomorrow')}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-black/[0.08] text-xs font-medium text-zinc-700 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <PluginIcon id="calendar" size={13} />
                <span>Schedule 4 PM meeting</span>
              </button>

              <button
                type="button"
                onClick={onOpenComposer}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-black/[0.08] text-xs font-medium text-zinc-700 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual task</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative pl-2 sm:pl-3 space-y-2 mt-1">
            {/* Subtle timeline track */}
            <div className="absolute left-[31px] sm:left-[35px] top-4 bottom-4 w-px bg-zinc-200/80 -z-0" />

            {dayItems.map((item) => {
              const isCompleted = item.status === 'completed';
              const isNew = highlightedItemIds.includes(item.id);
              const timeString = formatTime(item.due_at);
              const endTimeString = item.end_time ? formatTime(item.end_time) : null;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    const original = tasks.find((t) => t.id === item.id);
                    if (original) {
                      onEditTask(original);
                    } else {
                      onEditTask({
                        id: item.id,
                        title: item.title,
                        note: item.note || null,
                        due_at: item.due_at,
                        end_time: item.end_time || null,
                        priority: 'medium',
                        status: item.status,
                        whatsapp_sent: false,
                        location: item.location || null,
                        is_meeting: item.is_meeting,
                        created_at: new Date().toISOString(),
                      });
                    }
                  }}
                  className={`group relative flex items-start gap-3 sm:gap-4 p-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                    isNew
                      ? 'animate-in fade-in-0 slide-in-from-top-3 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] bg-zinc-50/90 ring-1 ring-zinc-900/10 shadow-xs'
                      : 'hover:bg-zinc-50/90 dark:hover:bg-zinc-800/60'
                  } ${isCompleted ? 'opacity-50' : ''}`}
                >
                  {/* Left Column: Time */}
                  <div className="w-16 sm:w-20 pt-1 shrink-0 text-right">
                    <span className="text-xs sm:text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight block">
                      {timeString}
                    </span>
                    {endTimeString && (
                      <span className="text-[10px] text-zinc-400 font-normal block leading-tight">
                        – {endTimeString}
                      </span>
                    )}
                  </div>

                  {/* Center Dot on Timeline Track */}
                  <div className="relative z-10 pt-2 shrink-0">
                    <span
                      className={`block w-2.5 h-2.5 rounded-full border-2 bg-white transition-all ${
                        item.is_meeting
                          ? 'border-blue-600 group-hover:scale-125'
                          : 'border-zinc-400 group-hover:border-zinc-800'
                      } ${isCompleted ? 'bg-zinc-300 border-zinc-300' : ''}`}
                    />
                  </div>

                  {/* Main Content Card / Row */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm sm:text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate ${
                          isCompleted ? 'line-through text-zinc-400 font-normal' : ''
                        }`}
                      >
                        {item.title}
                      </span>

                      {/* Small subtle new pill */}
                      {isNew && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-medium shrink-0 animate-in zoom-in-75 duration-300">
                          Just added
                        </span>
                      )}
                    </div>

                    {/* Metadata Subtitle Row: Source + Reminder + Location/Note */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-zinc-500">
                      {/* Source tag */}
                      {item.is_meeting ? (
                        <span className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                          <PluginIcon id="calendar" size={12} />
                          <span>Meeting</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-500 font-medium">
                          <span>Task</span>
                        </span>
                      )}

                      {/* Subtle intelligent reminder info */}
                      {item.has_reminder && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-600">·</span>
                          <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 font-medium">
                            <Bell className="w-3 h-3 text-blue-500" />
                            <span>{item.reminder_text || 'Reminder set'}</span>
                          </span>
                        </>
                      )}

                      {/* Location snippet */}
                      {item.location && (
                        <>
                          <span className="text-zinc-300">·</span>
                          <span className="inline-flex items-center gap-1 text-zinc-500">
                            <MapPin className="w-3 h-3 text-zinc-400" />
                            <span className="truncate max-w-[180px]">{item.location}</span>
                          </span>
                        </>
                      )}

                      {/* Note snippet */}
                      {item.note && !item.location && (
                        <>
                          <span className="text-zinc-300">·</span>
                          <span className="text-zinc-400 truncate max-w-[220px]">
                            {item.note}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Complete Checkbox + Quick Edit + Quick Delete */}
                  <div
                    className="flex items-center gap-1.5 pt-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Completion button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (item.source === 'recall') {
                          onUpdateTask(item.id, {
                            status: isCompleted ? 'pending' : 'completed',
                          });
                        }
                      }}
                      title={isCompleted ? 'Mark pending' : 'Mark completed'}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                        isCompleted
                          ? 'bg-zinc-900 border-zinc-900 text-white'
                          : 'border-zinc-300 hover:border-zinc-700 text-transparent hover:text-zinc-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Quick Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        const original = tasks.find((t) => t.id === item.id);
                        if (original) {
                          onEditTask(original);
                        } else {
                          onEditTask({
                            id: item.id,
                            title: item.title,
                            note: item.note || null,
                            due_at: item.due_at,
                            end_time: item.end_time || null,
                            priority: 'medium',
                            status: item.status,
                            whatsapp_sent: false,
                            location: item.location || null,
                            is_meeting: item.is_meeting,
                            created_at: new Date().toISOString(),
                          });
                        }
                      }}
                      title="Edit meeting or task"
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick Delete button */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (item.source === 'recall') {
                          await onDeleteTask(item.id);
                        } else if (item.source === 'google' && item.calendar_event_id) {
                          try {
                            await fetch('/api/google/calendar/delete', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ eventId: item.calendar_event_id }),
                            });
                            setGoogleEvents((prev) => prev.filter((ev) => ev.id !== item.calendar_event_id));
                          } catch {}
                        }
                      }}
                      title="Delete"
                      className="p-1 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
