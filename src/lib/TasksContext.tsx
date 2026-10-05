'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Task, TaskPriority } from '@/lib/types';
import { getSessionMode } from '@/lib/user-session';

interface TasksContextType {
  tasks: Task[];
  isLoading: boolean;
  createTask: (data: {
    title: string;
    note?: string | null;
    due_at: string;
    end_time?: string | null;
    priority?: TaskPriority;
    location?: string | null;
    calendar_event_id?: string | null;
    whatsapp_reminder_id?: string | null;
    reminder_time?: string | null;
    is_meeting?: boolean;
    projectId?: string | null;
    project_name?: string | null;
  }) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  snoozeTask: (id: string, minutes: number) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load tasks according to session mode
  const refreshTasks = useCallback(async () => {
    const mode = getSessionMode();
    if (mode === 'guest') {
      try {
        const raw = localStorage.getItem('recall_guest_tasks');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setTasks(parsed);
            return;
          }
        }
        setTasks([]);
      } catch (err) {
        console.error('Failed to load guest tasks:', err);
        setTasks([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Owner or authenticated Google user mode
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Failed to load tasks from store:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTasks();

    const handleSessionChanged = () => {
      refreshTasks();
    };

    const handleTasksChanged = () => {
      refreshTasks();
    };

    window.addEventListener('recall-session-changed', handleSessionChanged);
    window.addEventListener('recall-tasks-changed', handleTasksChanged);

    // Poll only in non-guest mode
    const interval = setInterval(() => {
      if (getSessionMode() !== 'guest') {
        refreshTasks();
      }
    }, 15000);

    return () => {
      window.removeEventListener('recall-session-changed', handleSessionChanged);
      window.removeEventListener('recall-tasks-changed', handleTasksChanged);
      clearInterval(interval);
    };
  }, [refreshTasks]);

  const createTask = async (data: {
    title: string;
    note?: string | null;
    due_at: string;
    end_time?: string | null;
    priority?: TaskPriority;
    location?: string | null;
    calendar_event_id?: string | null;
    whatsapp_reminder_id?: string | null;
    reminder_time?: string | null;
    is_meeting?: boolean;
    projectId?: string | null;
    project_name?: string | null;
  }): Promise<Task> => {
    const mode = getSessionMode();

    if (mode === 'guest') {
      const newTask: Task = {
        id: `guest-task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: data.title,
        note: data.note || null,
        due_at: data.due_at,
        end_time: data.end_time || null,
        priority: data.priority || 'medium',
        status: 'pending',
        whatsapp_sent: false,
        location: data.location || null,
        calendar_event_id: data.calendar_event_id || null,
        whatsapp_reminder_id: data.whatsapp_reminder_id || null,
        reminder_time: data.reminder_time || null,
        is_meeting: data.is_meeting || false,
        projectId: data.projectId || null,
        project_name: data.project_name || null,
        created_at: new Date().toISOString(),
      };

      setTasks((prev) => {
        const next = [newTask, ...prev];
        try {
          localStorage.setItem('recall_guest_tasks', JSON.stringify(next));
        } catch {}
        return next;
      });
      return newTask;
    }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    const newTask = result.task;

    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const mode = getSessionMode();

    if (mode === 'guest') {
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
        try {
          localStorage.setItem('recall_guest_tasks', JSON.stringify(next));
        } catch {}
        return next;
      });
      return;
    }

    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
    } catch (err) {
      console.warn('Failed to patch local task:', err);
    }
  };

  const deleteTask = async (id: string) => {
    const mode = getSessionMode();

    if (mode === 'guest') {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        try {
          localStorage.setItem('recall_guest_tasks', JSON.stringify(next));
        } catch {}
        return next;
      });
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Failed to delete local task:', err);
    }
  };

  const snoozeTask = async (id: string, minutes: number) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;

    const currentDue = new Date(target.due_at);
    const baseTime = currentDue.getTime() < Date.now() ? Date.now() : currentDue.getTime();
    const newDue = new Date(baseTime + minutes * 60 * 1000).toISOString();

    await updateTask(id, { due_at: newDue, status: 'pending', whatsapp_sent: false });
  };

  return (
    <TasksContext.Provider
      value={{
        tasks,
        isLoading,
        createTask,
        updateTask,
        deleteTask,
        snoozeTask,
        refreshTasks,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error('useTasks must be used within TasksProvider');
  }
  return ctx;
};
