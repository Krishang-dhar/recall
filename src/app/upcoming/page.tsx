'use client';

import React, { useState } from 'react';
import { useTasks } from '@/lib/TasksContext';
import { TaskRow } from '@/components/TaskRow';
import { TaskComposer } from '@/components/TaskComposer';
import { Task } from '@/lib/types';
import { Plus, Clock } from 'lucide-react';

export default function UpcomingPage() {
  const { tasks, isLoading, updateTask, deleteTask, snoozeTask } = useTasks();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Group pending upcoming tasks chronologically
  const now = new Date();
  const upcomingTasks = tasks
    .filter((t) => t.status === 'pending')
    .sort(
      (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
    );

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeekStart = new Date(now);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  const isToday = (d: Date) =>
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const isTomorrow = (d: Date) =>
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  // Buckets
  const tomorrowTasks = upcomingTasks.filter((t) => isTomorrow(new Date(t.due_at)));

  const thisWeekTasks = upcomingTasks.filter((t) => {
    const d = new Date(t.due_at);
    return !isToday(d) && !isTomorrow(d) && d > tomorrow && d < nextWeekStart;
  });

  const nextWeekTasks = upcomingTasks.filter((t) => {
    const d = new Date(t.due_at);
    return d >= nextWeekStart;
  });

  return (
    <div className="w-full flex flex-col gap-8 pb-24 md:pb-12 max-w-[760px] mx-auto apple-fade-in">
      {/* Header */}
      <section className="pt-2 sm:pt-4">
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
          Upcoming
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Chronological schedule of future reminders.
        </p>
      </section>

      {upcomingTasks.length === 0 ? (
        <div className="py-16 text-center space-y-1">
          <p className="text-sm font-medium text-zinc-700">Nothing scheduled yet.</p>
          <p className="text-xs text-zinc-400">Future reminders and events will appear here.</p>
        </div>
      ) : (
        <>
          {/* Tomorrow Section */}
          <section className="space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
          <span className="text-xs font-semibold tracking-tight text-zinc-900">
            Tomorrow
          </span>
          {tomorrowTasks.length > 0 && (
            <span className="text-[11px] font-mono font-medium text-zinc-400">
              {tomorrowTasks.length}
            </span>
          )}
        </div>

        {tomorrowTasks.length > 0 ? (
          <div className="divide-y divide-black/[0.03]">
            {tomorrowTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggleStatus={(id, s) => updateTask(id, { status: s })}
                onSnooze={(id, m) => snoozeTask(id, m)}
                onDelete={(id) => deleteTask(id)}
                onEdit={(t) => {
                  setEditingTask(t);
                  setIsComposerOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 py-2">No reminders tomorrow.</p>
        )}
      </section>

      {/* This Week Section */}
      <section className="space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
          <span className="text-xs font-semibold tracking-tight text-zinc-900">
            This week
          </span>
          {thisWeekTasks.length > 0 && (
            <span className="text-[11px] font-mono font-medium text-zinc-400">
              {thisWeekTasks.length}
            </span>
          )}
        </div>

        {thisWeekTasks.length > 0 ? (
          <div className="divide-y divide-black/[0.03]">
            {thisWeekTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggleStatus={(id, s) => updateTask(id, { status: s })}
                onSnooze={(id, m) => snoozeTask(id, m)}
                onDelete={(id) => deleteTask(id)}
                onEdit={(t) => {
                  setEditingTask(t);
                  setIsComposerOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 py-2">No reminders scheduled for this week.</p>
        )}
      </section>

      {/* Next Week & Later Section */}
      <section className="space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
          <span className="text-xs font-semibold tracking-tight text-zinc-900">
            Next week
          </span>
          {nextWeekTasks.length > 0 && (
            <span className="text-[11px] font-mono font-medium text-zinc-400">
              {nextWeekTasks.length}
            </span>
          )}
        </div>

        {nextWeekTasks.length > 0 ? (
          <div className="divide-y divide-black/[0.03]">
            {nextWeekTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggleStatus={(id, s) => updateTask(id, { status: s })}
                onSnooze={(id, m) => snoozeTask(id, m)}
                onDelete={(id) => deleteTask(id)}
                onEdit={(t) => {
                  setEditingTask(t);
                  setIsComposerOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 py-2">No tasks yet.</p>
        )}
      </section>
      </>
      )}

      <TaskComposer
        isOpen={isComposerOpen}
        initialTask={editingTask}
        onClose={() => {
          setIsComposerOpen(false);
          setEditingTask(null);
        }}
        onSave={async (d) => {
          if (d.id) {
            await updateTask(d.id, d);
          }
          setIsComposerOpen(false);
        }}
      />
    </div>
  );
}
