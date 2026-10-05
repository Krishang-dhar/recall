'use client';

import React from 'react';
import { EmailFollowUpSuggestion } from '@/lib/types';
import { Mail, Clock, ArrowRight, X } from 'lucide-react';
import { SiGmail } from 'react-icons/si';

interface EmailFollowUpsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: EmailFollowUpSuggestion[];
  onSelectEmail: (email: EmailFollowUpSuggestion) => void;
}

export const EmailFollowUpsModal: React.FC<EmailFollowUpsModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onSelectEmail,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs transition-opacity duration-200">
      <div className="w-full max-w-md rounded-[26px] bg-white/95 backdrop-blur-3xl border border-white/80 p-5 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <SiGmail className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                Possible Follow-Ups
              </h3>
              <p className="text-[11px] text-zinc-400">
                Turn unreplied emails into reminders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.04] transition-colors"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 py-4 max-h-[60vh] overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              No pending emails need follow-up right now.
            </div>
          ) : (
            suggestions.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-zinc-50/80 hover:bg-white border border-black/[0.04] hover:shadow-xs transition-all flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-800 truncate">
                    {item.sender}
                  </span>
                  <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                    {item.relativeTime}
                  </span>
                </div>
                <h4 className="text-xs font-medium text-zinc-900 line-clamp-1">
                  “{item.subject}”
                </h4>
                {item.snippet && (
                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                    {item.snippet}
                  </p>
                )}
                <div className="pt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSelectEmail(item)}
                    className="px-3 py-1 rounded-lg bg-zinc-900 text-white text-[11px] font-medium hover:bg-zinc-800 transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                  >
                    <span>Create reminder</span>
                    <ArrowRight className="w-3 h-3 stroke-[2]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
