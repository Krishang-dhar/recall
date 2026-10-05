'use client';

import React from 'react';
import { Loader2, Check } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';

interface ToolActivityProps {
  channel: PluginId | 'recall';
  label: string;
  isCompleted?: boolean;
}

export const ToolActivity: React.FC<ToolActivityProps> = ({
  channel,
  label,
  isCompleted = false,
}) => {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-black/[0.06] shadow-xs w-fit text-xs apple-fade-in">
      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
        {channel === 'recall' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src="/recall-logo.png" alt="Recall" className="w-3.5 h-3.5 object-contain" />
        ) : (
          <PluginIcon id={channel} size={15} />
        )}
      </div>

      <span className="font-medium text-zinc-700 tracking-tight">{label}</span>

      {isCompleted ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
      ) : (
        <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
      )}
    </div>
  );
};
