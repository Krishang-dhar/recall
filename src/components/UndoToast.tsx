'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, RotateCcw } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';

interface UndoToastProps {
  tool: PluginId | 'tasks';
  label: string;         // e.g. "Deleted 3 events"
  actionId?: string;
  undoable: boolean;
  durationMs?: number;   // default 8000
  onUndo?: (actionId?: string) => void;
  onExpire?: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  tool,
  label,
  actionId,
  undoable,
  durationMs = 8000,
  onUndo,
  onExpire,
}) => {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const interval = 50;
    const steps = durationMs / interval;
    const decrement = 100 / steps;
    let current = 100;

    const timer = setInterval(() => {
      current -= decrement;
      setProgress(Math.max(0, current));
      if (current <= 0) {
        clearInterval(timer);
        handleExpire();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [durationMs]);

  const handleExpire = () => {
    setIsExiting(true);
    setTimeout(() => onExpire?.(), 300);
  };

  const handleUndo = () => {
    setIsExiting(true);
    setTimeout(() => onUndo?.(actionId), 100);
  };

  const iconId = tool === 'tasks' ? 'recall' : tool as PluginId;

  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
      style={{ minWidth: 260, maxWidth: 360 }}
    >
      <div className="bg-zinc-900 text-white rounded-2xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.45)] overflow-hidden">
        {/* Progress bar */}
        <div
          className="h-[2px] bg-white/20 transition-none"
          style={{ width: `${progress}%`, transition: 'width 50ms linear' }}
        />

        <div className="flex items-center gap-3 px-4 py-3">
          {/* Icon */}
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            {iconId === 'recall' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <PluginIcon id={iconId} size={18} />
            )}
          </div>

          {/* Label */}
          <span className="text-[13px] font-medium flex-1 leading-tight">{label}</span>

          {/* Undo button */}
          {undoable && (
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
