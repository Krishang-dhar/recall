'use client';

import React from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';

export type PlanningPhase =
  | 'idle'
  | 'understanding'
  | 'checking_calendar'
  | 'checking_gmail'
  | 'planning'
  | 'proposal_ready'
  | 'awaiting_approval'
  | 'executing'
  | 'completed'
  | 'error';

export interface PlanningToolStep {
  id: string;
  tool: PluginId;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  detail?: string;
}

export interface PlanningMachineState {
  phase: PlanningPhase;
  steps: PlanningToolStep[];
  message?: string;
}

interface PlanningProgressCardProps {
  state: PlanningMachineState;
}

const phaseTitle: Record<PlanningPhase, string> = {
  idle: '',
  understanding: 'Understanding your request…',
  checking_calendar: 'Checking your schedule…',
  checking_gmail: 'Looking for useful meeting context…',
  planning: 'Building a realistic plan…',
  proposal_ready: 'Your proposed plan is ready',
  awaiting_approval: 'Waiting for your approval',
  executing: 'Applying your approved plan…',
  completed: 'Plan added to your day',
  error: 'Planning stopped',
};

export const PlanningProgressCard: React.FC<PlanningProgressCardProps> = ({ state }) => {
  if (state.phase === 'idle' || state.phase === 'proposal_ready' || state.phase === 'awaiting_approval') {
    return null;
  }

  const runningStep = state.steps.find((s) => s.status === 'running');
  const currentHeading =
    state.phase === 'completed'
      ? 'Plan added to your day'
      : state.phase === 'error'
      ? state.message || 'Planning stopped'
      : runningStep
      ? `${runningStep.label}…`
      : phaseTitle[state.phase] || 'Planning…';

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.03)] apple-slide-down overflow-hidden">
      <div className="flex items-center gap-2 mb-3.5">
        {state.phase === 'completed' ? (
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <Check className="w-3 h-3 stroke-[3]" />
          </span>
        ) : state.phase === 'error' ? (
          <AlertCircle className="w-5 h-5 text-rose-500" />
        ) : (
          <span className="relative flex h-2 w-2 ml-1.5 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-900 dark:bg-zinc-100" />
          </span>
        )}
        <span className="text-xs sm:text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {currentHeading}
        </span>
      </div>

      <div className="space-y-2.5">
        {state.steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start justify-between gap-3 text-xs transition-all duration-500 ${
              step.status === 'pending' ? 'opacity-35' : 'opacity-100'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] shadow-2xs shrink-0">
                <PluginIcon id={step.tool} size={13} />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className={`truncate ${step.status === 'running' ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>
                  {step.label}
                </div>
                {step.detail && (
                  <div className={`mt-0.5 text-[10px] sm:text-[11px] leading-snug ${step.status === 'error' ? 'text-rose-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {step.detail}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 pt-1">
              {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-200 animate-spin" />}
              {step.status === 'success' && (
                <span className="w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
              {step.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
              {step.status === 'pending' && <span className="block mt-1 w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />}
            </div>
          </div>
        ))}
      </div>

      {state.message && (
        <p className={`mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-[11px] leading-relaxed ${state.phase === 'error' ? 'text-rose-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {state.message}
        </p>
      )}
    </div>
  );
};
