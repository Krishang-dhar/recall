'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskPriority } from '@/lib/types';
import { X, Mic, Loader2, Calendar, CheckSquare, Clock, MapPin, Trash2 } from 'lucide-react';
import { Portal } from './Portal';

interface TaskComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: {
    id?: string;
    title: string;
    note?: string | null;
    due_at: string;
    end_time?: string | null;
    priority?: TaskPriority;
    location?: string | null;
    is_meeting?: boolean;
  }) => void;
  onDelete?: (id: string) => void;
  initialTask?: Task | null;
}

export const TaskComposer: React.FC<TaskComposerProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
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

  // Default end time (30 mins after start time)
  const defaultEndDate = initialTask?.end_time
    ? new Date(initialTask.end_time)
    : new Date(defaultDate.getTime() + 30 * 60 * 1000);
  const endTimeString = `${String(defaultEndDate.getHours()).padStart(2, '0')}:${String(
    defaultEndDate.getMinutes()
  ).padStart(2, '0')}`;

  const [isMeeting, setIsMeeting] = useState<boolean>(initialTask?.is_meeting ?? false);
  const [title, setTitle] = useState(initialTask?.title || '');
  const [note, setNote] = useState(initialTask?.note || '');
  const [date, setDate] = useState(dateString);
  const [startTime, setStartTime] = useState(timeString);
  const [endTime, setEndTime] = useState(endTimeString);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [location, setLocation] = useState(initialTask?.location || '');
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || 'medium');
  const [isListening, setIsListening] = useState(false);
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Calculate duration whenever start or end time changes
  const applyDuration = (mins: number) => {
    setDurationMinutes(mins);
    const [h, m] = startTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + mins, 0, 0);
    setEndTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

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
        if (data.data.location) setLocation(data.data.location);
        if (data.data.is_meeting !== undefined) setIsMeeting(Boolean(data.data.is_meeting));
        if (data.data.due_at) {
          const parsedD = new Date(data.data.due_at);
          setDate(parsedD.toISOString().split('T')[0]);
          setStartTime(
            `${String(parsedD.getHours()).padStart(2, '0')}:${String(
              parsedD.getMinutes()
            ).padStart(2, '0')}`
          );
          if (data.data.end_time) {
            const parsedEnd = new Date(data.data.end_time);
            setEndTime(
              `${String(parsedEnd.getHours()).padStart(2, '0')}:${String(
                parsedEnd.getMinutes()
              ).padStart(2, '0')}`
            );
          }
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
    const [startH, startM] = startTime.split(':').map(Number);
    const combinedStartDate = new Date(year, month - 1, day, startH, startM);

    let combinedEndDate: Date | null = null;
    if (isMeeting && endTime) {
      const [endH, endM] = endTime.split(':').map(Number);
      combinedEndDate = new Date(year, month - 1, day, endH, endM);
      // If end time is before start time, assume next day
      if (combinedEndDate < combinedStartDate) {
        combinedEndDate.setDate(combinedEndDate.getDate() + 1);
      }
    }

    onSave({
      id: initialTask?.id,
      title: title.trim(),
      note: note.trim() || null,
      due_at: combinedStartDate.toISOString(),
      end_time: combinedEndDate ? combinedEndDate.toISOString() : null,
      priority,
      location: location.trim() || null,
      is_meeting: isMeeting,
    });
    onClose();
  };

  const handleDelete = () => {
    if (initialTask?.id && onDelete) {
      onDelete(initialTask.id);
      onClose();
    }
  };

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-[24px] bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.22)] max-h-[90vh] overflow-y-auto"
        >
          {/* Header & Type Toggle */}
          <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.05] dark:border-white/[0.06]">
            {/* Segmented Control: Task vs Meeting */}
            <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsMeeting(false)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  !isMeeting
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Task</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMeeting(true)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  isMeeting
                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Meeting</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-3.5">
            {/* Title with Inline Microphone */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                {isMeeting ? 'Meeting Title' : 'Task Title'}
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isMeeting
                      ? 'e.g. 1:1 with Alex, Team Standup, Client Pitch...'
                      : 'What do you need to do?'
                  }
                  style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm !text-zinc-900 dark:!text-zinc-100 placeholder:!text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#0052FF] focus:border-[#0052FF]"
                />
                <button
                  type="button"
                  onClick={startTaskVoice}
                  title="Speak details"
                  className={`absolute right-2.5 p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isListening
                      ? 'bg-[#0052FF] text-white animate-pulse shadow-[0_0_12px_rgba(0,82,255,0.4)]'
                      : isParsingVoice
                      ? 'text-[#0052FF]'
                      : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-black/[0.04]'
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
                  Listening… speak meeting title and time naturally
                </span>
              )}
            </div>

            {/* Date Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Date
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDateChip(0)}
                    className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateChip(1)}
                    className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateChip(7)}
                    className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                  >
                    Next week
                  </button>
                </div>
              </div>

              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs !text-zinc-900 dark:!text-zinc-100 outline-none"
              />
            </div>

            {/* Time / Duration Row */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    {isMeeting ? 'Start Time' : 'Time'}
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs !text-zinc-900 dark:!text-zinc-100 outline-none"
                  />
                </div>

                {isMeeting ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs !text-zinc-900 dark:!text-zinc-100 outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Meeting duration quick chips */}
              {isMeeting && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-zinc-400 mr-1">Duration:</span>
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => applyDuration(mins)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        durationMinutes === mins
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-black/[0.06] hover:bg-zinc-100'
                      }`}
                    >
                      {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location / Meeting link */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                {isMeeting ? 'Location or Link' : 'Location (optional)'}
              </label>
              <div className="relative flex items-center">
                <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={
                    isMeeting
                      ? 'e.g. Google Meet, Zoom, Boardroom A, or Address'
                      : 'e.g. Office, Home, Coffee shop'
                  }
                  style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                  className="w-full pl-8 pr-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs !text-zinc-900 dark:!text-zinc-100 placeholder:!text-zinc-400 outline-none"
                />
              </div>
            </div>

            {/* Notes / Agenda */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                {isMeeting ? 'Agenda & Notes' : 'Notes (optional)'}
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isMeeting
                    ? 'Discussion topics, attendees, or context...'
                    : 'Add extra context or details...'
                }
                style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs !text-zinc-900 dark:!text-zinc-100 placeholder:!text-zinc-400 outline-none resize-none"
              />
            </div>

            {/* Footer Buttons with Clean Delete */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
              {initialTask?.id && onDelete ? (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 rounded-xl text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="py-2 px-3 rounded-xl text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  {initialTask ? 'Save Changes' : isMeeting ? 'Schedule Meeting' : 'Add Task'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};
