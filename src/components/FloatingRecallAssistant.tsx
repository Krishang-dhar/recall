'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Calendar,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useTasks } from '@/lib/TasksContext';

interface FloatingRecallAssistantProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionsExecuted?: string[];
  plan?: Array<{
    timeSlot: string;
    title: string;
    suggestedDueAt: string;
    note?: string;
  }>;
}

export const FloatingRecallAssistant: React.FC<FloatingRecallAssistantProps> = ({
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const { tasks, createTask, updateTask, deleteTask } = useTasks();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    setInternalIsOpen(val);
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isApplyingPlan, setIsApplyingPlan] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi, I'm Recall Intelligence. You can ask me what you have today, say 'Plan my day', or tell me anything to remember or reschedule in English, Hindi, or Hinglish.",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages, isSending]);

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
          history: messages.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          tasksContext: tasks,
          userTimeZone: 'Asia/Kolkata',
        }),
      });

      const data = await res.json();
      const actionsExecuted: string[] = [];

      // Auto-execute clear task manipulation actions returned by Gemini
      if (Array.isArray(data.actions) && data.actions.length > 0) {
        for (const action of data.actions) {
          try {
            if (action.type === 'create_task' && action.data?.title) {
              await createTask({
                title: action.data.title,
                due_at:
                  action.data.due_at ||
                  new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                note: action.data.note,
              });
              actionsExecuted.push(`Created: "${action.data.title}"`);
            } else if (action.type === 'complete_task' && action.data?.id) {
              await updateTask(action.data.id, { status: 'completed' });
              actionsExecuted.push('Marked task completed ✓');
            } else if (action.type === 'reschedule_task' && action.data?.id) {
              await updateTask(action.data.id, {
                due_at: action.data.due_at,
                title: action.data.title,
              });
              actionsExecuted.push('Rescheduled task ✓');
            } else if (action.type === 'delete_task' && action.data?.id) {
              await deleteTask(action.data.id);
              actionsExecuted.push('Removed task ✓');
            }
          } catch (actErr) {
            console.warn('Could not execute AI action', action, actErr);
          }
        }
      }

      const aiMsg: MessageItem = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || "I've checked that for you.",
        actionsExecuted: actionsExecuted.length > 0 ? actionsExecuted : undefined,
        plan: Array.isArray(data.plan) && data.plan.length > 0 ? data.plan : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Sorry, I couldn't reach the AI service right now. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyPlan = async (planItems: MessageItem['plan'], msgId: string) => {
    if (!planItems || planItems.length === 0) return;
    setIsApplyingPlan(msgId);

    try {
      for (const item of planItems) {
        // Check if an existing task matches this title closely
        const existing = tasks.find(
          (t) =>
            t.status === 'pending' &&
            t.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 10))
        );

        if (existing) {
          await updateTask(existing.id, {
            due_at: item.suggestedDueAt || new Date().toISOString(),
            note: item.note || existing.note,
          });
        } else {
          await createTask({
            title: item.title,
            due_at: item.suggestedDueAt || new Date().toISOString(),
            note: item.note,
          });
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                actionsExecuted: [
                  ...(m.actionsExecuted || []),
                  `Applied ${planItems.length} day plan schedule slots to your tasks ✓`,
                ],
              }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to apply day plan:', err);
    } finally {
      setIsApplyingPlan(null);
    }
  };

  const quickPrompts = [
    'What do I have today?',
    'Plan my day',
    'Move Prem Sweets call to 5 PM',
    'Mark Novelle quotation done',
  ];

  return (
    <>
      {/* Floating Bottom-Right Trigger Orb */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Open Recall AI Assistant"
          aria-label="Open Recall AI Assistant"
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-zinc-900 text-white shadow-[0_8px_30px_rgb(0,0,0,0.22)] border border-white/10 hover:bg-black hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          {/* Subtle Breathing Glow Icon */}
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#0052FF]/40 to-[#00D2FF]/40 blur-xs animate-pulse" />
            <div className="relative w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/recall-logo.png"
                alt="Recall"
                className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,82,255,0.3)]"
              />
            </div>
          </div>
          <span className="text-xs font-semibold tracking-tight text-white/90 group-hover:text-white">
            Ask Recall
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 ease-out flex flex-col bg-white dark:bg-[#202123] border border-black/10 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-2xl overflow-hidden ${
            isExpanded
              ? 'inset-4 md:inset-12 max-w-4xl mx-auto rounded-3xl'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[92vw] sm:w-[440px] h-[600px] max-h-[85vh] rounded-[26px]'
          }`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-zinc-50/60 dark:bg-[#2a2b32] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/recall-logo.png"
                  alt="Recall"
                  className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,82,255,0.3)]"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Recall Intelligence
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium">
                    Gemini
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-400">
                  Work & life assistant
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse' : 'Expand'}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 dark:text-zinc-200">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed tracking-tight ${
                    m.role === 'user'
                      ? 'bg-zinc-900 dark:bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-zinc-100/80 dark:bg-[#2f3136] text-zinc-850 dark:text-zinc-200 border border-black/5 dark:border-white/5 rounded-bl-xs whitespace-pre-wrap'
                  }`}
                >
                  {m.content}
                </div>

                {/* Day Plan Display Card if Gemini constructed one */}
                {m.plan && m.plan.length > 0 && (
                  <div className="mt-2.5 w-full max-w-[94%] rounded-xl bg-white dark:bg-[#2f3136] border border-black/10 dark:border-white/10 p-3 shadow-xs flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Proposed Daily Schedule</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {m.plan.length} items
                      </span>
                    </div>

                    <div className="divide-y divide-black/5 dark:divide-white/5 text-xs">
                      {m.plan.map((item, idx) => (
                        <div
                          key={idx}
                          className="py-1.5 flex items-start justify-between gap-2"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {item.title}
                            </span>
                            {item.note && (
                              <span className="text-[11px] text-zinc-400">
                                {item.note}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-black/30 text-zinc-600 dark:text-zinc-300 shrink-0">
                            {item.timeSlot}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleApplyPlan(m.plan, m.id)}
                      disabled={isApplyingPlan === m.id}
                      className="mt-1 w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isApplyingPlan === m.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Applying to your tasks...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Apply plan to Recall tasks</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Actions Executed pill */}
                {m.actionsExecuted && m.actionsExecuted.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1.5 px-1">
                    {m.actionsExecuted.map((act, i) => (
                      <span
                        key={i}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {act}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 px-3 py-2 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Recall is thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSendMessage(p)}
                  className="px-2.5 py-1 text-[11px] rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition-colors shrink-0 cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <div className="p-3 border-t border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-[#202123] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
              className="flex items-center gap-2 rounded-xl bg-white dark:bg-[#2f3136] border border-black/10 dark:border-white/10 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask or tell Recall anything..."
                className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  input.trim() && !isSending
                    ? 'bg-zinc-900 dark:bg-indigo-600 text-white cursor-pointer active:scale-95'
                    : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
