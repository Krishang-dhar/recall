'use client';

import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, RotateCcw, MapPin, Mail, Clock, ArrowRight } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';

export interface ActionStepStatus {
  id: 'recall' | 'calendar' | 'whatsapp' | 'gmail' | 'drive';
  label: string;
  detail?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'needs_connect';
  errorText?: string;
  connectUrl?: string;
  connectLabel?: string;
}

export interface ActionExecutionCardProps {
  title: string;
  timeSubtitle?: string;
  isMeeting?: boolean;
  steps: ActionStepStatus[];
  onUndo?: () => void;
  onSuggestionClick?: (prompt: string) => void;
  onDismiss?: () => void;
  onConnectPlugin?: (pluginId: string) => void;
}

export const ActionExecutionCard: React.FC<ActionExecutionCardProps> = ({
  title,
  timeSubtitle,
  isMeeting = false,
  steps,
  onUndo,
  onSuggestionClick,
  onDismiss,
  onConnectPlugin,
}) => {
  // Staggered animation indices for smooth step-by-step appearance
  const [visibleStepCount, setVisibleStepCount] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Reveal steps progressively every 250ms
    const timers: NodeJS.Timeout[] = [];
    steps.forEach((step, idx) => {
      const timer = setTimeout(() => {
        setVisibleStepCount((prev) => Math.max(prev, idx + 1));
        if (step.status === 'success') {
          setTimeout(() => {
            setCompletedSteps((prev) => ({ ...prev, [step.id]: true }));
          }, 150);
        }
      }, idx * 240);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [steps]);

  const allCompleted = steps.every((s) => s.status === 'success' || s.status === 'needs_connect');
  const hasFailures = steps.some((s) => s.status === 'needs_connect' || s.status === 'failed');

  return (
    <div className="w-full rounded-[24px] bg-white border border-black/[0.07] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-5 transition-all duration-300 apple-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                allCompleted
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : 'bg-[#0052FF] animate-pulse'
              }`}
            />
            <span className="text-xs font-semibold text-zinc-900 tracking-tight">
              {allCompleted ? 'Done' : 'Organizing this…'}
            </span>
          </div>

          <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight mt-1 leading-snug">
            {title}
          </h3>

          {timeSubtitle && (
            <p className="text-xs text-zinc-400 font-normal mt-0.5">{timeSubtitle}</p>
          )}
        </div>

        {onUndo && allCompleted && (
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer shrink-0"
            title="Undo this action"
          >
            <RotateCcw className="w-3 h-3 text-zinc-500" />
            <span>Undo</span>
          </button>
        )}
      </div>

      {/* Action Progress Steps */}
      <div className="space-y-2 pt-1 border-t border-black/[0.04]">
        {steps.slice(0, visibleStepCount).map((step, index) => {
          const isDone = completedSteps[step.id] || step.status === 'success';
          const isNeedsConnect = step.status === 'needs_connect';

          return (
            <div
              key={step.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/80 border border-black/[0.03] transition-all duration-300 apple-slide-down"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Brand / Tool Icon */}
                <div className="w-7 h-7 rounded-lg bg-white shadow-2xs border border-black/[0.04] flex items-center justify-center shrink-0">
                  <PluginIcon id={step.id as PluginId} size={16} />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-900 flex items-center gap-1.5 truncate">
                    <span>{step.label}</span>
                  </div>
                  {step.detail && (
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {step.detail}
                    </div>
                  )}
                  {step.errorText && (
                    <div className="text-[11px] text-amber-600 mt-0.5 font-medium">
                      {step.errorText}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="shrink-0 pl-2">
                {isNeedsConnect ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step.connectUrl) window.location.href = step.connectUrl;
                      else onConnectPlugin?.(step.id);
                    }}
                    className="px-2.5 py-1 rounded-full bg-blue-50 text-[#0052FF] hover:bg-blue-100 text-[11px] font-semibold border border-blue-200/60 transition-colors cursor-pointer"
                  >
                    {step.connectLabel || 'Connect'}
                  </button>
                ) : isDone ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(16,185,129,0.35)] transition-transform duration-300 scale-100">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-blue-500/20 border-t-blue-600 animate-spin" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* "Anything else?" Contextual Suggestions */}
      {allCompleted && (
        <div className="pt-2 border-t border-black/[0.04] space-y-2">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Anything else?
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isMeeting && (
              <>
                <button
                  type="button"
                  onClick={() => onSuggestionClick?.(`Add location to ${title}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-black/[0.05] transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
                >
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span>Add location</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSuggestionClick?.(`Draft confirmation email for ${title}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-black/[0.05] transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
                >
                  <Mail className="w-3 h-3 text-blue-500" />
                  <span>Send confirmation email</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSuggestionClick?.(`Change reminder for ${title} to 1 hour before`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-black/[0.05] transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
                >
                  <Clock className="w-3 h-3 text-emerald-600" />
                  <span>Change reminder time</span>
                </button>
              </>
            )}

            {!isMeeting && (
              <>
                <button
                  type="button"
                  onClick={() => onSuggestionClick?.(`Schedule time on my calendar for ${title}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-black/[0.05] transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
                >
                  <PluginIcon id="calendar" size={13} />
                  <span>Put on Calendar</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSuggestionClick?.(`Remind me on WhatsApp for ${title}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-black/[0.05] transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
                >
                  <PluginIcon id="whatsapp" size={13} />
                  <span>WhatsApp reminder</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-full bg-transparent hover:bg-zinc-100 text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer ml-auto"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
