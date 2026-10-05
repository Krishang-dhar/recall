'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Plus } from 'lucide-react';
import { useTasks } from '@/lib/TasksContext';
import { VoiceOrb } from './VoiceOrb';

interface RecallChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionExecuted?: string;
}

export const RecallChatModal: React.FC<RecallChatModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { tasks, createTask, updateTask, snoozeTask } = useTasks();
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi, I'm Recall Intelligence. Ask me what you have today, reschedule tasks, or tell me anything to remember.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  if (!isOpen) return null;

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isSending) return;

    const userMsg: MessageItem = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText.trim(),
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          tasksContext: tasks,
          userTimeZone: 'Asia/Kolkata',
        }),
      });

      const data = await res.json();
      let actionExecuted = undefined;

      // Execute tool actions requested by assistant
      if (data.action) {
        if (data.action.type === 'create_reminder' && data.action.data) {
          await createTask({
            title: data.action.data.title || 'New reminder',
            due_at: data.action.data.due_at || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            note: data.action.data.note,
          });
          actionExecuted = 'Reminder created ✓';
        } else if (data.action.type === 'complete_reminder' && data.action.data?.id) {
          await updateTask(data.action.data.id, { status: 'completed' });
          actionExecuted = 'Marked completed ✓';
        } else if (data.action.type === 'update_reminder' && data.action.data?.id) {
          await updateTask(data.action.data.id, {
            due_at: data.action.data.due_at,
            title: data.action.data.title,
          });
          actionExecuted = 'Schedule updated ✓';
        }
      }

      const aiMsg: MessageItem = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || "I've checked that for you.",
        actionExecuted,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Sorry, I had trouble processing that. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const suggestions = [
    "What do I have today?",
    "Move Prem Sweets call to 4 PM",
    "Remind me tonight to send Sia the LMS doc",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/30 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl h-[85vh] max-h-[640px] rounded-[28px] bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.05] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/recall-logo.png" alt="Recall" className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,82,255,0.25)]" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-zinc-900">
              Recall Assistant
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed tracking-tight ${
                  m.role === 'user'
                    ? 'bg-zinc-900 text-white rounded-br-sm'
                    : 'bg-black/[0.035] text-zinc-850 border border-black/[0.04] rounded-bl-sm whitespace-pre-wrap'
                }`}
              >
                {m.content}
              </div>

              {m.actionExecuted && (
                <span className="text-[11px] text-emerald-600 font-medium mt-1 px-1">
                  {m.actionExecuted}
                </span>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-purple-600 px-3 py-2 bg-purple-50/60 rounded-xl w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Recall is thinking…</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="px-5 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSendMessage(s)}
                className="px-3 py-1 text-xs rounded-full bg-black/[0.03] hover:bg-black/[0.06] text-zinc-600 font-normal transition-colors shrink-0 text-left cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="p-4 border-t border-black/[0.05] shrink-0 bg-white/70">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex items-center gap-2 rounded-2xl bg-black/[0.03] border border-black/[0.06] px-3.5 py-2 focus-within:border-black/20 focus-within:bg-white transition-all"
          >
            <input
              type="text"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Recall anything..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                input.trim() && !isSending
                  ? 'bg-zinc-900 text-white cursor-pointer active:scale-95'
                  : 'text-zinc-300 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
