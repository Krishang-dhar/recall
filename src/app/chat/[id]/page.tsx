'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageSquare,
  Copy,
  Check,
  Trash2,
  Plus,
  Send,
  Loader2,
  Folder,
  Calendar,
  Clock,
  Sparkles,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { Conversation, Message } from '@/lib/types';
import { FormattedAIResponse } from '@/components/FormattedAIResponse';
import { useUserSession } from '@/lib/user-session';

function formatChatDate(dateString?: string) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) return `Today · ${timeStr}`;
    if (isYesterday) return `Yesterday · ${timeStr}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${timeStr}`;
  } catch {
    return '';
  }
}

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id as string;
  const { session } = useUserSession();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [promptText, setPromptText] = useState('');

  // Editable Title (Notion Style)
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isCopiedTranscript, setIsCopiedTranscript] = useState(false);

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversation & messages
  useEffect(() => {
    async function loadChat() {
      if (!conversationId) return;
      setIsLoading(true);

      // Handle Guest Mode
      if (session.isGuest) {
        try {
          const rawConvs = localStorage.getItem('recall_guest_conversations');
          const convs: Conversation[] = rawConvs ? JSON.parse(rawConvs) : [];
          const found = convs.find((c) => c.id === conversationId);
          if (found) {
            setConversation(found);
            setEditedTitle(found.title);
          }

          const rawMsgs = localStorage.getItem('recall_guest_messages');
          const allMsgs: Message[] = rawMsgs ? JSON.parse(rawMsgs) : [];
          const filtered = allMsgs.filter((m) => m.conversationId === conversationId);
          setMessages(filtered);
        } catch (e) {
          console.warn('Error loading guest conversation', e);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Handle Normal / File-Stored Mode
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        const data = await res.json();
        if (data.success) {
          setConversation(data.conversation);
          setEditedTitle(data.conversation.title);
          setMessages(data.messages || []);
        } else {
          console.warn('Conversation not found', data.error);
        }
      } catch (err) {
        console.error('Failed to load conversation', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadChat();
  }, [conversationId, session.isGuest]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, isSending]);

  // Save Title (Notion Style Inline Rename)
  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === conversation?.title) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    const newTitle = editedTitle.trim();

    if (session.isGuest) {
      try {
        const raw = localStorage.getItem('recall_guest_conversations');
        if (raw) {
          const parsed = JSON.parse(raw).map((c: Conversation) =>
            c.id === conversationId ? { ...c, title: newTitle } : c
          );
          localStorage.setItem('recall_guest_conversations', JSON.stringify(parsed));
        }
        setConversation((prev) => (prev ? { ...prev, title: newTitle } : null));
        window.dispatchEvent(new CustomEvent('recall-conversations-changed'));
      } catch {}
      setIsSavingTitle(false);
      setIsEditingTitle(false);
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json();
      if (data.success) {
        setConversation(data.conversation);
        window.dispatchEvent(new CustomEvent('recall-conversations-changed'));
      }
    } catch (err) {
      console.error('Failed to update title', err);
    } finally {
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  };

  // Delete Conversation
  const handleDeleteChat = async () => {
    if (!window.confirm('Delete this conversation permanently?')) return;

    if (session.isGuest) {
      try {
        const raw = localStorage.getItem('recall_guest_conversations');
        if (raw) {
          const parsed = JSON.parse(raw).filter((c: Conversation) => c.id !== conversationId);
          localStorage.setItem('recall_guest_conversations', JSON.stringify(parsed));
        }
        window.dispatchEvent(new CustomEvent('recall-conversations-changed'));
      } catch {}
      router.push('/');
      return;
    }

    try {
      await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('recall-conversations-changed'));
      router.push('/');
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  // Copy Full Transcript
  const handleCopyTranscript = () => {
    const text = messages
      .map((m) => `${m.role === 'user' ? 'You' : 'Recall'}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setIsCopiedTranscript(true);
    setTimeout(() => setIsCopiedTranscript(false), 2000);
  };

  // Send Message in this conversation
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = promptText.trim();
    if (!textToSend || isSending) return;

    setPromptText('');
    setIsSending(true);

    const tempUserMsg: Message = {
      id: `msg-${Date.now()}-u`,
      conversationId,
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    const historyForAI = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          conversationId,
          history: historyForAI,
          projectId: conversation?.projectId,
          userTimeZone: 'Asia/Kolkata',
        }),
      });

      const data = await res.json();
      if (data.reply) {
        // Fast streaming effect
        let currentLen = 0;
        const fullReply = data.reply;
        const interval = setInterval(() => {
          currentLen += Math.max(3, Math.floor(fullReply.length / 25));
          if (currentLen >= fullReply.length) {
            setStreamingText('');
            clearInterval(interval);
            const tempAsstMsg: Message = {
              id: `msg-${Date.now()}-a`,
              conversationId,
              role: 'assistant',
              content: fullReply,
              planData: data.generativeUI?.planSlots,
              actionExecuted: data.actionExecuted,
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, tempAsstMsg]);
          } else {
            setStreamingText(fullReply.slice(0, currentLen));
          }
        }, 16);
      }

      window.dispatchEvent(new CustomEvent('recall-conversations-changed'));
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setIsSending(false);
    }
  };

  const formattedDate = formatChatDate(conversation?.createdAt);

  return (
    <div className="w-full flex flex-col h-[calc(100vh-72px)] max-w-[920px] mx-auto overflow-hidden apple-fade-in px-2 sm:px-4">
      {/* ── 1. COMPACT NOTION-STYLE HEADER (PINNED TOP) ────────────────────── */}
      <section className="shrink-0 pt-1 pb-3 border-b border-black/[0.06] dark:border-white/[0.08] space-y-2">
        {/* Top Breadcrumb & Action Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
              title="Start a new chat"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New chat</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTranscript}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
              title="Copy entire chat transcript"
            >
              {isCopiedTranscript ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDeleteChat}
              className="p-1.5 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              title="Delete conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Editable Title + Date & Vault Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center text-white shadow-2xs shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/recall-logo.png" alt="Recall" className="w-4 h-4 object-contain" />
            </div>

            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') {
                        setEditedTitle(conversation?.title || '');
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    placeholder="Enter chat title…"
                    className="w-full text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-xl outline-hidden ring-2 ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    disabled={isSavingTitle}
                    className="px-2.5 py-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <h1
                    onClick={() => setIsEditingTitle(true)}
                    className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white truncate cursor-pointer hover:opacity-80 transition-opacity"
                    title="Click to rename"
                  >
                    {conversation?.title || 'Recall Chat'}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity cursor-pointer"
                    title="Rename chat"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Date Alignment & Storage Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {formattedDate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium text-[11px] border border-blue-200/50 dark:border-blue-800/40">
                <Calendar className="w-3 h-3" />
                <span>{formattedDate}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono text-[11px] border border-black/[0.04] dark:border-white/[0.06]">
              <Folder className="w-3 h-3 text-blue-500" />
              <span>Desktop/Recall_Vault/chats</span>
            </span>

            <span className="text-[11px] text-zinc-400">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. SCROLLABLE MESSAGES CONTAINER (MIDDLE) ──────────────────────── */}
      <section className="flex-1 overflow-y-auto px-1 sm:px-3 py-4 space-y-4 scrollbar-thin">
        {/* Date Divider Header */}
        <div className="flex items-center justify-center py-1">
          <span className="px-3 py-1 rounded-full bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 text-[11px] font-semibold border border-black/[0.04] dark:border-white/[0.06] shadow-2xs">
            {formattedDate || 'Active Session'}
          </span>
        </div>

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs font-medium">Loading conversation from desktop vault…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
              <MessageSquare className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                Fresh conversation
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Ask Recall to plan your day, draft a note, or organize tasks.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id || idx} className="space-y-1">
              {msg.role === 'user' ? (
                /* User Bubble (Right-aligned, clean dark pill) */
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-zinc-900 text-white dark:bg-[#ececec] dark:text-[#171717] px-4 py-2.5 text-xs sm:text-sm font-medium shadow-2xs leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                /* Assistant Block (Left-aligned, Recall icon, formatted markdown) */
                <div className="flex flex-col gap-1.5 w-full bg-white/90 dark:bg-zinc-900/90 border border-black/[0.05] dark:border-white/[0.06] rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-black/[0.03] dark:border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/recall-logo.png" alt="Recall" className="w-3 h-3 object-contain" />
                      </div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                        Recall Assistant
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopiedMessageId(msg.id);
                        setTimeout(() => setCopiedMessageId(null), 1800);
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                      title="Copy response"
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed pt-1">
                    <FormattedAIResponse content={msg.content} />
                  </div>

                  {/* If action was executed */}
                  {msg.actionExecuted && (
                    <div className="mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{msg.actionExecuted}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Live Streaming Assistant Message */}
        {streamingText && (
          <div className="flex flex-col gap-1.5 w-full bg-white/90 dark:bg-zinc-900/90 border border-black/[0.05] dark:border-white/[0.06] rounded-2xl p-4 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2 pb-1.5 border-b border-black/[0.03] dark:border-white/[0.04]">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/recall-logo.png" alt="Recall" className="w-3 h-3 object-contain" />
              </div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                Recall Assistant
              </span>
            </div>
            <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed pt-1">
              <FormattedAIResponse content={streamingText} isStreaming={true} />
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {isSending && !streamingText && (
          <div className="flex items-center gap-2 text-xs text-zinc-400 py-2 px-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            <span>Recall is planning & executing…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </section>

      {/* ── 3. BIGGER & PROMINENT CHATGPT-STYLE COMPOSER (PINNED BOTTOM) ───── */}
      <footer className="shrink-0 pt-1 pb-3 sm:pb-4 bg-gradient-to-t from-[#F8F9FD] dark:from-[#212121] via-[#F8F9FD]/95 dark:via-[#212121]/95 to-transparent z-20">
        <form
          onSubmit={handleSendMessage}
          className="bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.1] rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col gap-2 transition-all focus-within:ring-2 focus-within:ring-[#0052FF]/20 focus-within:border-[#0052FF]/50"
        >
          {/* Spacious Comfortable Multi-Line Textarea */}
          <textarea
            ref={textareaRef}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask Recall anything, plan your schedule, or refine your thoughts… (Enter to send, Shift+Enter for new line)"
            disabled={isSending}
            rows={2}
            className="w-full bg-transparent border-0 outline-hidden resize-none text-sm sm:text-base text-zinc-900 dark:text-[#ececec] placeholder:text-zinc-400 p-1 min-h-[44px] max-h-[140px] leading-relaxed"
          />

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
            {/* Left: Quick Actions */}
            <div className="flex items-center gap-1.5">
              {['Plan my day', 'Review priorities', 'Draft summary'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setPromptText(chip);
                    if (textareaRef.current) textareaRef.current.focus();
                  }}
                  className="px-2.5 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] text-[11px] font-medium text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Right: Big Crisp Send Button */}
            <button
              type="submit"
              disabled={!promptText.trim() || isSending}
              className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-black dark:bg-[#ececec] dark:hover:bg-white text-white dark:text-[#171717] flex items-center justify-center gap-1.5 font-semibold text-xs transition-all disabled:opacity-25 disabled:pointer-events-none cursor-pointer shrink-0 active:scale-95 shadow-2xs"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
