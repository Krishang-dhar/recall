'use client';

import React, { useState } from 'react';
import { Clock, Check, Plus, Trash2, Calendar } from 'lucide-react';
import { useTasks } from '@/lib/TasksContext';

export interface PlanSlot {
  id?: string;
  timeSlot: string;
  title: string;
  suggestedDueAt?: string;
  category?: string;
  note?: string;
}

interface DayPlanWorkspaceProps {
  replyText: string;
  slots: PlanSlot[];
  onDismiss?: () => void;
}

export const DayPlanWorkspace: React.FC<DayPlanWorkspaceProps> = ({
  replyText,
  slots: initialSlots,
  onDismiss,
}) => {
  const { createTask } = useTasks();
  const [slots, setSlots] = useState<PlanSlot[]>(initialSlots);
  const [applied, setApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleUpdateSlot = (index: number, field: keyof PlanSlot, value: string) => {
    setSlots((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSlot = () => {
    setSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}`,
        timeSlot: '17:00',
        title: 'New focus block',
        category: 'task',
      },
    ]);
  };

  const handleApplyToToday = async () => {
    setIsApplying(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      for (const slot of slots) {
        // Parse time like "10:00 AM" or "15:00"
        let [hours, minutes] = [12, 0];
        const match = slot.timeSlot.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
        if (match) {
          hours = parseInt(match[1], 10);
          minutes = match[2] ? parseInt(match[2], 10) : 0;
          const ampm = match[3]?.toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }

        const dueAt = new Date();
        dueAt.setHours(hours, minutes, 0, 0);

        await createTask({
          title: slot.title,
          due_at: dueAt.toISOString(),
          note: slot.note || `Scheduled via Recall Day Planner (${slot.timeSlot})`,
          priority: 'medium',
        });
      }

      setApplied(true);
    } catch (err) {
      console.error('Error applying day plan', err);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="w-full rounded-[24px] bg-white border border-black/[0.08] shadow-[0_8px_30px_rgba(0,82,255,0.06)] overflow-hidden apple-slide-down">
      {/* 2-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black/[0.06]">
        {/* Left Column: Conversational Context */}
        <div className="md:col-span-5 p-5 flex flex-col justify-between bg-zinc-50/40">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
              <Calendar className="w-3.5 h-3.5" />
              <span>Recall Daily Schedule</span>
            </div>
            <div className="text-xs sm:text-[13px] text-zinc-800 leading-relaxed whitespace-pre-wrap">
              {replyText}
            </div>
          </div>

          <div className="pt-4 text-[11px] text-zinc-400">
            Review the schedule on the right. You can adjust times before applying them directly to your Today tasks.
          </div>
        </div>

        {/* Right Column: Interactive Editable Timetable */}
        <div className="md:col-span-7 p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
              <span className="text-xs font-bold text-zinc-900 tracking-tight uppercase">
                Today
              </span>
              <button
                type="button"
                onClick={handleAddSlot}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add slot</span>
              </button>
            </div>

            {/* Slot Rows */}
            <div className="space-y-2 pt-3 max-h-[320px] overflow-y-auto pr-1">
              {slots.map((slot, idx) => (
                <div
                  key={slot.id || idx}
                  className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border border-black/[0.04] group hover:border-black/10 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    value={slot.timeSlot}
                    onChange={(e) => handleUpdateSlot(idx, 'timeSlot', e.target.value)}
                    className="w-20 px-2 py-1 text-xs font-medium rounded-lg bg-white border border-black/[0.06] text-zinc-800 outline-none"
                    placeholder="10:00 AM"
                  />
                  <input
                    type="text"
                    value={slot.title}
                    onChange={(e) => handleUpdateSlot(idx, 'title', e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-black/[0.06] text-zinc-900 outline-none"
                    placeholder="Focus block title"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(idx)}
                    className="p-1 text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                Dismiss
              </button>
            )}

            <button
              type="button"
              disabled={applied || isApplying || slots.length === 0}
              onClick={handleApplyToToday}
              className={`ml-auto px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all ${
                applied
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-zinc-900 hover:bg-black text-white active:scale-95 cursor-pointer'
              }`}
            >
              {applied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Applied to Today</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isApplying ? 'Applying…' : 'Apply to Today'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
