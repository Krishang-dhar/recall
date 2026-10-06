'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageSquare,
  FileText,
  CheckSquare,
  Send,
  Plus,
  Clock,
  Bot,
  Download,
  Check,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Project, Task, Conversation, Attachment } from '@/lib/types';
import { GlassPanel } from '@/components/GlassPanel';
import { VoiceOrb } from '@/components/VoiceOrb';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inline project prompt
  const [projectPrompt, setProjectPrompt] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  // New task inline
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();
        if (data.success) {
          setProject(data.project);
          setTasks(data.tasks || []);
          setConversations(data.conversations || []);
          setAttachments(data.attachments || []);
        }
      } catch (err) {
        console.error('Failed to load project details', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  const handleAskProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectPrompt.trim() || isAsking) return;

    setIsAsking(true);
    setAiAnswer(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: projectPrompt.trim(),
          projectId,
          userTimeZone: 'Asia/Kolkata',
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setAiAnswer(data.reply);
      }
    } catch (err) {
      console.error(err);
      setAiAnswer('Sorry, I encountered an issue retrieving project context.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          projectId,
          project_name: project?.name,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
        setNewTaskTitle('');
        setIsAddingTask(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: nextStatus }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading && !project) {
    return null;
  }

  if (!project) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-sm text-zinc-500">Project not found</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return home</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-24 max-w-[840px] mx-auto apple-fade-in">
      {/* Back button + Project Header */}
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span
                style={{ backgroundColor: project.color || '#0052FF' }}
                className="w-3 h-3 rounded-full shrink-0"
              />
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
                {project.name}
              </h1>
            </div>
            {project.description && (
              <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                {project.description}
              </p>
            )}
          </div>

          <div className="text-[11px] font-medium text-zinc-400 bg-black/[0.03] px-3 py-1.5 rounded-full w-fit">
            {conversations.length} conversations · {attachments.length} files · {tasks.length} tasks
          </div>
        </div>
      </div>

      {/* Project-Scoped AI Composer */}
      <div className="rounded-[22px] bg-white border border-black/[0.08] shadow-[0_4px_24px_rgba(0,82,255,0.06)] p-3">
        <form onSubmit={handleAskProject} className="flex items-center gap-3">
          <VoiceOrb state={isAsking ? 'processing' : 'idle'} size="sm" />
          <input
            type="text"
            value={projectPrompt}
            onChange={(e) => setProjectPrompt(e.target.value)}
            placeholder={`Ask Recall about ${project.name}… e.g. "What is still pending?" or "Find that LMS PDF"`}
            style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
            className="flex-1 bg-transparent text-xs sm:text-sm !text-zinc-900 placeholder:!text-zinc-400 outline-none"
          />
          <button
            type="submit"
            disabled={!projectPrompt.trim() || isAsking}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              projectPrompt.trim() && !isAsking
                ? 'bg-zinc-900 text-white cursor-pointer active:scale-95'
                : 'text-zinc-300 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {aiAnswer && (
          <div className="mt-3 pt-3 border-t border-black/[0.04] text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap apple-slide-down">
            <div className="flex items-center gap-1.5 text-blue-600 font-semibold mb-1">
              <Bot className="w-3 h-3" />
              <span>Recall:</span>
            </div>
            {aiAnswer}
          </div>
        )}
      </div>

      {/* 3-Section Grid: Tasks, Files, Recent Conversations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tasks Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Tasks ({tasks.length})
            </span>
            <button
              onClick={() => setIsAddingTask(!isAddingTask)}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>

          {isAddingTask && (
            <form onSubmit={handleCreateTask} className="pb-1">
              <input
                type="text"
                autoFocus
                placeholder="Task title…"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-white border border-blue-400 !text-zinc-900 outline-none shadow-xs"
              />
            </form>
          )}

          <div className="space-y-1.5">
            {tasks.length > 0 ? (
              tasks.map((task) => {
                const isDone = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id, task.status)}
                    className="p-3 rounded-2xl bg-white border border-black/[0.04] shadow-2xs hover:shadow-xs transition-all flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 group-hover:border-zinc-500'
                      }`}
                    >
                      {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-medium tracking-tight ${
                          isDone ? 'line-through text-zinc-400' : 'text-zinc-800'
                        }`}
                      >
                        {task.title}
                      </div>
                      {task.due_at && (
                        <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(task.due_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50/50 border border-black/[0.02] text-center text-xs text-zinc-400">
                No tasks yet.
              </div>
            )}
          </div>
        </div>

        {/* Files Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Files ({attachments.length})
            </span>
          </div>

          <div className="space-y-1.5">
            {attachments.length > 0 ? (
              attachments.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-2xl bg-white border border-black/[0.04] shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-2.5 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-800 truncate">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 uppercase">
                        {file.type.split('/')[1] || 'FILE'}
                      </div>
                    </div>
                  </div>
                  <Download className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 shrink-0" />
                </a>
              ))
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50/50 border border-black/[0.02] text-center text-xs text-zinc-400">
                No files attached.
              </div>
            )}
          </div>
        </div>

        {/* Conversations Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Recent Chats ({conversations.length})
            </span>
          </div>

          <div className="space-y-1.5">
            {conversations.length > 0 ? (
              conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="p-3 rounded-2xl bg-white border border-black/[0.04] shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-2 group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-800 truncate">
                      {c.title}
                    </div>
                    {c.lastMessage && (
                      <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                        {c.lastMessage}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-600 shrink-0" />
                </Link>
              ))
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50/50 border border-black/[0.02] text-center text-xs text-zinc-400">
                No chats linked.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
