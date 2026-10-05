'use client';

import React from 'react';
import { useTasks } from '@/lib/TasksContext';
import { TaskRow } from '@/components/TaskRow';
import { Check } from 'lucide-react';

export default function CompletedPage() {
  const { tasks, isLoading, updateTask, deleteTask, snoozeTask } = useTasks();

  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayCompleted = completedTasks.filter((t) => new Date(t.due_at || t.created_at) >= today);
  const yesterdayCompleted = completedTasks.filter((t) => {
    const d = new Date(t.due_at || t.created_at);
    return d >= yesterday && d < today;
  });
  const earlierCompleted = completedTasks.filter(
    (t) => new Date(t.due_at || t.created_at) < yesterday
  );

  return (
    <div className="w-full flex flex-col gap-8 pb-24 md:pb-12 max-w-[760px] mx-auto apple-fade-in">
      {/* Header */}
      <section className="pt-2 sm:pt-4">
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
          Completed
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          History of resolved reminders.
        </p>
      </section>

      {completedTasks.length === 0 ? (
        <div className="py-16 text-center space-y-1">
          <p className="text-sm font-medium text-zinc-700">Nothing completed yet.</p>
          <p className="text-xs text-zinc-400">Completed items will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today Completed */}
          {todayCompleted.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
                <span className="text-xs font-semibold tracking-tight text-zinc-900">
                  Today
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {todayCompleted.length}
                </span>
              </div>
              <div className="divide-y divide-black/[0.03]">
                {todayCompleted.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleStatus={(id, s) => updateTask(id, { status: s })}
                    onSnooze={(id, m) => snoozeTask(id, m)}
                    onDelete={(id) => deleteTask(id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Yesterday Completed */}
          {yesterdayCompleted.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
                <span className="text-xs font-semibold tracking-tight text-zinc-900">
                  Yesterday
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {yesterdayCompleted.length}
                </span>
              </div>
              <div className="divide-y divide-black/[0.03]">
                {yesterdayCompleted.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleStatus={(id, s) => updateTask(id, { status: s })}
                    onSnooze={(id, m) => snoozeTask(id, m)}
                    onDelete={(id) => deleteTask(id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Earlier Completed */}
          {earlierCompleted.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.06]">
                <span className="text-xs font-semibold tracking-tight text-zinc-900">
                  Earlier
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {earlierCompleted.length}
                </span>
              </div>
              <div className="divide-y divide-black/[0.03]">
                {earlierCompleted.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleStatus={(id, s) => updateTask(id, { status: s })}
                    onSnooze={(id, m) => snoozeTask(id, m)}
                    onDelete={(id) => deleteTask(id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
