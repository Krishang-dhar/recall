'use client';

import React, { useState, useEffect } from 'react';
import { Check, Undo2, ExternalLink } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';

export interface ActionItemDetail {
  id?: string;
  title: string;
  time?: string;
  note?: string;
}

export interface RecommendationChip {
  id: string;
  iconType: PluginId | 'recall';
  label: string;
  prompt: string;
}

interface ActionResultCardProps {
  channel: 'calendar' | 'whatsapp' | 'gmail' | 'tasks' | 'drive';
  headline: string;
  subheadline?: string;
  items?: ActionItemDetail[];
  externalLink?: string;
  externalLinkLabel?: string;
  onUndo?: () => void;
  recommendations?: RecommendationChip[];
  onSelectRecommendation?: (prompt: string) => void;
}

export const ActionResultCard: React.FC<ActionResultCardProps> = ({
  channel,
  headline,
  subheadline,
  items = [],
  externalLink,
  externalLinkLabel = 'Open',
  onUndo,
  recommendations = [],
  onSelectRecommendation,
}) => {
  const [animStage, setAnimStage] = useState<'working' | 'pulse' | 'completed'>('working');

  useEffect(() => {
    // 500-800ms smooth success transition: pulse -> glowing ring -> check appears
    const t1 = setTimeout(() => setAnimStage('pulse'), 250);
    const t2 = setTimeout(() => setAnimStage('completed'), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const getChannelIconId = (): PluginId => {
    switch (channel) {
      case 'calendar':
        return 'calendar';
      case 'whatsapp':
        return 'whatsapp';
      case 'gmail':
        return 'gmail';
      case 'drive':
        return 'drive';
      default:
        return 'calendar';
    }
  };

  const channelIcon = getChannelIconId();

  return (
    <div className="w-full rounded-2xl bg-white border border-black/[0.06] p-4 sm:p-5 shadow-[0_8px_30px_rgba(20,30,60,0.06)] flex flex-col gap-4 apple-slide-down">
      {/* Top Header: Branded Icon with Animated Glow Ring + Headline */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="relative w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-black/[0.05] shadow-xs">
            {/* Glowing ring that animates on success */}
            <span
              className={`absolute inset-[-3px] rounded-2xl transition-all duration-500 pointer-events-none ${
                animStage === 'completed'
                  ? 'border-2 border-emerald-400 opacity-90 scale-100'
                  : animStage === 'pulse'
                  ? 'border-2 border-blue-400 opacity-70 scale-105 animate-pulse'
                  : 'border border-black/[0.05] opacity-20'
              }`}
            />

            {channel === 'tasks' ? (
              <div className="relative w-6 h-6 rounded-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/recall-logo.png"
                  alt="Recall"
                  className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,82,255,0.3)]"
                />
              </div>
            ) : (
              <PluginIcon id={channelIcon} size={22} />
            )}

            {/* Success checkmark badge */}
            {animStage === 'completed' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs animate-in zoom-in-75 duration-200">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 flex items-center gap-1.5">
              <span>{headline}</span>
            </h3>
            {subheadline && (
              <p className="text-xs text-zinc-400 mt-0.5 font-normal">{subheadline}</p>
            )}
          </div>
        </div>

        {/* Action button (Open Calendar / Link) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {externalLink && (
            <a
              href={externalLink}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold flex items-center gap-1 transition-all shadow-2xs active:scale-95"
            >
              <span>{externalLinkLabel}</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          )}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Undo this action"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
        </div>
      </div>

      {/* List of created events / items in normal, elegant typography (NO monospace boxes) */}
      {items.length > 0 && (
        <div className="rounded-xl bg-zinc-50/70 border border-black/[0.04] p-3 divide-y divide-black/[0.04] space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className={`flex items-start justify-between gap-3 ${idx > 0 ? 'pt-2' : ''}`}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-900 leading-tight">
                  {item.title}
                </div>
                {item.note && (
                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">{item.note}</div>
                )}
              </div>
              {item.time && (
                <div className="text-xs font-medium text-zinc-700 shrink-0">
                  {item.time}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suggested Next Steps (1-3 small action chips) */}
      {recommendations.length > 0 && (
        <div className="pt-2 border-t border-black/[0.04] space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Suggested next steps
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendations.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => onSelectRecommendation && onSelectRecommendation(rec.prompt)}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-blue-50 hover:border-blue-200 text-zinc-800 hover:text-blue-900 text-xs font-medium flex items-center gap-2 border border-black/[0.04] transition-all cursor-pointer shadow-2xs active:scale-95 group"
              >
                {rec.iconType === 'recall' ? (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/recall-logo.png"
                      alt="Recall"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <PluginIcon id={rec.iconType} size={15} />
                )}
                <span>{rec.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
