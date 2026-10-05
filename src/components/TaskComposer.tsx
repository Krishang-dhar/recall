'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskPriority } from '@/lib/types';
import { X, Mic, Loader2 } from 'lucide-react';
import { parseNaturalLanguageTask } from '@/lib/gemini';
import { Portal } from './Portal';

interface TaskComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: {
    id?: string;
    title: string;
    note?: string | null;
    due_at: string;
    priority?: TaskPriority;
  }) => void;
  initialTask?: Task | null;
}

export const TaskComposer: React.FC<TaskComposerProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
}) => {
  if (!isOpen) return null;

  const defaultDate = initialTask
    ? new Date(initialTask.due_at)
    : new Date(Date.now() + 60 * 60 * 1000);

  const dateString = defaultDate.toISOString().split('T')[0];
  const timeString = `${String(defaultDate.getHours()).padStart(2, '0')}:${String(
    defaultDate.getMinutes()
  ).padStart(2, '0')}`;

  const [title, setTitle] = useState(initialTask?.title || '');
  const [note, setNote] = useState(initialTask?.note || '');
  const [date, setDate] = useState(dateString);
  const [time, setTime] = useState(timeString);
  const [isListening, setIsListening] = useState(false);
  const [isParsingVoice, setIsParsingVoice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleVoiceExtract = async (speechText: string) => {
    setIsParsingVoice(true);
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: speechText,
          referenceTime: new Date().toISOString(),
          timeZone: 'Asia/Kolkata',
        }),
      });
      const data = await res.json();
      if (data.data) {
        setTitle(data.data.title || speechText);
        if (data.data.note) setNote(data.data.note);
        if (data.data.due_at) {
          const parsedD = new Date(data.data.due_at);
          setDate(parsedD.toISOString().split('T')[0]);
          setTime(
            `${String(parsedD.getHours()).padStart(2, '0')}:${String(
              parsedD.getMinutes()
            ).padStart(2, '0')}`
          );
        }
      }
    } catch (e) {
      console.warn('Voice parse fallback:', e);
      setTitle(speechText);
    } finally {
      setIsParsingVoice(false);
    }
  };

  const startTaskVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsListening(true);

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = false;
          rec.interimResults = false;
          rec.lang = 'en-IN';

          rec.onresult = (e: any) => {
            const transcript = e.results[0]?.[0]?.transcript;
            if (transcript) {
              handleVoiceExtract(transcript.trim());
            }
          };

          rec.onend = () => {
            setIsListening(false);
            stream.getTracks().forEach((t) => t.stop());
          };

          rec.start();
          return;
        } catch (e) {}
      }

      // MediaRecorder fallback
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsListening(false);

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob);

          try {
            const res = await fetch('/api/ai/transcribe', {
              method: 'POST',
              body: formData,
            });
            const d = await res.json();
            if (d.success && d.text) {
              handleVoiceExtract(d.text);
            }
          } catch (err) {
            console.error(err);
          }
        }
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 5000);
    } catch (err) {
      console.warn('Mic error:', err);
      setIsListening(false);
    }
  };

  const setDateChip = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const combinedDate = new Date(year, month - 1, day, hours, minutes);

    onSave({
      id: initialTask?.id,
      title: title.trim(),
      note: note.trim() || null,
      due_at: combinedDate.toISOString(),
      priority: 'medium',
    });
    onClose();
  };

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-[24px] bg-white border border-black/[0.08] p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.22)]"
        >
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.04]">
          <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
            {initialTask ? 'Edit Task' : 'Add task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-3">
          {/* Task Title with Inline Microphone */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
              Task
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you need to do?"
                style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm !text-zinc-900 dark:!text-[#ececec] placeholder:!text-zinc-400 dark:placeholder:!text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0052FF] focus:border-[#0052FF]"
              />
              <button
                type="button"
                onClick={startTaskVoice}
                title="Speak task"
                className={`absolute right-2.5 p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-[#0052FF] text-white animate-pulse shadow-[0_0_12px_rgba(0,82,255,0.4)]'
                    : isParsingVoice
                    ? 'text-[#0052FF]'
                    : 'text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04]'
                }`}
              >
                {isParsingVoice ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            {isListening && (
              <span className="text-[11px] text-[#0052FF] font-medium mt-1 block animate-pulse">
                Listening… speak your task & time naturally
              </span>
            )}
          </div>

          {/* Quick Date Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                When
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDateChip(0)}
                  className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateChip(1)}
                  className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition-colors cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setDateChip(7)}
                  className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition-colors cursor-pointer"
                >
                  Next week
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs !text-zinc-900 dark:!text-[#ececec] outline-none"
              />
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs !text-zinc-900 dark:!text-[#ececec] outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add extra context or details..."
              style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs !text-zinc-900 dark:!text-[#ececec] placeholder:!text-zinc-400 dark:placeholder:!text-zinc-500 outline-none resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-black/[0.04]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-black transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              {initialTask ? 'Save' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};
