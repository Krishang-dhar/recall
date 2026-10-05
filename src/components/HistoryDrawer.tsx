'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  Plus,
  Search,
  MessageSquare,
  Folder,
  SlidersHorizontal,
  User,
  Trash2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Conversation, Project } from '@/lib/types';
import { Portal } from './Portal';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeConversationId?: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  activeConversationId,
  onSelectConversation,
  onNewChat,
}) => {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const loadData = async () => {
    try {
      const [convsRes, projsRes] = await Promise.all([
        fetch('/api/conversations'),
        fetch('/api/projects'),
      ]);
      const convsData = await convsRes.json();
      const projsData = await projsRes.json();
      if (convsData.success) setConversations(convsData.conversations || []);
      if (projsData.success) setProjects(projsData.projects || []);
    } catch (err) {
      console.warn('Could not load workspace launcher data', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        setProjects((prev) => [...prev, data.project]);
        setNewProjectName('');
        setIsCreatingProject(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const filteredConvs = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Portal>
      {/* Soft Calm Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[75] bg-black/20 backdrop-blur-[2px] transition-opacity duration-200"
      />

      {/* COMPACT FLOATING WORKSPACE LAUNCHER (Raycast / Spotlight style, 380-420px, 75vh max) */}
      <div className="fixed inset-x-3 top-16 sm:inset-auto sm:top-16 sm:left-8 z-[80] w-auto sm:w-[400px] max-h-[75vh] bg-[rgba(255,255,255,0.88)] backdrop-blur-[24px] rounded-[24px] border border-black/[0.08] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.16)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="p-4 border-b border-black/[0.05] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative w-6 h-6 rounded-full shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/recall-logo.png"
                  alt="Recall"
                  className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,82,255,0.25)]"
                />
              </div>
              <span className="font-semibold text-sm tracking-tight text-zinc-900">
                Recall
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-black text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New chat</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Recall..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/[0.03] focus:bg-white rounded-xl border border-black/[0.04] focus:border-[#0052FF]/40 text-zinc-900 placeholder:text-zinc-400 outline-none transition-all font-normal"
            />
          </div>
        </div>

        {/* Scrollable Center: RECENT & PROJECTS */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* RECENT CHATS */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Recent
            </div>

            {filteredConvs.length === 0 ? (
              <div className="px-3 py-3 text-xs text-zinc-400 text-center font-normal">
                No conversations yet. Start talking to Recall.
              </div>
            ) : (
              filteredConvs.slice(0, 6).map((c) => {
                const isSelected = activeConversationId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectConversation(c.id);
                      onClose();
                    }}
                    className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 text-zinc-900 font-medium'
                        : 'hover:bg-zinc-100/70 text-zinc-700 hover:text-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-xs truncate">{c.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition-opacity rounded"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* PROJECTS (Compact, Secondary) */}
          <div className="space-y-1 pt-2 border-t border-black/[0.04]">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Projects
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                + New
              </button>
            </div>

            {isCreatingProject && (
              <form onSubmit={handleCreateProject} className="px-2 py-1">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name..."
                  autoFocus
                  className="w-full px-2.5 py-1 text-xs bg-zinc-50 rounded-lg border border-black/[0.08] text-zinc-900 outline-none"
                />
              </form>
            )}

            {projects.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-400 text-center font-normal">
                No projects yet.
              </div>
            ) : (
              projects.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  onClick={onClose}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-zinc-100/70 text-zinc-700 hover:text-zinc-900 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-300" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Bottom Actions: Settings & Account */}
        <div className="p-3 border-t border-black/[0.04] bg-zinc-50/50 flex items-center justify-between text-xs text-zinc-600">
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            <span>Settings</span>
          </Link>

          <Link
            href="/account"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span>Account</span>
          </Link>
        </div>
      </div>
    </Portal>
  );
};
