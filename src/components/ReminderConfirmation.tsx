'use client';

import React, { useState } from 'react';
import { GeminiParsedTask } from '@/lib/types';
import { Clock, MapPin, Calendar, Check, X, Loader2 } from 'lucide-react';
import { SiGooglecalendar, SiWhatsapp } from 'react-icons/si';

interface ReminderConfirmationProps {
  parsed: GeminiParsedTask;
  onCancel: () => void;
  onConfirm: (options: {
    finalData: GeminiParsedTask;
    addToCalendar: boolean;
  }) => void;
  isSaving?: boolean;
}

export const ReminderConfirmation: React.FC<ReminderConfirmationProps> = ({
  parsed,
  onCancel,
  onConfirm,
  isSaving = false,
}) => {
  const [addToCalendar, setAddToCalendar] = useState<boolean>(
    Boolean(parsed.actions?.addToCalendar)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/15 backdrop-blur-xs transition-opacity duration-200">
      <div className="w-full max-w-sm rounded-[26px] bg-white/95 backdrop-blur-3xl border border-white/80 p-5 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.95)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col gap-3.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-indigo-600 uppercase">
              I Understood
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] text-zinc-600 font-medium capitalize">
              {parsed.priority} priority
            </span>
          </div>

          {/* Title & Note */}
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 tracking-tight leading-snug">
              {parsed.title}
            </h3>
            {parsed.note && (
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                {parsed.note}
              </p>
            )}
          </div>

          {/* Time badge */}
          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-zinc-50/90 border border-black/[0.04] text-zinc-700 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-zinc-400 stroke-[2]" />
            <span>{parsed.formatted_time_label || new Date(parsed.due_at).toLocaleString()}</span>
          </div>

          {/* Location badge if present */}
          {parsed.location && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-zinc-50/90 border border-black/[0.04] text-zinc-700 text-xs font-medium">
              <MapPin className="w-3.5 h-3.5 text-rose-500 stroke-[2]" />
              <span className="truncate">{parsed.location}</span>
            </div>
          )}

          {/* Contextual Action Toggles / Chips */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-black/[0.02] text-xs">
              <div className="flex items-center gap-2 text-zinc-700">
                <SiWhatsapp className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp reminder</span>
              </div>
              <span className="text-emerald-700 text-[11px] font-medium">Auto ✓</span>
            </div>

            <div
              onClick={() => setAddToCalendar(!addToCalendar)}
              className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] cursor-pointer transition-colors text-xs select-none"
            >
              <div className="flex items-center gap-2 text-zinc-700">
                <SiGooglecalendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Calendar</span>
              </div>
              <button
                type="button"
                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  addToCalendar
                    ? 'bg-zinc-900 border-zinc-900 text-white'
                    : 'border-zinc-300 bg-white'
                }`}
              >
                {addToCalendar && <Check className="w-3 h-3 stroke-[3]" />}
              </button>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 py-2 px-4 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm({ finalData: parsed, addToCalendar })}
              disabled={isSaving}
              className="flex-1 py-2 px-4 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Creating…</span>
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
