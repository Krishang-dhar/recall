'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Send,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  Plus,
  Paperclip,
  CheckSquare,
  Upload,
  Mic,
  History,
  Copy,
  Check,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { RECALL_SLASH_COMMANDS, SlashCommand } from '@/lib/slash-commands';
import { VoiceOrb, VoiceOrbState } from './VoiceOrb';
import { GenerativeUIView } from './GenerativeUIView';
import { DayPlanWorkspace } from './DayPlanWorkspace';
import {
  UnifiedActionCard,
  UnifiedActionData,
  ActionCardStep,
  CreatedActionItem,
} from './UnifiedActionCard';
import { PluginId, PluginIcon } from './PluginIcon';
import { GenerativeUIData, GenerativeUIPlanSlot } from '@/lib/recall-ai';
import { useTasks } from '@/lib/TasksContext';
import { AssistantType } from '@/lib/types';
import { UndoToast } from './UndoToast';
import { BulkPreviewModal, BulkPreviewItem } from './BulkPreviewModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ActionHistory } from './ActionHistory';
import { ProposedPlanCard, ProposedPlanItem } from './ProposedPlanCard';
import {
  PlanningMachineState,
  PlanningProgressCard,
  PlanningToolStep,
} from './PlanningProgressCard';
import { overlayManager } from '@/lib/overlay-manager';
import { detectItemCategory, checkDuplicateTask, computeEventTimes } from '@/lib/action-routing';

interface RecallAIComposerProps {
  onTaskCreated?: () => void;
  onOpenConnectApps?: () => void;
  externalPrompt?: string | null;
  onConnectorPulse?: (pluginId: string) => void;
  conversationId?: string | null;
  projectId?: string;
  onOpenTaskComposer?: () => void;
  onItemsCreated?: (itemIds: string[], targetDate?: Date) => void;
}

const createTaskSpecificPlanningSteps = (textToSend: string): PlanningToolStep[] => {
  const isTomorrow = /\btomorrow\b/i.test(textToSend);
  const targetDay = isTomorrow ? 'tomorrow' : 'today';
  return [
    { id: 'understanding', tool: 'recall', label: 'Deconstructing tasks & time requirements', status: 'running' },
    { id: 'calendar', tool: 'calendar', label: `Checking Google Calendar for ${targetDay}’s openings`, status: 'pending' },
    { id: 'gmail', tool: 'gmail', label: 'Scanning meeting context in Gmail', status: 'pending' },
    { id: 'conflicts', tool: 'recall', label: 'Optimizing schedule without overlap', status: 'pending' },
    { id: 'reminders', tool: 'recall', label: 'Configuring smart lead-time reminders', status: 'pending' },
    { id: 'proposal', tool: 'recall', label: 'Generating visual day plan proposal', status: 'pending' },
  ];
};

const cleanAssistantText = (value: string): string =>
  value
    .normalize('NFKC')
    .replace(/\uFFFD/g, '')
    .replace(/tl\s*;\s*dv/gi, 'tl;dv')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

function renderFormattedInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-zinc-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-xs border border-black/[0.05] dark:border-white/[0.08]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

const FormattedAIResponse: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming }) => {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-100 font-normal">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1.5" />;
        }

        // Bullet list item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          const bulletText = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div key={lineIdx} className="flex items-start gap-2.5 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80 dark:bg-blue-400 mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                {renderFormattedInline(bulletText)}
              </div>
            </div>
          );
        }

        // Numbered list item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={lineIdx} className="flex items-start gap-2.5 pl-1">
              <span className="font-mono text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0 w-4 text-right">
                {numMatch[1]}.
              </span>
              <div className="flex-1 min-w-0">
                {renderFormattedInline(numMatch[2])}
              </div>
            </div>
          );
        }

        // Standard line / paragraph
        return (
          <p key={lineIdx} className="text-zinc-800 dark:text-zinc-100">
            {renderFormattedInline(line)}
            {isStreaming && lineIdx === lines.length - 1 && (
              <span className="inline-block w-1.5 h-4 ml-1 -mb-0.5 rounded-full bg-gradient-to-b from-[#0052FF] to-[#7928CA] animate-pulse" />
            )}
          </p>
        );
      })}
    </div>
  );
};

async function fetchJsonWithTimeout(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data?.error || `Request failed (${response.status})` };
    }
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof DOMException && error.name === 'AbortError'
        ? 'Timed out while waiting for the service.'
        : error instanceof Error
        ? error.message
        : 'Service unavailable.',
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export const RecallAIComposer: React.FC<RecallAIComposerProps> = ({
  onTaskCreated,
  onOpenConnectApps,
  externalPrompt,
  onConnectorPulse,
  conversationId,
  projectId,
  onOpenTaskComposer,
  onItemsCreated,
}) => {
  const { tasks, createTask, updateTask, deleteTask } = useTasks();

  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [assistantType, setAssistantType] = useState<AssistantType>('recall');
  const [voiceState, setVoiceState] = useState<VoiceOrbState>('idle');
  const [audioVolume, setAudioVolume] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [generativeUI, setGenerativeUI] = useState<GenerativeUIData | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId || null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt?: string }>
  >([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Sync active conversation when conversationId prop changes
  useEffect(() => {
    setActiveConversationId(conversationId || null);
    if (conversationId) {
      setIsLoadingChat(true);
      fetch(`/api/conversations/${conversationId}/messages`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.messages)) {
            setChatMessages(data.messages);
            setConversationHistory(
              data.messages.map((m: any) => ({ role: m.role, content: m.content }))
            );
          }
        })
        .catch((e) => console.warn('Could not load chat messages', e))
        .finally(() => setIsLoadingChat(false));
    } else {
      setChatMessages([]);
    }
  }, [conversationId]);

  // Listen for new chat request from sidebar
  useEffect(() => {
    const handleNewChat = () => {
      setActiveConversationId(null);
      setChatMessages([]);
      setStreamingText('');
      setGenerativeUI(null);
    };
    window.addEventListener('recall-new-chat', handleNewChat);
    return () => window.removeEventListener('recall-new-chat', handleNewChat);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, streamingText, isProcessing]);

  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    preview?: string;
  } | null>(null);

  const [focusState, setFocusState] = useState<{
    active: boolean;
    title: string;
    minutesLeft: number;
  } | null>(null);

  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [activeSlashCommand, setActiveSlashCommand] = useState<SlashCommand | null>(null);
  const [isCopiedResponse, setIsCopiedResponse] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastSoundTimeRef = useRef<number>(Date.now());
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Live Voice & Siri-like AI Presence State
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState(false);
  const [liveVoicePhase, setLiveVoicePhase] = useState<'listening' | 'understanding' | 'thinking' | 'speaking'>('listening');
  const [liveTranscript, setLiveTranscript] = useState('');

  const liveTranscriptRef = useRef<string>('');
  const isLiveVoiceOpenRef = useRef<boolean>(false);
  const liveVoicePhaseRef = useRef<'listening' | 'understanding' | 'thinking' | 'speaking'>('listening');

  useEffect(() => {
    isLiveVoiceOpenRef.current = isLiveVoiceOpen;
  }, [isLiveVoiceOpen]);

  useEffect(() => {
    liveVoicePhaseRef.current = liveVoicePhase;
  }, [liveVoicePhase]);

  // Unified Action Card State (Single live progress & result card)
  const [unifiedAction, setUnifiedAction] = useState<UnifiedActionData | null>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [proposedPlan, setProposedPlan] = useState<{
    items: ProposedPlanItem[];
    actions: any[];
    reply: string;
    gmailContext: boolean;
  } | null>(null);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [planningMachine, setPlanningMachine] = useState<PlanningMachineState>({
    phase: 'idle',
    steps: [],
  });

  useEffect(() => {
    try {
      const savedAutoSave = localStorage.getItem('recall-auto-save') === 'true';
      queueMicrotask(() => setAutoSave(savedAutoSave));
    } catch {}

    const handleAutoSaveChange = (event: Event) => {
      const enabled = Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled);
      setAutoSave(enabled);
    };
    window.addEventListener('recall-auto-save-changed', handleAutoSaveChange);
    return () => window.removeEventListener('recall-auto-save-changed', handleAutoSaveChange);
  }, []);

  // ── Undo Toast ────────────────────────────────────────────────────────────────
  const [undoToast, setUndoToast] = useState<{
    tool: string;
    label: string;
    actionId?: string;
    undoable: boolean;
  } | null>(null);

  // ── Bulk Preview Modal ────────────────────────────────────────────────────────
  const [bulkPreview, setBulkPreview] = useState<{
    tool: PluginId;
    actionLabel: string;
    itemsLabel: string;
    dateLabel?: string;
    items: BulkPreviewItem[];
    pendingAction: any; // The action to execute after confirmation
  } | null>(null);

  // ── Confirm Delete Modal ──────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<{
    tool?: PluginId;
    itemName: string;
    itemSubtitle?: string;
    onConfirm: () => void;
  } | null>(null);

  // ── History ──────────────────────────────────────────────────────────────────
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);


  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      const trimmed = externalPrompt.trim();
      if (trimmed.startsWith('/')) {
        const matched = RECALL_SLASH_COMMANDS.find(
          (c) => trimmed === c.command || trimmed.startsWith(c.command + ' ')
        );
        if (matched) {
          setActiveSlashCommand(matched);
          const remainder = trimmed.slice(matched.command.length).trim();
          setPrompt(remainder);
          inputRef.current?.focus();
          return;
        }
      }
      setPrompt(trimmed);
      handleExecuteInstruction(trimmed);
    }
  }, [externalPrompt]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopMicrophoneStream();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const finishVoiceRef = useRef<() => void>(() => {});

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowAttachmentMenu(false);
        setIsHistoryOpen(false);
        if (isLiveVoiceOpen) {
          stopMicrophoneStream();
          setIsLiveVoiceOpen(false);
          setVoiceState('idle');
        }
      } else if (e.key === 'Enter' && isLiveVoiceOpen) {
        e.preventDefault();
        finishVoiceRef.current();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLiveVoiceOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showAttachmentMenu) {
        setShowAttachmentMenu(false);
      }
    }
    if (showAttachmentMenu) {
      const timer = setTimeout(() => {
        window.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showAttachmentMenu]);

  // Audio output completely disabled per user preference (silent, visual responses only)
  const stopSpeaking = () => {};

  const slashQuery = prompt.startsWith('/') ? prompt.slice(1).toLowerCase().trim() : '';
  const filteredSlashCommands = RECALL_SLASH_COMMANDS.filter((cmd) => {
    if (!slashQuery) return true;
    return (
      cmd.command.slice(1).toLowerCase().includes(slashQuery) ||
      cmd.label.toLowerCase().includes(slashQuery) ||
      cmd.description.toLowerCase().includes(slashQuery)
    );
  });

  const handleSelectSlashCommand = (cmd: SlashCommand) => {
    if (cmd.id === 'flow') {
      setPrompt('');
      startVoiceCapture();
      return;
    }
    if (cmd.id === 'search') {
      setPrompt('');
      setActiveSlashCommand(null);
      window.dispatchEvent(new CustomEvent('open-global-search'));
      return;
    }
    // Highlight command in blue, do not auto send, let user type!
    setActiveSlashCommand(cmd);
    setPrompt('');
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && prompt === '' && activeSlashCommand) {
      e.preventDefault();
      setActiveSlashCommand(null);
      return;
    }

    if (prompt.startsWith('/') && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex(
          (prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSlashCommands[selectedSlashIndex];
        if (selected) {
          handleSelectSlashCommand(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        setPrompt('');
        return;
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPrompt(val);
    setSelectedSlashIndex(0);
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1200);
  };

  const stopMicrophoneStream = () => {
    if ((mediaRecorderRef as any).currentRecognition) {
      try {
        (mediaRecorderRef as any).currentRecognition.stop();
      } catch (e) {}
      (mediaRecorderRef as any).currentRecognition = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  };

interface ExtractedPromptDetails {
  intent:
    | 'meeting'
    | 'day_plan'
    | 'schedule_query'
    | 'what_next'
    | 'briefing'
    | 'rescue_day'
    | 'reschedule'
    | 'reminder'
    | 'email_archive'
    | 'email_search'
    | 'drive_manage'
    | 'task_create'
    | 'question_or_draft';
  person?: string;
  timeStr?: string;
  timeRange?: string;
  dateContext?: string;
  topic?: string;
}

function parseUserIntentAndEntities(textToSend: string): ExtractedPromptDetails {
  const p = textToSend.toLowerCase().trim();

  // 1. Detect Person
  const personMatch = textToSend.match(/(?:with|call|meet|sync with|ping)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const person = personMatch ? personMatch[1] : undefined;

  // 2. Detect Time Range or Time
  const timeRangeMatch = textToSend.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  const singleTimeMatch =
    textToSend.match(/\b(?:at|by|for)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i) ||
    textToSend.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);

  const timeRange = timeRangeMatch ? timeRangeMatch[1] : undefined;
  const timeStr = timeRange || (singleTimeMatch ? singleTimeMatch[1] : undefined);

  // 3. Detect Date Context
  let dateContext: string | undefined = undefined;
  if (p.includes('tomorrow')) dateContext = 'tomorrow';
  else if (p.includes('today')) dateContext = 'today';
  else if (p.includes('tonight')) dateContext = 'tonight';
  else if (p.includes('this afternoon')) dateContext = 'this afternoon';
  else if (p.includes('friday')) dateContext = 'Friday';
  else if (p.includes('monday')) dateContext = 'Monday';

  // 4. Detect Intent
  // Day Planning
  const isExplicitDayPlan = [
    'plan my day',
    'plan the day',
    'plan my afternoon',
    'plan my morning',
    'plan my tomorrow',
    'day schedule',
    'daily routine',
    'organize my day',
    'schedule my day',
    'build my schedule',
    'fit these in',
  ].some((phrase) => p.includes(phrase));

  const timeMentions = p.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)\b/gi) || [];
  const hasMultipleTasks = (p.includes(',') || p.includes(' and ') || p.includes('&')) && timeMentions.length >= 2;
  const isSingleMeetingRange = Boolean(timeRangeMatch);

  if (isExplicitDayPlan || (hasMultipleTasks && !isSingleMeetingRange) || timeMentions.length >= 3) {
    return { intent: 'day_plan', person, timeStr, timeRange, dateContext };
  }

  // Schedule Query
  const isScheduleQuery = [
    'what do i have',
    'what is on my schedule',
    "what's on my schedule",
    'show my schedule',
    'show schedule',
    'view schedule',
    "today's calendar",
    'agenda for today',
    'any meetings today',
    'any meetings tomorrow',
    'my meetings today',
    'upcoming meetings',
    "what's planned",
    'whats planned',
  ].some((phrase) => p.includes(phrase));

  if (isScheduleQuery) {
    return { intent: 'schedule_query', person, timeStr, timeRange, dateContext: dateContext || 'today' };
  }

  // What Next / Prioritization
  const isWhatNext = [
    'what should i do',
    'what to do now',
    "what's next",
    'whats next',
    'what next',
    'where should i start',
    'highest priority',
    'focus on what',
    'next task',
    'what do i focus on',
  ].some((phrase) => p.includes(phrase));

  if (isWhatNext) {
    return { intent: 'what_next', person, timeStr, timeRange, dateContext };
  }

  // Daily Briefing
  const isBriefing = [
    'catch me up',
    'brief me',
    'morning briefing',
    'daily briefing',
    'update me',
    'summary of today',
    "today's briefing",
  ].some((phrase) => p.includes(phrase));

  if (isBriefing) {
    return { intent: 'briefing', person, timeStr, timeRange, dateContext: dateContext || 'today' };
  }

  // Rescue My Day
  const isRescue = [
    'rescue my day',
    'running late',
    'behind schedule',
    'rebalance my day',
    'rebalance schedule',
    'fix my schedule',
  ].some((phrase) => p.includes(phrase));

  if (isRescue) {
    return { intent: 'rescue_day', person, timeStr, timeRange, dateContext };
  }

  // Reschedule
  const isReschedule = [
    'reschedule',
    'move it to',
    'move meeting to',
    'move to',
    'push to',
    'push back',
    'postpone',
  ].some((phrase) => p.includes(phrase));

  if (isReschedule) {
    return { intent: 'reschedule', person, timeStr, timeRange, dateContext };
  }

  // Email archive / search
  const isEmail = p.includes('email') || p.includes('mail') || p.includes('gmail') || p.includes('inbox');
  if (isEmail) {
    if (p.includes('archive') || p.includes('trash')) {
      return { intent: 'email_archive', person, timeStr, timeRange, dateContext };
    }
    return { intent: 'email_search', person, timeStr, timeRange, dateContext };
  }

  // Drive manage
  const isDrive = p.includes('drive') || p.includes('google doc') || p.includes('sheet') || p.includes('pdf');
  if (isDrive) {
    return { intent: 'drive_manage', person, timeStr, timeRange, dateContext };
  }

  // Reminder
  const isReminder = p.includes('remind') || p.includes('alert') || p.includes('whatsapp reminder');
  if (isReminder) {
    const topic = textToSend
      .replace(/remind\s+(?:me\s+)?(?:to\s+)?/i, '')
      .replace(/\b(?:at|by|on|tomorrow|today)\b.*$/i, '')
      .trim();
    return { intent: 'reminder', person, timeStr, timeRange, dateContext, topic };
  }

  // Meeting
  const isMeeting =
    p.includes('meet') ||
    p.includes('calendar') ||
    p.includes('appointment') ||
    p.includes('interview') ||
    p.includes('doctor') ||
    p.includes('dentist') ||
    p.includes('sync') ||
    p.includes('catchup') ||
    p.includes('call with') ||
    p.includes('1:1') ||
    Boolean(person && timeStr);

  if (isMeeting || (timeStr && (p.includes('tomorrow') || p.includes('today')))) {
    let topic = 'Meeting';
    if (person) topic = `Meeting with ${person}`;
    else if (p.includes('doctor')) topic = 'Doctor Appointment';
    else if (p.includes('dentist')) topic = 'Dentist Appointment';
    else if (p.includes('interview')) topic = 'Interview';
    return { intent: 'meeting', person, timeStr, timeRange, dateContext, topic };
  }

  // General task create vs general question
  const isTask =
    p.startsWith('task ') ||
    p.startsWith('todo ') ||
    p.startsWith('add ') ||
    p.startsWith('buy ') ||
    p.startsWith('prepare ') ||
    p.startsWith('write ');
  if (isTask) {
    return { intent: 'task_create', person, timeStr, timeRange, dateContext, topic: textToSend.trim() };
  }

  return { intent: 'question_or_draft', person, timeStr, timeRange, dateContext, topic: textToSend.trim() };
}

function isComplexPlanningRequest(textToSend: string): boolean {
  const details = parseUserIntentAndEntities(textToSend);
  return details.intent === 'day_plan';
}

function getDynamicExecutionPlan(textToSend: string): {
  headline: string;
  primaryChannel: 'calendar' | 'tasks' | 'whatsapp' | 'gmail' | 'drive' | 'recall';
  usedApps: PluginId[];
  steps: ActionCardStep[];
} {
  const details = parseUserIntentAndEntities(textToSend);

  switch (details.intent) {
    case 'meeting': {
      const title = details.person ? `Meeting with ${details.person}` : details.topic || 'Meeting';
      const timeDisplay = details.timeRange || details.timeStr;
      return {
        headline: `Scheduling ${title}…`,
        primaryChannel: 'calendar',
        usedApps: ['calendar', 'whatsapp'],
        steps: [
          { id: 'parse', icon: 'recall', label: `Parsing ${title}`, status: 'running' },
          { id: 'check', icon: 'calendar', label: `Checking calendar availability for ${details.dateContext || 'requested slot'}`, status: 'pending' },
          { id: 'cal', icon: 'calendar', label: `Allocating ${timeDisplay ? `${timeDisplay} ` : ''}on Google Calendar`, status: 'pending' },
          { id: 'wa', icon: 'whatsapp', label: 'Configuring 30m smart WhatsApp reminder', status: 'pending' },
        ],
      };
    }

    case 'schedule_query': {
      return {
        headline: 'Checking your schedule…',
        primaryChannel: 'calendar',
        usedApps: ['calendar', 'recall'],
        steps: [
          { id: 'cal', icon: 'calendar', label: `Scanning Google Calendar for ${details.dateContext || 'today'}`, status: 'running' },
          { id: 'rec', icon: 'recall', label: 'Checking active Recall tasks & deadlines', status: 'pending' },
          { id: 'build', icon: 'recall', label: 'Assembling chronological day timeline', status: 'pending' },
        ],
      };
    }

    case 'what_next': {
      return {
        headline: 'Finding your next focus…',
        primaryChannel: 'recall',
        usedApps: ['recall', 'calendar'],
        steps: [
          { id: 'eval', icon: 'recall', label: 'Evaluating tasks by deadline & urgency', status: 'running' },
          { id: 'cal', icon: 'calendar', label: 'Checking calendar commitments for open windows', status: 'pending' },
          { id: 'select', icon: 'recall', label: 'Selecting single highest-leverage focus action', status: 'pending' },
        ],
      };
    }

    case 'briefing': {
      return {
        headline: 'Preparing your briefing…',
        primaryChannel: 'calendar',
        usedApps: ['calendar', 'recall'],
        steps: [
          { id: 'cal', icon: 'calendar', label: 'Scanning today’s calendar commitments', status: 'running' },
          { id: 'tasks', icon: 'recall', label: 'Checking overdue & high-priority items', status: 'pending' },
          { id: 'compile', icon: 'recall', label: 'Compiling executive morning briefing', status: 'pending' },
        ],
      };
    }

    case 'rescue_day': {
      return {
        headline: 'Rescuing your day…',
        primaryChannel: 'calendar',
        usedApps: ['calendar', 'recall'],
        steps: [
          { id: 'hours', icon: 'calendar', label: 'Assessing remaining available hours today', status: 'running' },
          { id: 'filter', icon: 'recall', label: 'Separating fixed commitments from flexible tasks', status: 'pending' },
          { id: 'rebalance', icon: 'recall', label: 'Recalculating realistic time blocks with buffer', status: 'pending' },
        ],
      };
    }

    case 'day_plan': {
      return {
        headline: 'Building your day plan…',
        primaryChannel: 'recall',
        usedApps: ['calendar', 'gmail', 'whatsapp', 'recall'],
        steps: [
          { id: 'deconstruct', icon: 'recall', label: 'Deconstructing tasks & time commitments', status: 'running' },
          { id: 'calendar', icon: 'calendar', label: 'Checking Google Calendar for existing openings', status: 'pending' },
          { id: 'sequence', icon: 'recall', label: 'Sequencing optimal time blocks with travel buffer', status: 'pending' },
          { id: 'reminders', icon: 'whatsapp', label: 'Configuring smart reminder lead-times', status: 'pending' },
        ],
      };
    }

    case 'reschedule': {
      return {
        headline: 'Rescheduling event…',
        primaryChannel: 'calendar',
        usedApps: ['calendar', 'whatsapp'],
        steps: [
          { id: 'find', icon: 'calendar', label: 'Locating event on calendar', status: 'running' },
          { id: 'move', icon: 'calendar', label: `Moving to ${details.timeStr || 'new time slot'}`, status: 'pending' },
          { id: 'sync', icon: 'whatsapp', label: 'Synchronizing updated reminder alert', status: 'pending' },
        ],
      };
    }

    case 'reminder': {
      const topicText = details.topic || textToSend.slice(0, 30);
      return {
        headline: 'Setting reminder…',
        primaryChannel: 'whatsapp',
        usedApps: ['whatsapp', 'recall'],
        steps: [
          { id: 'extract', icon: 'recall', label: `Drafting reminder: "${topicText}"`, status: 'running' },
          { id: 'sched', icon: 'whatsapp', label: `Scheduling notification for ${details.timeStr || 'due time'}`, status: 'pending' },
          { id: 'save', icon: 'recall', label: 'Adding to Recall Day timeline', status: 'pending' },
        ],
      };
    }

    case 'email_archive': {
      return {
        headline: 'Archiving email…',
        primaryChannel: 'gmail',
        usedApps: ['gmail'],
        steps: [
          { id: 'gm-find', icon: 'gmail', label: details.person ? `Finding email from ${details.person}` : 'Finding message in Gmail Inbox', status: 'running' },
          { id: 'gm-act', icon: 'gmail', label: 'Moving to Archive', status: 'pending' },
        ],
      };
    }

    case 'email_search': {
      return {
        headline: 'Checking Gmail…',
        primaryChannel: 'gmail',
        usedApps: ['gmail'],
        steps: [
          { id: 'gm-conn', icon: 'gmail', label: 'Connecting to Gmail Inbox', status: 'running' },
          { id: 'gm-search', icon: 'gmail', label: details.person ? `Searching threads from ${details.person}` : 'Searching recent threads & unread mail', status: 'pending' },
          { id: 'gm-sum', icon: 'gmail', label: 'Synthesizing inbox summary', status: 'pending' },
        ],
      };
    }

    case 'drive_manage': {
      return {
        headline: 'Accessing Google Drive…',
        primaryChannel: 'drive',
        usedApps: ['drive'],
        steps: [
          { id: 'dr-conn', icon: 'drive', label: 'Connecting to Google Drive', status: 'running' },
          { id: 'dr-search', icon: 'drive', label: 'Searching documents & files', status: 'pending' },
        ],
      };
    }

    case 'task_create': {
      return {
        headline: 'Saving task…',
        primaryChannel: 'tasks',
        usedApps: ['recall'],
        steps: [
          { id: 'plan', icon: 'recall', label: `Prioritizing: "${(details.topic || textToSend).slice(0, 35)}"`, status: 'running' },
          { id: 'save', icon: 'recall', label: 'Adding to Day timeline', status: 'pending' },
        ],
      };
    }

    default: {
      return {
        headline: 'Thinking…',
        primaryChannel: 'recall',
        usedApps: ['recall'],
        steps: [
          { id: 'context', icon: 'recall', label: 'Analyzing request & context', status: 'running' },
          { id: 'reply', icon: 'recall', label: 'Formulating response', status: 'pending' },
        ],
      };
    }
  }
}


  const buildProposedPlan = (
    actions: any[],
    gmailContext: boolean
  ): ProposedPlanItem[] => {
    const seen = new Set<string>();
    const planItems = actions.reduce<ProposedPlanItem[]>((items, act, actionIndex) => {
      if (!['create_calendar_event', 'create_task'].includes(act.type) || !act.data?.title) {
        return items;
      }

      const rawStart = act.data.start || act.data.due_at;
      if (!rawStart) return items;

      const isMeeting =
        act.type === 'create_calendar_event' ||
        act.data.is_meeting ||
        detectItemCategory(act.data.title) === 'meeting';
      const timing = computeEventTimes(rawStart, act.data.end, isMeeting, undefined, {
        title: act.data.title,
        location: act.data.location,
        note: act.data.note,
        meetingType: act.data.meetingType,
        priority: act.data.priority,
      });
      const dedupeKey = `${act.data.title.toLowerCase().replace(/\s+/g, ' ').trim()}-${Math.round(timing.start.getTime() / 1800000)}`;
      if (seen.has(dedupeKey)) return items;
      seen.add(dedupeKey);

      items.push({
        id: `proposal-${actionIndex}-${timing.start.getTime()}`,
        actionIndex,
        title: act.data.title,
        start: timing.start.toISOString(),
        end: timing.end.toISOString(),
        timeLabel: timing.start.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        reminderMinutes: timing.reminderMinutes,
        reminderLabel: `WhatsApp reminder · ${timing.reminderMinutes} min before`,
        reminderReason: timing.reminderReason,
        calendar: isMeeting || Boolean(act.data.start),
        gmailContext: gmailContext && isMeeting,
      });
      return items;
    }, []);
    return planItems.sort(
      (first, second) => new Date(first.start).getTime() - new Date(second.start).getTime()
    );
  };

  const executeProposedPlan = async (
    items: ProposedPlanItem[],
    actions: any[]
  ) => {
    if (isApplyingPlan) return;
    setIsApplyingPlan(true);
    setProposedPlan(null);
    setGenerativeUI(null);
    setUnifiedAction(null);

    const executionSteps: PlanningToolStep[] = [
      { id: 'exec-calendar', tool: 'calendar', label: 'Creating Google Calendar events', status: 'running' },
      { id: 'exec-whatsapp', tool: 'whatsapp', label: 'Scheduling WhatsApp reminders', status: 'pending' },
      { id: 'exec-recall', tool: 'recall', label: 'Creating Recall tasks', status: 'pending' },
    ];
    setPlanningMachine({ phase: 'executing', steps: executionSteps });

    const createdTaskIds: string[] = [];
    const createdCalendarIds: string[] = [];
    const calendarIdsByItem = new Map<string, string>();
    const preparedItems: Array<{
      item: ProposedPlanItem;
      act: any;
      timing: ReturnType<typeof computeEventTimes>;
      shouldSyncCalendar: boolean;
    }> = [];

    try {
      for (const item of items) {
        const act = actions[item.actionIndex];
        if (!act?.data) continue;

        const isMeeting =
          act.type === 'create_calendar_event' ||
          act.data.is_meeting ||
          detectItemCategory(item.title) === 'meeting';
        const shouldSyncCalendar = isMeeting || act.type === 'create_calendar_event';
        const timing = computeEventTimes(item.start, item.end, isMeeting, undefined, {
          title: item.title,
          location: act.data.location,
          note: act.data.note,
          meetingType: act.data.meetingType,
          priority: act.data.priority,
        });

        const duplicate = checkDuplicateTask(item.title, timing.start.toISOString(), tasks);
        if (duplicate.isDuplicate) continue;

        preparedItems.push({ item, act, timing, shouldSyncCalendar });
      }

      let calendarFailure: string | undefined;
      for (const { item, act, timing, shouldSyncCalendar } of preparedItems) {
        if (!shouldSyncCalendar) continue;
        try {
          const calendarResponse = await fetch('/api/google/calendar/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: item.title,
              start: timing.start.toISOString(),
              end: timing.end.toISOString(),
              location: act.data.location,
            }),
          });
          const calendarData = await calendarResponse.json();
          const calendarEventId = calendarData?.event?.id || calendarData?.eventId;
          const isRealCalendarSuccess = Boolean(
            calendarResponse.ok &&
            calendarData?.success !== false &&
            calendarEventId &&
            !calendarData?.error &&
            !calendarData?.event?.isLocalOnly
          );
          if (calendarEventId) {
            calendarIdsByItem.set(item.id, calendarEventId);
            createdCalendarIds.push(calendarEventId);
          }
          if (!isRealCalendarSuccess) {
            calendarFailure = calendarData?.error || 'Google Calendar unavailable; affected events were kept locally.';
          }
        } catch (error) {
          calendarFailure = error instanceof Error ? error.message : 'Google Calendar request failed.';
        }
      }

      setPlanningMachine((current) => ({
        ...current,
        steps: current.steps.map((step) =>
          step.id === 'exec-calendar'
            ? {
                ...step,
                status: calendarFailure ? 'error' : 'success',
                detail: calendarFailure || `${createdCalendarIds.length} events added`,
              }
            : step.id === 'exec-whatsapp' || step.id === 'exec-recall'
            ? { ...step, status: 'running' }
            : step
        ),
      }));

      for (const { item, act, timing, shouldSyncCalendar } of preparedItems) {
        const calendarEventId = calendarIdsByItem.get(item.id);
        const created = await createTask({
          title: item.title,
          due_at: timing.start.toISOString(),
          end_time: timing.end.toISOString(),
          calendar_event_id: calendarEventId,
          is_meeting: shouldSyncCalendar,
          reminder_time: timing.reminder.toISOString(),
          note: act.data.note,
          location: act.data.location,
          priority: act.data.priority,
        });
        if (created?.id) createdTaskIds.push(created.id);
      }

      setPlanningMachine((current) => ({
        phase: 'completed',
        message: `${createdTaskIds.length} ${createdTaskIds.length === 1 ? 'item' : 'items'} added to your day.`,
        steps: current.steps.map((step) =>
          step.id === 'exec-whatsapp'
            ? { ...step, status: 'success', detail: 'Reminder times saved to the scheduler' }
            : step.id === 'exec-recall'
            ? { ...step, status: 'success', detail: `${createdTaskIds.length} tasks created` }
            : step
        ),
      }));

      if (createdTaskIds.length > 0) {
        onTaskCreated?.();
        onConnectorPulse?.('whatsapp');
        if (createdCalendarIds.length > 0) onConnectorPulse?.('calendar');
        onItemsCreated?.(createdTaskIds, new Date(items[0].start));
      }
      setStreamingText('');
      window.setTimeout(() => {
        setPlanningMachine((current) =>
          current.phase === 'completed' ? { phase: 'idle', steps: [] } : current
        );
      }, 1800);
    } catch (error) {
      console.error('Plan execution error:', error);
      setUnifiedAction(null);
      setPlanningMachine((current) => ({
        ...current,
        phase: 'error',
        message: error instanceof Error ? error.message : 'The plan could not be saved.',
      }));
    } finally {
      setIsApplyingPlan(false);
    }
  };

  const handleComplexPlanningRequest = async (
    textToSend: string,
    calledFromVoice: boolean
  ) => {
    setIsProcessing(true);
    setStreamingText('');
    setIsStreaming(false);
    setGenerativeUI(null);
    setProposedPlan(null);
    setUnifiedAction(null);

    const steps = createTaskSpecificPlanningSteps(textToSend);
    setPlanningMachine({ phase: 'understanding', steps });
    setConversationHistory((current) => [
      ...current,
      { role: 'user', content: textToSend.trim() },
    ]);

    try {
      setPlanningMachine((current) => ({
        phase: 'checking_calendar',
        steps: current.steps.map((step) =>
          step.id === 'understanding'
            ? { ...step, status: 'success', detail: 'Complex day plan detected' }
            : step.id === 'calendar'
            ? { ...step, status: 'running' }
            : step
        ),
      }));

      const targetDate = new Date();
      if (/\btomorrow\b/i.test(textToSend)) targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(targetDate);
      rangeEnd.setDate(rangeEnd.getDate() + 1);

      const calendarResult = await fetchJsonWithTimeout(
        `/api/google/calendar/events?timeMin=${encodeURIComponent(targetDate.toISOString())}&timeMax=${encodeURIComponent(rangeEnd.toISOString())}`
      );
      const calendarSuccess = Boolean(
        calendarResult?.success === true &&
        calendarResult?.connected === true &&
        !calendarResult?.error
      );
      const calendarEvents = Array.isArray(calendarResult?.events) ? calendarResult.events : [];

      setPlanningMachine((current) => ({
        phase: 'checking_gmail',
        steps: current.steps.map((step) =>
          step.id === 'calendar'
            ? {
                ...step,
                status: calendarSuccess ? 'success' : 'error',
                detail: calendarSuccess
                  ? `${calendarEvents.length} existing ${calendarEvents.length === 1 ? 'event' : 'events'} found`
                  : calendarResult?.error || 'Google Calendar is not connected.',
              }
            : step.id === 'gmail'
            ? { ...step, status: 'running' }
            : step
        ),
      }));

      const gmailResult = await fetchJsonWithTimeout(
        '/api/google/gmail/search?q=newer_than%3A14d%20%7Bmeeting%20schedule%20invite%20agenda%7D&max=5'
      );
      const gmailSuccess = Boolean(
        gmailResult?.success === true &&
        gmailResult?.connected === true &&
        !gmailResult?.error
      );
      const relevantEmails = Array.isArray(gmailResult?.emails) ? gmailResult.emails : [];

      setPlanningMachine((current) => ({
        phase: 'planning',
        steps: current.steps.map((step) =>
          step.id === 'gmail'
            ? {
                ...step,
                status: gmailSuccess ? 'success' : 'error',
                detail: gmailSuccess
                  ? `${relevantEmails.length} relevant ${relevantEmails.length === 1 ? 'email' : 'emails'} found`
                  : gmailResult?.error || 'Gmail is not connected.',
              }
            : step.id === 'conflicts'
            ? { ...step, status: 'running' }
            : step
        ),
      }));

      const normalizedEvents = calendarEvents
        .map((event: any) => ({
          start: new Date(event?.start?.dateTime || event?.start?.date || 0).getTime(),
          end: new Date(event?.end?.dateTime || event?.end?.date || 0).getTime(),
        }))
        .filter((event: { start: number; end: number }) => Number.isFinite(event.start) && Number.isFinite(event.end))
        .sort((first: { start: number }, second: { start: number }) => first.start - second.start);
      const overlapCount = normalizedEvents.reduce((count: number, event: { start: number }, index: number) => {
        if (index === 0) return count;
        return event.start < normalizedEvents[index - 1].end ? count + 1 : count;
      }, 0);

      const planningController = new AbortController();
      const planningTimeout = window.setTimeout(() => planningController.abort(), 30000);
      let planningResponse: Response;
      try {
        planningResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: planningController.signal,
          body: JSON.stringify({
          message: textToSend.trim(),
          history: conversationHistory.slice(-8),
          tasksContext: tasks,
          userTimeZone: 'Asia/Kolkata',
          assistantType,
          projectId,
          conversationId: activeConversationId,
          attachedFileName: attachedFile?.name,
          preflightContext: {
            calendar: {
              success: calendarSuccess,
              connected: Boolean(calendarResult?.connected),
              events: calendarEvents,
              error: calendarSuccess ? undefined : calendarResult?.error || 'Calendar unavailable',
            },
            gmail: {
              success: gmailSuccess,
              connected: Boolean(gmailResult?.connected),
              emails: relevantEmails,
              error: gmailSuccess ? undefined : gmailResult?.error || 'Gmail unavailable',
            },
          },
          }),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('Planning timed out. Calendar and Gmail results were preserved; try again.');
        }
        throw error;
      } finally {
        window.clearTimeout(planningTimeout);
      }

      const data = await planningResponse.json();
      if (!planningResponse.ok || data?.error) {
        throw new Error(data?.error || `Planning failed (${planningResponse.status})`);
      }

      setPlanningMachine((current) => ({
        ...current,
        steps: current.steps.map((step) =>
          step.id === 'conflicts'
            ? {
                ...step,
                status: 'success',
                detail: overlapCount > 0
                  ? `${overlapCount} existing conflict ${overlapCount === 1 ? 'was' : 'were'} considered`
                  : 'Available windows mapped',
              }
            : step.id === 'reminders'
            ? { ...step, status: 'running' }
            : step
        ),
      }));

      let scheduledActions = Array.isArray(data.actions)
        ? data.actions.filter(
            (action: any) =>
              (action.type === 'create_calendar_event' || action.type === 'create_task') &&
              action.data?.title &&
              (action.data?.start || action.data?.due_at)
          )
        : [];

      if (scheduledActions.length === 0 && Array.isArray(data.generativeUI?.planSlots)) {
        scheduledActions = data.generativeUI.planSlots
          .filter((slot: GenerativeUIPlanSlot) => slot.title && slot.suggestedDueAt)
          .map((slot: GenerativeUIPlanSlot) => ({
            type: 'create_task',
            data: {
              title: slot.title,
              due_at: slot.suggestedDueAt,
              note: slot.note,
              meetingType: detectItemCategory(slot.title) === 'meeting' ? 'in_person' : 'deadline',
            },
          }));
      }

      const proposalItems = buildProposedPlan(scheduledActions, gmailSuccess && relevantEmails.length > 0);
      if (proposalItems.length === 0) {
        throw new Error('Recall could not turn the response into a structured schedule. Please include times or deadlines.');
      }

      setPlanningMachine((current) => ({
        ...current,
        steps: current.steps.map((step) =>
          step.id === 'reminders'
            ? { ...step, status: 'success', detail: 'Reminder lead times matched to each item' }
            : step.id === 'proposal'
            ? { ...step, status: 'running' }
            : step
        ),
      }));

      const cleanReply = cleanAssistantText(data.reply || '');
      const contextSummary = [
        calendarSuccess ? `${calendarEvents.length} Calendar events` : 'Calendar unavailable',
        gmailSuccess ? `${relevantEmails.length} relevant emails` : 'Gmail unavailable',
      ].join(' · ');
      const pendingPlan = {
        items: proposalItems,
        actions: scheduledActions,
        reply: `Built around ${contextSummary}. Review the times before anything is created.`,
        gmailContext: gmailSuccess && relevantEmails.length > 0,
      };

      setConversationHistory((current) => [
        ...current,
        { role: 'assistant', content: cleanReply },
      ]);
      setPlanningMachine((current) => ({
        phase: 'proposal_ready',
        steps: current.steps.map((step) =>
          step.id === 'proposal'
            ? { ...step, status: 'success', detail: `${proposalItems.length} items organized` }
            : step
        ),
      }));
      setProposedPlan(pendingPlan);
      queueMicrotask(() => {
        setPlanningMachine((current) =>
          current.phase === 'proposal_ready' ? { ...current, phase: 'awaiting_approval' } : current
        );
      });

      setPrompt('');
      setAttachedFile(null);
      setIsProcessing(false);

      if (autoSave) {
        await executeProposedPlan(proposalItems, scheduledActions);
      }
    } catch (error) {
      setIsProcessing(false);
      setPlanningMachine((current) => ({
        ...current,
        phase: 'error',
        steps: current.steps.map((step) =>
          step.status === 'running'
            ? {
                ...step,
                status: 'error',
                detail: error instanceof Error ? error.message : 'Planning failed.',
              }
            : step
        ),
        message: error instanceof Error ? error.message : 'Planning failed.',
      }));
    } finally {
      if (calledFromVoice) {
        setIsLiveVoiceOpen(false);
        setVoiceState('idle');
      }
      setIsTyping(false);
    }
  };

  const handleExecuteInstruction = async (textToSend: string, calledFromVoice: boolean = false) => {
    let cleanPrompt = textToSend.trim();
    if (!cleanPrompt || isProcessing) return;

    // ── NORMALIZE SLASH COMMANDS ───────────────────────────────────────────
    if (cleanPrompt.startsWith('/today')) {
      cleanPrompt = 'What do I have today?';
    } else if (cleanPrompt.startsWith('/catchup')) {
      cleanPrompt = 'Catch me up on today’s schedule and top priorities';
    } else if (cleanPrompt.startsWith('/rescue')) {
      cleanPrompt = 'Rescue my day and recalculate realistic time blocks';
    } else if (cleanPrompt.startsWith('/calendar')) {
      cleanPrompt = 'Show my schedule for today';
    } else if (cleanPrompt.startsWith('/flow')) {
      startVoiceCapture();
      return;
    } else if (cleanPrompt.startsWith('/search')) {
      window.dispatchEvent(new CustomEvent('open-global-search'));
      return;
    } else if (cleanPrompt.startsWith('/plan ')) {
      cleanPrompt = `Plan my day: ${cleanPrompt.slice(6).trim()}`;
    } else if (cleanPrompt.startsWith('/meeting ')) {
      cleanPrompt = cleanPrompt.slice(9).trim();
    } else if (cleanPrompt.startsWith('/remind ')) {
      cleanPrompt = `Remind me to ${cleanPrompt.slice(8).trim()}`;
    } else if (cleanPrompt.startsWith('/task ')) {
      cleanPrompt = cleanPrompt.slice(6).trim();
    } else if (cleanPrompt.startsWith('/email ')) {
      cleanPrompt = cleanPrompt.slice(7).trim();
    }

    if (isComplexPlanningRequest(cleanPrompt)) {
      await handleComplexPlanningRequest(cleanPrompt, calledFromVoice);
      return;
    }

    setIsProcessing(true);
    setStreamingText('');
    setIsStreaming(false);

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: cleanPrompt },
    ];
    setConversationHistory(updatedHistory);
    setChatMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: cleanPrompt, createdAt: new Date().toISOString() },
    ]);

    const actionStartTime = Date.now();
    const dynamicPlan = getDynamicExecutionPlan(cleanPrompt);

    setUnifiedAction({
      id: `act-${Date.now()}`,
      phase: 'progress',
      title: cleanPrompt,
      headline: dynamicPlan.headline,
      primaryChannel: dynamicPlan.primaryChannel,
      usedApps: dynamicPlan.usedApps,
      steps: dynamicPlan.steps,
      recommendations: [],
    });

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: conversationHistory.slice(-8),
          tasksContext: tasks,
          userTimeZone: 'Asia/Kolkata',
          assistantType,
          projectId,
          conversationId: activeConversationId,
          attachedFileName: attachedFile?.name,
        }),
      });

      const data = await res.json();
      if (data.conversationId) {
        setActiveConversationId(data.conversationId);
        try {
          const currentUrl = new URL(window.location.href);
          if (currentUrl.searchParams.get('chatId') !== data.conversationId) {
            currentUrl.searchParams.set('chatId', data.conversationId);
            window.history.replaceState({}, '', currentUrl.toString());
          }
        } catch {}
        window.dispatchEvent(new CustomEvent('recall-conversations-changed'));
      }

      const scheduledActions = Array.isArray(data.actions)
        ? data.actions.filter(
            (action: any) =>
              (action.type === 'create_calendar_event' || action.type === 'create_task') &&
              action.data?.title
          )
        : [];

      setIsProcessing(false);

      const replyText = cleanAssistantText(data.reply || '');
      if (replyText) {
        setChatMessages((prev) => [
          ...prev,
          { id: `asst-${Date.now()}`, role: 'assistant', content: replyText, createdAt: new Date().toISOString() },
        ]);
      }

      // Fast streaming animation
      if (data.reply) {
        setIsStreaming(true);
        let currentLen = 0;
        const fullText = cleanAssistantText(data.reply);
        const interval = setInterval(() => {
          currentLen += Math.max(3, Math.floor(fullText.length / 30));
          if (currentLen >= fullText.length) {
            setStreamingText(fullText);
            setIsStreaming(false);
            clearInterval(interval);
          } else {
            setStreamingText(fullText.slice(0, currentLen));
          }
        }, 16);
      }

      setConversationHistory((prev) => [
        ...prev,
        { role: 'assistant', content: cleanAssistantText(data.reply || '') },
      ]);

      const newlyCreatedTasks: string[] = [];
      const newlyCreatedCalEvents: string[] = [];

      // Execute tasks and calendar actions autonomously
      if (Array.isArray(data.actions)) {
        for (const act of data.actions) {
          // ── CREATE MEETING OR TIMED TASK (AUTOMATIC GOOGLE CALENDAR + WHATSAPP SYNC) ─
          if ((act.type === 'create_calendar_event' || act.type === 'create_task') && act.data?.title) {
            const hasTime = Boolean(act.data.start || act.data.due_at);
            const isMeeting = act.type === 'create_calendar_event' || act.data.is_meeting || detectItemCategory(act.data.title) === 'meeting';
            const shouldSyncCalendar = isMeeting || hasTime;
            const rawDue = act.data.start || act.data.due_at || new Date().toISOString();
            const { start, end, reminder, timeLabel, reminderLabel } = computeEventTimes(
              rawDue,
              act.data.end,
              shouldSyncCalendar,
              undefined,
              {
                title: act.data.title,
                location: act.data.location,
                note: act.data.note,
                meetingType: act.data.meetingType,
                priority: act.data.priority,
              }
            );

            // 1. Duplicate Prevention
            const dup = checkDuplicateTask(act.data.title, start.toISOString(), tasks);
            if (dup.isDuplicate && dup.duplicateTask) {
              const existingDue = new Date(dup.duplicateTask.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              setStreamingText(`This is already scheduled for ${existingDue}.`);
              continue;
            }

            // 2. Google Calendar Event Creation
            let calId: string | undefined = undefined;
            if (shouldSyncCalendar) {
              try {
                const calRes = await fetch('/api/google/calendar/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: act.data.title,
                    start: start.toISOString(),
                    end: end.toISOString(),
                    location: act.data.location,
                  }),
                });
                const calData = await calRes.json();
                if (calData?.event?.id || calData?.eventId) {
                  calId = calData.event?.id || calData.eventId;
                  newlyCreatedCalEvents.push(calId!);
                }
              } catch (e) {
                console.warn('Google Calendar sync error:', e);
              }
            }

            // 3. Recall Task Creation with WhatsApp Reminder
            const created = await createTask({
              title: act.data.title,
              due_at: start.toISOString(),
              end_time: end.toISOString(),
              calendar_event_id: calId,
              is_meeting: shouldSyncCalendar,
              reminder_time: shouldSyncCalendar ? reminder.toISOString() : undefined,
              note: act.data.note,
              location: act.data.location,
            });
            if (created?.id) newlyCreatedTasks.push(created.id);

            onTaskCreated?.();
            if (shouldSyncCalendar) {
              onConnectorPulse?.('whatsapp');
              if (calId) onConnectorPulse?.('calendar');
            }

          // ── UPDATE / RESCHEDULE TASK OR MEETING (LINKED ACTIONS) ───────────────
          } else if ((act.type === 'reschedule_task' || act.type === 'update_calendar_event') && act.data) {
            const taskToMove =
              tasks.find((t) => t.id === act.data.id || (act.data.title && t.title.toLowerCase().includes(act.data.title.toLowerCase()))) ||
              tasks.find((t) => t.is_meeting) ||
              tasks[0];

            if (taskToMove) {
              const newDue = act.data.due_at || act.data.start || new Date().toISOString();
              const newEnd = act.data.end || new Date(new Date(newDue).getTime() + 3600000).toISOString();

              await updateTask(taskToMove.id, {
                due_at: newDue,
                end_time: newEnd,
              });

              const calId = taskToMove.calendar_event_id || act.data.eventId;
              if (calId) {
                try {
                  await fetch('/api/google/calendar/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      eventId: calId,
                      title: taskToMove.title,
                      start: newDue,
                      end: newEnd,
                    }),
                  });
                  onConnectorPulse?.('calendar');
                } catch (e) {}
              }
              onConnectorPulse?.('whatsapp');

              const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
              const sDate = new Date(newDue);
              const eDate = new Date(newEnd);
              const remDate = new Date(sDate.getTime() - 30 * 60 * 1000);

              setUnifiedAction({
                id: `act-${Date.now()}`,
                phase: 'completed',
                title: taskToMove.title,
                headline: `Rescheduled to ${fmtTime(sDate)}`,
                subheadline: `${fmtTime(sDate)} – ${fmtTime(eDate)}`,
                primaryChannel: 'calendar',
                steps: [
                  { id: 'rec', icon: 'recall', label: `Moved to ${fmtTime(sDate)}`, status: 'completed' },
                  { id: 'cal', icon: 'calendar', label: 'Updated Google Calendar', status: 'completed' },
                  { id: 'wa', icon: 'whatsapp', label: 'Updated WhatsApp reminder', status: 'completed' },
                ],
                items: [
                  {
                    title: taskToMove.title,
                    time: `${fmtTime(sDate)} – ${fmtTime(eDate)}`,
                    channel: 'calendar',
                  },
                ],
                recommendations: [
                  { id: 'rec-cal', iconType: 'calendar', label: 'View today schedule', prompt: 'Show my schedule for today' },
                ],
                linkedIds: {
                  taskId: taskToMove.id,
                  calendarEventId: calId,
                },
              });
            }

          // ── DELETE CALENDAR EVENT (L2 — shows confirm first) ──────────────────
          } else if (act.type === 'delete_calendar_event' && act.data) {
            const eventName = act.data.title || act.data.summary || 'Meeting';
            const targetTask = tasks.find((t) => t.id === act.data.id || (t.title && t.title.toLowerCase().includes(eventName.toLowerCase())));
            const calId = act.data.eventId || targetTask?.calendar_event_id;

            setConfirmDelete({
              tool: 'calendar',
              itemName: eventName,
              itemSubtitle: 'This will remove Recall task, Google Calendar event, and scheduled WhatsApp reminder.',
              onConfirm: async () => {
                if (calId) {
                  try {
                    await fetch('/api/google/calendar/delete', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventId: calId }),
                    });
                  } catch (e) {}
                }
                if (targetTask?.id) {
                  await deleteTask(targetTask.id);
                }
                setUnifiedAction(null);
                setUndoToast({
                  tool: 'calendar',
                  label: `Deleted "${eventName}"`,
                  undoable: true,
                });
                onConnectorPulse?.('calendar');
              },
            });

          // ── ARCHIVE EMAIL (L1) ─────────────────────────────────────────────────
          } else if (act.type === 'archive_email' && act.data?.messageId) {
            try {
              const archRes = await fetch('/api/google/gmail/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'archive', messageId: act.data.messageId, subject: act.data.subject }),
              });
              const archData = await archRes.json();
              if (archData.success) {
                onConnectorPulse?.('gmail');
                setUndoToast({ tool: 'gmail', label: `Archived${act.data.subject ? ` "${act.data.subject}"` : ' email'}`, actionId: archData.actionId, undoable: true });
              } else if (archData.needsScope) {
                setStreamingText('I can do that after you update Gmail permissions.');
              }
            } catch (e) {}

          // ── TRASH EMAIL (L2 — shows confirm) ─────────────────────────────────
          } else if (act.type === 'trash_email' && act.data?.messageId) {
            setConfirmDelete({
              tool: 'gmail',
              itemName: act.data.subject || 'email',
              itemSubtitle: 'Will be moved to Trash',
              onConfirm: async () => {
                try {
                  const trashRes = await fetch('/api/google/gmail/manage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'trash', messageId: act.data.messageId, subject: act.data.subject }),
                  });
                  const trashData = await trashRes.json();
                  if (trashData.success) {
                    onConnectorPulse?.('gmail');
                    setUndoToast({ tool: 'gmail', label: `Moved to Trash`, actionId: trashData.actionId, undoable: true });
                  }
                } catch (e) {}
              },
            });

          // ── MARK EMAIL READ ────────────────────────────────────────────────────
          } else if (act.type === 'mark_email_read' && act.data?.messageId) {
            try {
              await fetch('/api/google/gmail/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'markRead', messageId: act.data.messageId, read: act.data.read !== false, subject: act.data.subject }),
              });
              onConnectorPulse?.('gmail');
            } catch (e) {}

          // ── TRASH DRIVE FILE (L2) ─────────────────────────────────────────────
          } else if (act.type === 'trash_drive_file' && act.data?.fileId) {
            setConfirmDelete({
              tool: 'drive',
              itemName: act.data.fileName || 'file',
              itemSubtitle: 'Will be moved to Drive Trash',
              onConfirm: async () => {
                try {
                  const driveRes = await fetch('/api/google/drive/manage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'trash', fileId: act.data.fileId, fileName: act.data.fileName }),
                  });
                  const driveData = await driveRes.json();
                  if (driveData.success) {
                    onConnectorPulse?.('drive');
                    setUndoToast({ tool: 'drive', label: `Moved "${act.data.fileName || 'file'}" to Trash`, actionId: driveData.actionId, undoable: true });
                  }
                } catch (e) {}
              },
            });

          // ── UNDO LAST ACTION ──────────────────────────────────────────────────
          } else if (act.type === 'undo_last_action') {
            try {
              const undoRes = await fetch('/api/actions/undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              });
              const undoData = await undoRes.json();
              if (undoData.success) {
                setStreamingText(`✓ ${undoData.label ? `Undid: ${undoData.label}` : 'Last action undone.'}`);
                onConnectorPulse?.(undoData.tool || 'recall');
              } else {
                setStreamingText(undoData.error || 'Nothing to undo.');
              }
            } catch (e) {}

          // ── REDO LAST ACTION ──────────────────────────────────────────────────
          } else if (act.type === 'redo_last_action') {
            try {
              const redoRes = await fetch('/api/actions/redo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              });
              const redoData = await redoRes.json();
              if (redoData.success) {
                setStreamingText(`✓ Redone: ${redoData.label || 'action re-applied.'}`);
                onConnectorPulse?.(redoData.tool || 'recall');
              } else {
                setStreamingText(redoData.error || 'Nothing to redo.');
              }
            } catch (e) {}

          // ── SHOW ACTION HISTORY ───────────────────────────────────────────────
          } else if (act.type === 'show_action_history') {
            setIsHistoryOpen(true);
          }
        }

        // CONSTRUCT UNIFIED ACTION RESULT CARD
        if (scheduledActions.length > 0) {
          // Dynamic smooth pacing based on actual step count (~650ms per step)
          const minPacing = Math.max(1000, (dynamicPlan.steps.length - 1) * 650 + 350);
          const elapsed = Date.now() - actionStartTime;
          if (elapsed < minPacing) {
            await new Promise((resolve) => setTimeout(resolve, minPacing - elapsed));
          }

          const count = scheduledActions.length;
          const subheadline = count === 1
            ? '1 event added to Google Calendar & WhatsApp'
            : `${count} events added to Google Calendar & WhatsApp`;

          setUnifiedAction({
            id: `act-${Date.now()}`,
            phase: 'completed',
            title: scheduledActions[0]?.data.title || cleanPrompt,
            headline: 'Done',
            subheadline,
            primaryChannel: 'calendar',
            usedApps: dynamicPlan.usedApps,
            steps: dynamicPlan.steps.map((s) => ({ ...s, status: 'completed' as const })),
            aiReply: data.reply,
            items: scheduledActions.map((act: any) => {
              const rawDue = act.data.start || act.data.due_at || new Date().toISOString();
              const timing = computeEventTimes(rawDue, act.data.end, true);
              return {
                title: act.data.title || cleanPrompt,
                time: timing.timeLabel,
                channel: 'calendar' as const,
                note: act.data.note,
              };
            }),
            linkedIds: {
              taskId: newlyCreatedTasks[0],
              calendarEventId: newlyCreatedCalEvents[0],
            },
          });

          if (newlyCreatedTasks.length > 0) {
            let targetDate: Date | undefined;
            const firstDateStr = scheduledActions[0]?.data?.start || scheduledActions[0]?.data?.due_at;
            if (firstDateStr) {
              try {
                targetDate = new Date(firstDateStr);
              } catch (e) {}
            }
            onItemsCreated?.(newlyCreatedTasks, targetDate);
          }
        } else if (data.actions.some((a: any) => a.type === 'archive_email' || a.type === 'trash_email' || a.type === 'mark_email_read')) {
          const emailAct = data.actions.find((a: any) => a.type === 'archive_email' || a.type === 'trash_email' || a.type === 'mark_email_read');
          setUnifiedAction({
            id: `act-${Date.now()}`,
            phase: 'completed',
            title: textToSend.trim(),
            headline: 'Done',
            subheadline: emailAct?.type === 'archive_email' ? 'Archived email in Gmail' : emailAct?.type === 'trash_email' ? 'Moved email to Trash' : 'Updated Gmail',
            primaryChannel: 'gmail',
            usedApps: ['gmail'],
            steps: dynamicPlan.steps.map((s) => ({ ...s, status: 'completed' as const })),
            aiReply: data.reply,
          });
        } else if (data.actions.some((a: any) => a.type === 'trash_drive_file')) {
          setUnifiedAction({
            id: `act-${Date.now()}`,
            phase: 'completed',
            title: textToSend.trim(),
            headline: 'Done',
            subheadline: 'Moved file to Google Drive Trash',
            primaryChannel: 'drive',
            usedApps: ['drive'],
            steps: dynamicPlan.steps.map((s) => ({ ...s, status: 'completed' as const })),
            aiReply: data.reply,
          });
        } else if (data.generativeUI?.type === 'day_plan' && data.generativeUI.planSlots?.length) {
          setUnifiedAction({
            id: `act-${Date.now()}`,
            phase: 'completed',
            title: textToSend.trim(),
            headline: 'Done',
            subheadline: `${data.generativeUI.planSlots.length} schedule slots organized`,
            primaryChannel: 'recall',
            usedApps: ['calendar', 'whatsapp'],
            steps: dynamicPlan.steps.map((s) => ({ ...s, status: 'completed' as const })),
            aiReply: data.reply,
          });
        } else {
          setUnifiedAction(null);
        }
      }

      if (data.generativeUI) {
        setGenerativeUI(data.generativeUI);
      } else {
        setGenerativeUI(null);
      }

      setPrompt('');
      setAttachedFile(null);

      // Voice response handling - purely visual, no audio spoken aloud
      if (calledFromVoice) {
        setIsLiveVoiceOpen(false);
        setVoiceState('idle');
      }
    } catch (err) {
      console.error('Recall error:', err);
      setStreamingText("Sorry, I couldn't reach the AI service right now.");
      setIsProcessing(false);
      setIsStreaming(false);
      if (calledFromVoice) {
        setIsLiveVoiceOpen(false);
        setVoiceState('idle');
      }
    } finally {
      setVoiceState('idle');
      setIsTyping(false);
    }
  };

  const startVoiceCapture = async () => {
    stopSpeaking();
    setIsLiveVoiceOpen(true);
    setLiveVoicePhase('listening');
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setVoiceState('listening');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      sourceNode.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      lastSoundTimeRef.current = Date.now();

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(avg / 128, 1);
        setAudioVolume(normalized);

        if (normalized > 0.08) {
          lastSoundTimeRef.current = Date.now();
        }

        // Auto pause after 3.5s silence only once actual words were recognized
        if (
          liveTranscriptRef.current.trim().length > 3 &&
          Date.now() - lastSoundTimeRef.current > 3500
        ) {
          finishLiveVoiceAndExecute();
          return;
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

          rec.onresult = (e: any) => {
            let transcript = '';
            for (let i = 0; i < e.results.length; i++) {
              transcript += e.results[i][0].transcript;
            }
            if (transcript.trim()) {
              liveTranscriptRef.current = transcript.trim();
              setLiveTranscript(transcript.trim());
              setPrompt(transcript.trim());
              lastSoundTimeRef.current = Date.now();
            }
          };

          let hasFatalError = false;
          rec.onerror = (e: any) => {
            if (e?.error === 'network' || e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
              hasFatalError = true;
            }
          };

          rec.onend = () => {
            // Keep listening continuously if live voice is still active and no fatal error
            if (!hasFatalError && isLiveVoiceOpenRef.current && liveVoicePhaseRef.current === 'listening') {
              try {
                rec.start();
              } catch (e) {}
            }
          };

          rec.start();
          (mediaRecorderRef as any).currentRecognition = rec;
        } catch (e) {
          console.warn('SpeechRecognition fallback to MediaRecorder', e);
        }
      }

      animFrameRef.current = requestAnimationFrame(checkVolume);

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const supportedType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const mediaRecorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(200);
    } catch (err) {
      console.warn('Voice error:', err);
      setVoiceState('idle');
      setIsLiveVoiceOpen(false);
    }
  };

  const handleToggleVoice = () => {
    if (isLiveVoiceOpen) {
      finishLiveVoiceAndExecute();
    } else {
      startVoiceCapture();
    }
  };

  const finishLiveVoiceAndExecute = async () => {
    if (!isLiveVoiceOpenRef.current && !isLiveVoiceOpen && !isProcessing) return;
    setLiveVoicePhase('understanding');

    // 1. Stop SpeechRecognition
    if ((mediaRecorderRef as any).currentRecognition) {
      try {
        (mediaRecorderRef as any).currentRecognition.stop();
      } catch (e) {}
      (mediaRecorderRef as any).currentRecognition = null;
    }

    // 2. Stop volume analysis loop
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioVolume(0);

    // 3. Gracefully flush and stop MediaRecorder
    let audioBlob: Blob | null = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
      if (audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      }
    } else if (audioChunksRef.current.length > 0) {
      audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }

    // 4. Stop stream tracks and audio context
    stopMicrophoneStream();

    // 5. Query resolution: use live transcript ref if available, or call /api/ai/transcribe fallback
    let query = liveTranscriptRef.current.trim() || liveTranscript.trim() || prompt.trim();

    if (!query && audioBlob && audioBlob.size > 250) {
      setLiveVoicePhase('thinking');
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('audio', audioBlob);
      try {
        const res = await fetch('/api/ai/transcribe', { method: 'POST', body: formData });
        const d = await res.json();
        if (d.success && d.text && d.text.trim()) {
          query = d.text.trim();
          liveTranscriptRef.current = query;
          setLiveTranscript(query);
        }
      } catch (e) {
        console.warn('Transcribe request error:', e);
      }
    }

    if (query) {
      setLiveVoicePhase('thinking');
      handleExecuteInstruction(query, true);
    } else {
      // Nothing was spoken
      setIsLiveVoiceOpen(false);
      setVoiceState('idle');
    }
  };

  finishVoiceRef.current = finishLiveVoiceAndExecute;


  const stopVoiceCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopMicrophoneStream();
  };

  const handleOrbClick = () => {
    if (isLiveVoiceOpen) {
      finishLiveVoiceAndExecute();
    } else {
      startVoiceCapture();
    }
  };

  const handleUndoAction = async () => {
    if (!unifiedAction) return;
    try {
      if (unifiedAction.linkedIds?.taskId) {
        await deleteTask(unifiedAction.linkedIds.taskId);
      }
      if (unifiedAction.linkedIds?.calendarEventId) {
        try {
          await fetch('/api/google/calendar/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: unifiedAction.linkedIds.calendarEventId }),
          });
        } catch (e) {}
      }
      setUnifiedAction(null);
      setStreamingText('Action undone ✓');
      onConnectorPulse?.('calendar');
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyPlanSlots = async (slots: GenerativeUIPlanSlot[]) => {
    for (const slot of slots) {
      await createTask({
        title: slot.title,
        due_at: slot.suggestedDueAt || new Date().toISOString(),
        note: slot.note,
      });
    }
    setGenerativeUI(null);
    setStreamingText('Plan applied to your Recall tasks ✓');
    onTaskCreated?.();
  };

  const handleStartFocus = (title: string, mins: number) => {
    setFocusState({
      active: true,
      title,
      minutesLeft: mins,
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (activeConversationId) formData.append('conversationId', activeConversationId);
    if (projectId) formData.append('projectId', projectId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const d = await res.json();
      if (d.success && d.attachment) {
        setAttachedFile({
          name: file.name,
          type: file.type,
          preview: file.type.startsWith('image/') ? d.attachment.url : undefined,
        });
      }
    } catch (err) {
      setAttachedFile({
        name: file.name,
        type: file.type,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (activeConversationId) formData.append('conversationId', activeConversationId);
    if (projectId) formData.append('projectId', projectId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const d = await res.json();
      if (d.success && d.attachment) {
        setAttachedFile({
          name: file.name,
          type: file.type,
          preview: file.type.startsWith('image/') ? d.attachment.url : undefined,
        });
      }
    } catch (err) {
      setAttachedFile({
        name: file.name,
        type: file.type,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    }
  };

  const orbCurrentState: VoiceOrbState = isProcessing
    ? 'processing'
    : voiceState;

  // Decide if we should render 2-column responsive layout
  const hasComplexLayout = Boolean(generativeUI && streamingText);
  const isDayPlan = generativeUI?.type === 'day_plan' && Boolean(generativeUI.planSlots?.length);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Unified Hero Composer Bar with Inline Voice Transformation */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-[26px] bg-white border p-3 sm:px-4 sm:py-3.5 transition-all duration-300 flex flex-col justify-center ${
          isLiveVoiceOpen
            ? 'min-h-[86px] sm:min-h-[92px] apple-intelligence-composer border-transparent'
            : isDraggingOver
            ? 'min-h-[68px] sm:min-h-[74px] ring-2 ring-blue-500 bg-blue-50/30 border-blue-400'
            : isTyping
            ? 'min-h-[68px] sm:min-h-[74px] composer-typing-aura border-blue-200/90 shadow-[0_8px_30px_rgba(0,82,255,0.12)]'
            : isFocused
            ? 'min-h-[68px] sm:min-h-[74px] border-black/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.06)]'
            : 'min-h-[68px] sm:min-h-[74px] border-black/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.02)]'
        }`}
      >
        {/* Drag over overlay hint */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-30 rounded-[26px] bg-blue-50/90 backdrop-blur-xs flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 pointer-events-none">
            <Upload className="w-4 h-4 animate-bounce" />
            <span>Drop files into Recall</span>
          </div>
        )}

        {/* Attached file preview chip (when not in voice mode) */}
        {!isLiveVoiceOpen && attachedFile && (
          <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-zinc-50 border border-black/[0.05] flex items-center justify-between w-fit gap-2 apple-fade-in">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700">
              {attachedFile.type.startsWith('image/') ? (
                <ImageIcon className="w-3.5 h-3.5 text-[#0052FF]" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-[#0052FF]" />
              )}
              <span className="truncate max-w-[200px]">{attachedFile.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedFile(null)}
              className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isLiveVoiceOpen ? (
          /* Live Voice Inline Transformation within the Bar */
          <div className="flex items-center justify-between gap-3 sm:gap-4 apple-fade-in">
            {/* Left: Reactive Voice Orb */}
            <div className="relative shrink-0 flex items-center pl-0.5">
              <VoiceOrb
                state={
                  liveVoicePhase === 'listening'
                    ? 'listening'
                    : liveVoicePhase === 'speaking'
                    ? 'speaking'
                    : 'processing'
                }
                audioVolume={audioVolume}
                size="md"
                onClick={() => {
                  finishLiveVoiceAndExecute();
                }}
              />
            </div>

            {/* Middle: Live State & Real-time Transcript */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              <div className="flex items-center gap-2">
                {liveVoicePhase === 'listening' && (
                  <span className="text-xs font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#BC82F3] via-[#FF5DA2] to-[#0052FF]">
                    Listening…
                  </span>
                )}
                {liveVoicePhase === 'understanding' && (
                  <span className="text-xs font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#BC82F3] via-[#7928CA] to-[#0052FF]">
                    Understanding…
                  </span>
                )}
                {liveVoicePhase === 'thinking' && (
                  <span className="text-xs font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#FF7A00] via-[#F5B9EA] to-[#BC82F3]">
                    Thinking…
                  </span>
                )}
              </div>

              <div className="truncate">
                {liveTranscript ? (
                  <p className="text-sm font-medium text-zinc-900 tracking-tight truncate">
                    “{liveTranscript}”
                  </p>
                ) : streamingText ? (
                  <p className="text-xs sm:text-sm text-zinc-700 truncate">
                    {streamingText}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 font-normal truncate">
                    Say: &ldquo;Meeting with Rahul tomorrow 4 PM&rdquo;…
                  </p>
                )}
              </div>
            </div>

            {/* Right: Voice Controls */}
            <div className="flex items-center gap-1.5 shrink-0 pr-0.5">
              <button
                type="button"
                onClick={() => {
                  stopMicrophoneStream();
                  setIsLiveVoiceOpen(false);
                  setVoiceState('idle');
                }}
                title="Cancel voice (Esc)"
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={finishLiveVoiceAndExecute}
                title="Submit voice (Enter)"
                className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5 -rotate-12 translate-x-[-0.5px]" />
              </button>
            </div>
          </div>

        ) : (
          /* Standard Hero Composer Input Form */
          <div className="relative">
            {/* Floating Slash Command Menu (Opens BELOW input box, clean monochrome black & white, no icons) */}
            {prompt.startsWith('/') && !isProcessing && filteredSlashCommands.length > 0 && (
              <div
                ref={slashMenuRef}
                className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl bg-white dark:bg-[#18181b] backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 max-h-72 overflow-y-auto select-none"
              >
                <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-black/[0.05] dark:border-white/[0.06] mb-1">
                  <span>Commands</span>
                  <span>↑↓ navigate · ↵ select</span>
                </div>

                {filteredSlashCommands.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onMouseEnter={() => setSelectedSlashIndex(idx)}
                    onClick={() => handleSelectSlashCommand(cmd)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors cursor-pointer text-xs h-9 ${
                      selectedSlashIndex === idx
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.08] text-zinc-900 dark:text-zinc-100 border border-black/[0.06] dark:border-white/[0.08] shrink-0">
                        {cmd.command}
                      </span>
                      <span className="truncate text-zinc-800 dark:text-zinc-200">
                        {cmd.label}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 shrink-0">
                      {selectedSlashIndex === idx ? '↵' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                let fullInstruction = prompt.trim();
                if (activeSlashCommand) {
                  if (fullInstruction) {
                    fullInstruction = `${activeSlashCommand.command} ${fullInstruction}`;
                  } else if (activeSlashCommand.defaultPrompt) {
                    fullInstruction = activeSlashCommand.defaultPrompt;
                  } else {
                    fullInstruction = activeSlashCommand.command;
                  }
                  setActiveSlashCommand(null);
                }
                if (fullInstruction) {
                  setPrompt('');
                  handleExecuteInstruction(fullInstruction);
                }
              }}
              className="flex items-center gap-2 sm:gap-2.5"
            >
              {/* Recall Voice Orb */}
              <div className="relative shrink-0 flex items-center pl-0.5">
                <VoiceOrb
                  state={orbCurrentState}
                  audioVolume={audioVolume}
                  size="md"
                  onClick={handleToggleVoice}
                />
              </div>

              {/* Active Slash Command Highlight (ChatGPT Style, Blue Pill) */}
              {activeSlashCommand && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-[#0052FF] dark:text-blue-400 font-mono text-xs font-semibold select-none border border-blue-500/25 shrink-0 animate-in fade-in zoom-in-95 duration-100">
                  <span>{activeSlashCommand.command}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSlashCommand(null);
                      inputRef.current?.focus();
                    }}
                    className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 transition-colors ml-0.5 cursor-pointer"
                    title="Remove command"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              )}

              {/* Natural prompt input */}
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setIsFocused(false);
                  setIsTyping(false);
                }}
                disabled={isProcessing}
                placeholder={
                  activeSlashCommand
                    ? activeSlashCommand.placeholder || 'Type instructions or press Enter…'
                    : 'Ask Recall anything, speak, or type / for commands…'
                }
                style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)', caretColor: '#0052FF' }}
                className="flex-1 bg-transparent text-sm sm:text-[15px] !text-zinc-900 dark:!text-[#ececec] placeholder:!text-zinc-400 dark:placeholder:!text-zinc-500 outline-none border-none tracking-tight font-normal"
              />

            {/* Right Action Icons: ONLY [+] and [mic / send] */}
            <div className="flex items-center gap-1.5 shrink-0 pr-0.5">
              {/* Hidden upload input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="*/*"
              />

              {/* + Attachment Menu Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttachmentMenu(!showAttachmentMenu);
                  }}
                  title="Attach file, add task, or connect apps"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2]" />
                </button>

                {showAttachmentMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-2.5 z-50 w-56 sm:w-60 p-2 rounded-[22px] bg-white border border-black/[0.08] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.16)] space-y-1 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'image/*';
                          fileInputRef.current.click();
                        }
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 shrink-0 group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-[18px] h-[18px]" />
                      </div>
                      <span>Photo / Screenshot</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
                          fileInputRef.current.click();
                        }
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-[18px] h-[18px]" />
                      </div>
                      <span>PDF or File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        onOpenTaskComposer?.();
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-zinc-100 text-zinc-700 shrink-0 group-hover:scale-105 transition-transform">
                        <CheckSquare className="w-[18px] h-[18px]" />
                      </div>
                      <span>Add task</span>
                    </button>

                    <div className="border-t border-black/[0.05] my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        onConnectorPulse?.('drive');
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-emerald-50/80 border border-emerald-100/50 shrink-0 group-hover:scale-105 transition-transform">
                        <PluginIcon id="drive" size={20} />
                      </div>
                      <span>Google Drive</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        onConnectorPulse?.('notion');
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-zinc-100 border border-black/[0.04] shrink-0 group-hover:scale-105 transition-transform">
                        <PluginIcon id="notion" size={20} />
                      </div>
                      <span>Notion</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Mic or Send Button */}
              {!prompt.trim() && !attachedFile ? (
                <button
                  type="button"
                  onClick={startVoiceCapture}
                  title="Voice mode"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isProcessing}
                  title="Send"
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-900 hover:bg-black text-white shadow-2xs active:scale-95 cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5 -rotate-12 translate-x-[-0.5px]" />
                </button>
              )}
            </div>
          </form>
          </div>
        )}
      </div>

      <PlanningProgressCard state={planningMachine} />

      {proposedPlan && (
        <ProposedPlanCard
          items={proposedPlan.items}
          summary={proposedPlan.reply}
          autoSave={autoSave}
          isApplying={isApplyingPlan}
          onChange={(items) =>
            setProposedPlan((current) => (current ? { ...current, items } : current))
          }
          onApprove={(items) =>
            executeProposedPlan(items, proposedPlan.actions)
          }
          onDismiss={() => {
            setProposedPlan(null);
            setStreamingText('No changes were made.');
            setPlanningMachine({ phase: 'idle', steps: [] });
          }}
        />
      )}

      {/* Unified Action Card: Single Progress Card that Transforms into Final Result */}
      {unifiedAction && (
        <UnifiedActionCard
          data={unifiedAction}
          onUndo={handleUndoAction}
          onSelectRecommendation={(p) => handleExecuteInstruction(p)}
          onDismiss={() => setUnifiedAction(null)}
        />
      )}

      {/* INLINE AI WORKSPACE (Rendered for pure chat / complex generative UI / full conversation thread) */}
      {(chatMessages.length > 0 || streamingText || generativeUI) && !unifiedAction && !proposedPlan && planningMachine.phase === 'idle' && (
        <div className="apple-slide-down">
          {/* Day Plan Complex Workspace */}
          {isDayPlan ? (
            <DayPlanWorkspace
              replyText={streamingText || 'I organized your schedule around your meetings.'}
              slots={generativeUI!.planSlots!}
              onDismiss={() => {
                setStreamingText('');
                setGenerativeUI(null);
              }}
            />
          ) : chatMessages.length > 0 ? (
            /* Full Multi-Turn Conversation Thread (ChatGPT Style) */
            <div className="rounded-[24px] bg-white/95 dark:bg-zinc-900/95 border border-black/[0.08] dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur-2xl flex flex-col gap-4">
              {/* Header with Title, Message Count, New Chat, and Close */}
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/recall-logo.png" alt="Recall" className="w-3.5 h-3.5 object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white">
                        Recall Chat
                      </h3>
                      {activeConversationId && (
                        <Link
                          href={`/chat/${activeConversationId}`}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 ml-1 font-medium"
                          title="Open dedicated page for this chat"
                        >
                          <span>Full page</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {chatMessages.length} {chatMessages.length === 1 ? 'message' : 'messages'} · Saved in data/conversations.json
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversationId(null);
                      setChatMessages([]);
                      setStreamingText('');
                      setGenerativeUI(null);
                      try {
                        window.history.replaceState({}, '', '/');
                      } catch {}
                      window.dispatchEvent(new CustomEvent('recall-conversations-changed'));
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer flex items-center gap-1"
                    title="Start fresh chat"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const allText = chatMessages
                        .map((m) => `${m.role === 'user' ? 'You' : 'Recall'}: ${m.content}`)
                        .join('\n\n');
                      navigator.clipboard.writeText(allText);
                      setIsCopiedResponse(true);
                      setTimeout(() => setIsCopiedResponse(false), 1800);
                    }}
                    className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Copy conversation"
                  >
                    {isCopiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversationId(null);
                      setChatMessages([]);
                      setStreamingText('');
                      setGenerativeUI(null);
                      try {
                        window.history.replaceState({}, '', '/');
                      } catch {}
                    }}
                    className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Close chat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable messages container */}
              <div
                ref={chatScrollRef}
                className="max-h-[460px] overflow-y-auto space-y-4 pr-1 scrollbar-thin"
              >
                {chatMessages.map((msg, idx) => (
                  <div key={msg.id || idx} className="space-y-1">
                    {msg.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-zinc-900 text-white dark:bg-[#ececec] dark:text-[#171717] px-4 py-2.5 text-xs sm:text-sm font-medium shadow-2xs leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 w-full bg-zinc-50/70 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-3.5">
                        <div className="flex items-center justify-between pb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/recall-logo.png" alt="Recall" className="w-2.5 h-2.5 object-contain" />
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              Recall
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            title="Copy response"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                          <FormattedAIResponse content={msg.content} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Live streaming for ongoing reply */}
                {isStreaming && streamingText && (
                  <div className="flex flex-col gap-1 w-full bg-zinc-50/70 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-3.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 pb-1">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/recall-logo.png" alt="Recall" className="w-2.5 h-2.5 object-contain" />
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        Recall
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      <FormattedAIResponse content={streamingText} isStreaming={true} />
                    </div>
                  </div>
                )}

                {/* Thinking state */}
                {isProcessing && !isStreaming && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400 py-2 px-3 bg-zinc-50/70 dark:bg-zinc-800/50 rounded-xl w-fit">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Recall is thinking…</span>
                  </div>
                )}
              </div>

              {/* Generative UI attachment if present */}
              {generativeUI && (
                <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                  <GenerativeUIView
                    data={generativeUI}
                    onApplyPlan={handleApplyPlanSlots}
                    onStartFocus={handleStartFocus}
                    onSelectOption={(opt) => handleExecuteInstruction(`My answer is ${opt}`)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[24px] bg-white/95 dark:bg-zinc-900/95 border border-black/[0.08] dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur-2xl">
              {hasComplexLayout ? (
                /* Responsive Grid: 40% Left conversation summary, 60% Right generative UI */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Left Column: AI Conversation */}
                  <div className="md:col-span-5 flex flex-col gap-3 pr-1">
                    <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center shadow-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/recall-logo.png" alt="Recall" className="w-3.5 h-3.5 object-contain" />
                        </div>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white">Recall Assistant</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (streamingText) {
                              navigator.clipboard.writeText(streamingText);
                              setIsCopiedResponse(true);
                              setTimeout(() => setIsCopiedResponse(false), 1800);
                            }
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                          title="Copy response"
                        >
                          {isCopiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            setStreamingText('');
                            setGenerativeUI(null);
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                          title="Close workspace"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <FormattedAIResponse content={streamingText} isStreaming={isStreaming} />
                  </div>

                  {/* Right Column: Editable Generative UI */}
                  <div className="md:col-span-7">
                    <GenerativeUIView
                      data={generativeUI!}
                      onApplyPlan={handleApplyPlanSlots}
                      onStartFocus={handleStartFocus}
                      onSelectOption={(opt) => handleExecuteInstruction(`My answer is ${opt}`)}
                    />
                  </div>
                </div>
              ) : (
                /* Single column inline display for simple answers */
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] flex items-center justify-center shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/recall-logo.png" alt="Recall" className="w-3.5 h-3.5 object-contain" />
                      </div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-white">Recall Assistant</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {streamingText && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(streamingText);
                            setIsCopiedResponse(true);
                            setTimeout(() => setIsCopiedResponse(false), 1800);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                          title="Copy response"
                        >
                          {isCopiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setStreamingText('');
                          setGenerativeUI(null);
                        }}
                        className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {streamingText && (
                    <FormattedAIResponse content={streamingText} isStreaming={isStreaming} />
                  )}

                  {generativeUI && (
                    <GenerativeUIView
                      data={generativeUI}
                      onApplyPlan={handleApplyPlanSlots}
                      onStartFocus={handleStartFocus}
                      onSelectOption={(opt) => handleExecuteInstruction(`My answer is ${opt}`)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Focus Mode Overlay */}
      {focusState?.active && (
        <div className="rounded-2xl bg-zinc-900 text-white p-4 flex items-center justify-between shadow-lg apple-fade-in">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-400">Deep Focus</span>
            <span className="text-sm font-semibold tracking-tight">
              {focusState.title}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-indigo-300">
              {focusState.minutesLeft} min
            </span>
            <button
              onClick={() => setFocusState(null)}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {undoToast && (
        <UndoToast
          tool={undoToast.tool as any}
          label={undoToast.label}
          actionId={undoToast.actionId}
          undoable={undoToast.undoable}
          onUndo={async (id) => {
            const res = await fetch('/api/actions/undo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ actionId: id }),
            });
            const data = await res.json();
            if (data.success) {
              setStreamingText(`✓ ${data.label ? `Undid: ${data.label}` : 'Action undone.'}`);
            }
          }}
          onExpire={() => setUndoToast(null)}
        />
      )}

      {/* Bulk Preview Modal */}
      {bulkPreview && (
        <BulkPreviewModal
          isOpen={Boolean(bulkPreview)}
          onClose={() => setBulkPreview(null)}
          tool={bulkPreview.tool}
          actionLabel={bulkPreview.actionLabel}
          itemsLabel={bulkPreview.itemsLabel}
          dateLabel={bulkPreview.dateLabel}
          items={bulkPreview.items}
          onConfirm={async (selectedIds) => {
            const res = await fetch('/api/google/calendar/delete', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventIds: selectedIds }),
            });
            const data = await res.json();
            if (data.success) {
              setStreamingText(`✓ Deleted ${data.deleted} calendar events.`);
              setUndoToast({
                tool: 'calendar',
                label: `Deleted ${data.deleted} events`,
                actionId: data.actionId,
                undoable: true,
              });
            }
            setBulkPreview(null);
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          tool={confirmDelete.tool}
          itemName={confirmDelete.itemName}
          itemSubtitle={confirmDelete.itemSubtitle}
          onConfirm={confirmDelete.onConfirm}
        />
      )}

      {/* Action History Dropdown */}
      {isHistoryOpen && (
        <ActionHistory
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onUndoAction={async (actionId) => {
            const res = await fetch('/api/actions/undo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ actionId }),
            });
            const data = await res.json();
            if (data.success) {
              setStreamingText(`✓ ${data.label ? `Undid: ${data.label}` : 'Action undone.'}`);
            }
          }}
        />
      )}
    </div>
  );
};
