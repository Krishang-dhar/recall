'use client';

import React from 'react';
import { GeminiParsedTask } from '@/lib/types';
import { Calendar, Clock, Check, X } from 'lucide-react';

interface ReminderSheetProps {
  parsed: GeminiParsedTask;
  onCancel: () => void;
  onConfirm: (finalData: GeminiParsedTask) => void;
  isSaving?: boolean;
}

export const ReminderSheet: React.FC<ReminderSheetProps> = ({
  parsed,
  onCancel,
  onConfirm,
  isSaving = false,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs transition-opacity duration-200">
      <div className="w-full max-w-sm rounded-[24px] bg-white/95 backdrop-blur-2xl border border-black/[0.08] p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-indigo-600 uppercase">
              Parsed Reminder
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium capitalize">
              {parsed.priority} priority
            </span>
          </div>

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

          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-700 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>{parsed.formatted_time_label || new Date(parsed.due_at).toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(parsed)}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-all shadow-xs active:scale-[0.98]"
            >
              {isSaving ? 'Creating...' : 'Create Reminder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
