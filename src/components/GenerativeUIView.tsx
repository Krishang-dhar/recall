'use client';

import React, { useState } from 'react';
import {
  Calendar,
  BookOpen,
  MapPin,
  CheckCircle2,
  ExternalLink,
  Target,
  Edit2,
  Trash2,
  Plus,
} from 'lucide-react';
import { GenerativeUIData, GenerativeUIPlanSlot } from '@/lib/recall-ai';

interface GenerativeUIViewProps {
  data: GenerativeUIData;
  onApplyPlan?: (slots: GenerativeUIPlanSlot[]) => void;
  onStartFocus?: (title: string, mins: number) => void;
  onSelectOption?: (option: string) => void;
}

export const GenerativeUIView: React.FC<GenerativeUIViewProps> = ({
  data,
  onApplyPlan,
  onStartFocus,
  onSelectOption,
}) => {
  const [editableSlots, setEditableSlots] = useState<GenerativeUIPlanSlot[]>(
    data.planSlots || []
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  if (!data) return null;

  switch (data.type) {
    case 'day_plan':
      return (
        <div className="rounded-2xl bg-white border border-black/[0.06] p-4 shadow-sm flex flex-col gap-3 apple-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold tracking-tight text-zinc-900">
                {data.title || 'Today’s Timetable'}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              {editableSlots.length} blocks
            </span>
          </div>

          {/* Interactive editable timetable slots */}
          <div className="flex flex-col gap-2">
            {editableSlots.map((slot, i) => (
              <div
                key={i}
                className="group flex items-start justify-between p-2.5 rounded-xl bg-zinc-50/80 hover:bg-zinc-100/90 transition-all border border-transparent hover:border-black/[0.04]"
              >
                <div className="flex flex-col min-w-0 pr-2 flex-1">
                  {editingIndex === i ? (
                    <input
                      type="text"
                      autoFocus
                      value={slot.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditableSlots((prev) =>
                          prev.map((s, idx) => (idx === i ? { ...s, title: val } : s))
                        );
                      }}
                      onBlur={() => setEditingIndex(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingIndex(null);
                      }}
                      className="text-xs font-medium text-zinc-900 bg-white px-2 py-0.5 rounded border border-indigo-300 outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => setEditingIndex(i)}
                      className="text-xs font-medium text-zinc-900 tracking-tight cursor-text hover:text-indigo-600 flex items-center gap-1.5"
                    >
                      {slot.title}
                      <Edit2 className="w-2.5 h-2.5 text-zinc-400 opacity-0 group-hover:opacity-100" />
                    </span>
                  )}

                  {slot.note && (
                    <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {slot.note}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    onClick={() => {
                      const newTime = prompt('Edit time range:', slot.timeSlot);
                      if (newTime) {
                        setEditableSlots((prev) =>
                          prev.map((s, idx) => (idx === i ? { ...s, timeSlot: newTime } : s))
                        );
                      }
                    }}
                    title="Click to edit time"
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-100/80 text-zinc-700 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    {slot.timeSlot}
                  </span>

                  <button
                    onClick={() =>
                      setEditableSlots((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {onApplyPlan && editableSlots.length > 0 && (
            <button
              onClick={() => onApplyPlan(editableSlots)}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply plan to tasks</span>
            </button>
          )}
        </div>
      );

    case 'focus_card':
      return (
        <div className="rounded-[22px] bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/30 dark:from-indigo-950/20 dark:via-zinc-900/90 dark:to-violet-950/20 border border-indigo-200/60 dark:border-indigo-800/40 p-5 shadow-[0_8px_30px_rgba(99,102,241,0.06)] flex flex-col gap-3.5 apple-fade-in backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-100/60 dark:border-indigo-900/40">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Recommended Focus Action
              </span>
            </div>
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
              High Leverage
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">
              {data.focusRecommendation?.title}
            </span>
            {data.focusRecommendation?.reason && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {data.focusRecommendation.reason}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.05]">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Target: {data.focusRecommendation?.estimatedMinutes || 25} minutes</span>
            </span>
            {onStartFocus && data.focusRecommendation && (
              <button
                onClick={() =>
                  onStartFocus(
                    data.focusRecommendation!.title,
                    data.focusRecommendation!.estimatedMinutes || 25
                  )
                }
                className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-95"
              >
                Start Session →
              </button>
            )}
          </div>
        </div>
      );

    case 'location_card':
      return (
        <div className="rounded-2xl bg-white border border-black/[0.06] p-3.5 shadow-sm flex items-center justify-between gap-3 apple-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-zinc-900 truncate">
                {data.location?.name}
              </span>
              {data.location?.address && (
                <span className="text-[11px] text-zinc-400 truncate">
                  {data.location.address}
                </span>
              )}
            </div>
          </div>

          <a
            href={
              data.location?.mapsUrl ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                data.location?.name || ''
              )}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition-colors shrink-0"
          >
            <span>Open Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      );

    case 'tasks_agenda':
      return (
        <div className="rounded-2xl bg-white border border-black/[0.06] p-4 shadow-sm flex flex-col gap-2 apple-fade-in">
          <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.04]">
            <span className="text-xs font-semibold text-zinc-900">Today’s Tasks</span>
            <span className="text-[11px] text-zinc-400 font-medium">
              {data.planSlots?.length || 0} scheduled
            </span>
          </div>

          <div className="divide-y divide-black/[0.04]">
            {data.planSlots?.map((slot, i) => (
              <div key={i} className="py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-800">
                  {slot.title}
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  {slot.timeSlot}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'calendar_agenda':
      return (
        <div className="rounded-2xl bg-white border border-black/[0.06] p-4 shadow-xs flex flex-col gap-3 apple-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-zinc-900">
                {data.title || 'Calendar Schedule'}
              </span>
            </div>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 flex items-center gap-1 transition-colors"
            >
              <span>Google Calendar</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex flex-col gap-2">
            {data.planSlots?.map((slot, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/70 border border-black/[0.04]"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-xs font-semibold text-zinc-800 truncate">
                    {slot.title}
                  </span>
                  {slot.note && (
                    <span className="text-[11px] text-zinc-400 truncate">{slot.note}</span>
                  )}
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-black/[0.05] text-zinc-700 shrink-0">
                  {slot.timeSlot}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'gmail_cards':
      return (
        <div className="rounded-2xl bg-white border border-red-100 p-4 shadow-xs flex flex-col gap-3 apple-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-zinc-900">
                {data.title || 'Gmail Inbox'}
              </span>
            </div>
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <span>Open Gmail</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex flex-col gap-2">
            {data.emails?.map((mail, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-zinc-50 border border-black/[0.04] space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800">{mail.sender}</span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {mail.relativeTime || 'Recent'}
                  </span>
                </div>
                <div className="text-xs font-medium text-zinc-900">{mail.subject}</div>
                {mail.snippet && (
                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                    {mail.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case 'drive_cards':
      return (
        <div className="rounded-2xl bg-white border border-emerald-100 p-4 shadow-xs flex flex-col gap-3 apple-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-zinc-900">
                {data.title || 'Google Drive Files'}
              </span>
            </div>
            <a
              href="https://drive.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex flex-col gap-2">
            {data.driveFiles?.map((f, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-zinc-50 border border-black/[0.04] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-800 truncate">{f.name}</div>
                  <div className="text-[11px] text-zinc-400 font-mono">{f.size || 'Google Doc'}</div>
                </div>
                <a
                  href={f.webViewLink || 'https://drive.google.com'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-1 shrink-0"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
};
