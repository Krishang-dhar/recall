'use client';

import React, { useState } from 'react';
import { Task } from '@/lib/types';
import { Check, Clock, Trash2, Edit3, MessageCircle, MoreHorizontal } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TaskRowProps {
  task: Task;
  onToggleStatus: (id: string, newStatus: 'pending' | 'completed') => void;
  onSnooze: (id: string, minutes: number) => void;
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggleStatus,
  onSnooze,
  onDelete,
  onEdit,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [isAnimatingComplete, setIsAnimatingComplete] = useState(false);

  const isCompleted = task.status === 'completed';

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCompleted) {
      setIsAnimatingComplete(true);
      try {
        confetti({
          particleCount: 24,
          spread: 40,
          origin: { y: 0.8 },
          colors: ['#6366f1', '#8b5cf6', '#3b82f6'],
          disableForReducedMotion: true,
        });
      } catch (err) {}
      setTimeout(() => {
        onToggleStatus(task.id, 'completed');
        setIsAnimatingComplete(false);
      }, 250);
    } else {
      onToggleStatus(task.id, 'pending');
    }
  };

  // Format time
  const dueDate = new Date(task.due_at);
  const timeFormatted = dueDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className={`group rounded-xl cursor-pointer select-none transition-all duration-200 task-created-highlight ${
        isExpanded
          ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-black/[0.05]'
          : 'hover:bg-black/[0.02] hover:-translate-y-[0.5px]'
      } ${isAnimatingComplete ? 'opacity-40 scale-[0.98]' : 'opacity-100'}`}
    >
      <div className="flex items-center justify-between py-3 px-3 gap-3">
        {/* Left: Minimal circle checkbox + title + optional project */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleCheck}
            aria-label={isCompleted ? 'Mark pending' : 'Mark complete'}
            className={`flex-shrink-0 w-4 h-4 rounded-full border transition-all duration-200 flex items-center justify-center cursor-pointer ${
              isCompleted || isAnimatingComplete
                ? 'bg-zinc-900 border-zinc-900 text-white scale-95'
                : 'border-zinc-300 hover:border-zinc-500 bg-white hover:scale-105 active:scale-90'
            }`}
          >
            {(isCompleted || isAnimatingComplete) && (
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            )}
          </button>

          <div className="flex flex-col min-w-0">
            <span
              className={`text-[14px] tracking-tight block truncate transition-all ${
                isCompleted || isAnimatingComplete
                  ? 'line-through text-zinc-400 font-normal'
                  : 'text-zinc-800 font-medium'
              }`}
            >
              {task.title}
            </span>
            {task.project_name && (
              <span className="text-[10px] text-blue-600 font-medium tracking-tight">
                {task.project_name}
              </span>
            )}
          </div>
        </div>

        {/* Right: Time badge + subtle more actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.whatsapp_sent && (
            <span
              title="WhatsApp reminder delivered"
              className="text-emerald-600 flex items-center p-0.5 rounded-full bg-emerald-50"
            >
              <MessageCircle className="w-3 h-3 stroke-[2]" />
            </span>
          )}

          <span className="text-xs text-zinc-400 font-normal font-mono">
            {timeFormatted}
          </span>

          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-700 hover:bg-black/[0.04] transition-all cursor-pointer"
            title="Options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Expanded Details & Actions */}
      {isExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="px-3 pb-3 pt-1 border-t border-black/[0.03] flex flex-col gap-2 apple-fade-in"
        >
          {task.note && (
            <p className="text-[12.5px] text-zinc-600 font-normal leading-relaxed pl-7">
              {task.note}
            </p>
          )}

          <div className="flex items-center justify-between pl-7 pt-1">
            <div className="flex items-center gap-2">
              {/* Snooze Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-zinc-700 flex items-center gap-1 transition-all font-medium cursor-pointer"
                >
                  <Clock className="w-3 h-3 text-zinc-500" />
                  Snooze
                </button>

                {showSnoozeMenu && (
                  <div className="absolute left-0 mt-1 z-20 w-32 rounded-xl bg-white shadow-xl border border-black/[0.06] py-1 text-xs text-zinc-700 apple-fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        onSnooze(task.id, 30);
                        setShowSnoozeMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 cursor-pointer"
                    >
                      30 minutes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSnooze(task.id, 60);
                        setShowSnoozeMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 cursor-pointer"
                    >
                      1 hour
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSnooze(task.id, 24 * 60);
                        setShowSnoozeMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 cursor-pointer"
                    >
                      Tomorrow
                    </button>
                  </div>
                )}
              </div>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="px-2.5 py-1 text-[11px] rounded-lg hover:bg-black/[0.04] text-zinc-700 flex items-center gap-1 transition-all font-medium cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 text-zinc-500" />
                  Edit
                </button>
              )}
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="p-1 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
