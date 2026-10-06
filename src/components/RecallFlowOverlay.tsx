'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceOrb, VoiceOrbState } from './VoiceOrb';
import { Check, X, AlertCircle, Mic } from 'lucide-react';
import { PluginIcon } from './PluginIcon';

type FlowPhase =
  | 'idle'
  | 'listening'
  | 'understanding'
  | 'writing'
  | 'acting'
  | 'ask'
  | 'success'
  | 'needs_choice'
  | 'error';

interface RecallFlowChoice {
  id: 'write' | 'action';
  label: string;
}

export const RecallFlowOverlay: React.FC = () => {
  // Floating Orb vs Expanded Capsule
  const [isExpanded, setIsExpanded] = useState(false);
  const [phase, setPhase] = useState<FlowPhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [volume, setVolume] = useState(0);
  const [resultHeadline, setResultHeadline] = useState('Done');
  const [resultDetails, setResultDetails] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  const [toolInfo, setToolInfo] = useState<{ calendar?: boolean; whatsapp?: boolean; task?: boolean }>({});
  const [choices, setChoices] = useState<RecallFlowChoice[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [isDirectlyInserted, setIsDirectlyInserted] = useState<boolean | null>(null);
  const [copySuccessText, setCopySuccessText] = useState('Copy');
  const [isRewriting, setIsRewriting] = useState(false);
  const [floatingOrbEnabled, setFloatingOrbEnabled] = useState(true);
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);

  // Draggable coordinates (remembered across sessions)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  // References
  const activeElementRef = useRef<HTMLElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const selectionRangeRef = useRef<{ start: number; end: number; text: string } | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const hasSpokenRef = useRef(false);
  const transcriptRef = useRef('');

  // ── 1. INITIALIZATION & POSITION MEMORY ──────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recall_flow_position');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.max(16, Math.min(window.innerWidth - 340, parsed.x));
          const clampedY = Math.max(16, Math.min(window.innerHeight - 80, parsed.y));
          setPosition({ x: clampedX, y: clampedY });
        }
      } else {
        const defaultX = Math.max(16, window.innerWidth - 80);
        const defaultY = Math.max(16, window.innerHeight - 88);
        setPosition({ x: defaultX, y: defaultY });
      }

      const onboardingCompleted = localStorage.getItem('recall_demo_onboarding_completed') === 'true';
      setIsOnboardingActive(!onboardingCompleted);

      const guideSeen = localStorage.getItem('recall_flow_guide_seen');
      if (!guideSeen && onboardingCompleted) {
        setShowGuide(true);
      }

      const settingsRaw = localStorage.getItem('recall_flow_settings');
      if (settingsRaw) {
        const parsed = JSON.parse(settingsRaw);
        if (typeof parsed.floatingOrbEnabled === 'boolean') {
          setFloatingOrbEnabled(parsed.floatingOrbEnabled);
        }
      }
    } catch {}

    const handleOpenOnboarding = () => {
      setIsOnboardingActive(true);
      setShowGuide(false);
    };

    const handleCloseOnboarding = () => {
      setIsOnboardingActive(false);
      const guideSeen = localStorage.getItem('recall_flow_guide_seen');
      if (!guideSeen) {
        setShowGuide(true);
      }
    };

    window.addEventListener('open-demo-onboarding', handleOpenOnboarding);
    window.addEventListener('recall-onboarding-closed', handleCloseOnboarding);

    const handleSettingsEvent = (e: any) => {
      if (e.detail && typeof e.detail.floatingOrbEnabled === 'boolean') {
        setFloatingOrbEnabled(e.detail.floatingOrbEnabled);
      }
    };
    window.addEventListener('recall-flow-settings-changed', handleSettingsEvent);

    // Global active element & selection tracker: remembers exact focused field
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (containerRef.current && containerRef.current.contains(target)) return;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true' ||
        target.getAttribute('role') === 'textbox'
      ) {
        lastFocusedElementRef.current = target;
        activeElementRef.current = target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          selectionRangeRef.current = {
            start: target.selectionStart || 0,
            end: target.selectionEnd || 0,
            text: target.value.substring(target.selectionStart || 0, target.selectionEnd || 0),
          };
        }
      }
    };

    const handleSelectionChange = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
        if (!containerRef.current?.contains(active)) {
          lastFocusedElementRef.current = active;
          activeElementRef.current = active;
          selectionRangeRef.current = {
            start: active.selectionStart || 0,
            end: active.selectionEnd || 0,
            text: active.value.substring(active.selectionStart || 0, active.selectionEnd || 0),
          };
        }
      }
    };

    window.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('selectionchange', handleSelectionChange, true);
    return () => {
      window.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('selectionchange', handleSelectionChange, true);
      window.removeEventListener('recall-flow-settings-changed', handleSettingsEvent);
      window.removeEventListener('open-demo-onboarding', handleOpenOnboarding);
      window.removeEventListener('recall-onboarding-closed', handleCloseOnboarding);
    };
  }, []);

  const dismissGuide = () => {
    setShowGuide(false);
    try {
      localStorage.setItem('recall_flow_guide_seen', 'true');
    } catch {}
  };

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // ── 2. AUTOMATIC SILENCE DETECTION (VAD) ─────────────────────────────────

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (!hasSpokenRef.current) return;

    // Detect 1.3s of pause and auto-finalize
    silenceTimerRef.current = setTimeout(() => {
      if (hasSpokenRef.current && transcriptRef.current.trim().length > 0) {
        stopAndProcess();
      }
    }, 1300);
  }, []);

  // ── 3. SHORTCUT LISTENERS (Option+Space, Enter, Escape) ─────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isOptionSpace = e.altKey && (e.code === 'Space' || e.key === ' ');

      if (isOptionSpace) {
        e.preventDefault();
        e.stopPropagation();
        if (isExpanded) {
          if (phase === 'listening') {
            stopAndProcess();
          } else {
            collapseToOrb();
          }
        } else {
          startRecallFlow();
        }
      }

      // Enter key finishes speech immediately
      if (e.key === 'Enter' && isExpanded && phase === 'listening') {
        e.preventDefault();
        e.stopPropagation();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        stopAndProcess();
      }

      // Escape key cancels and collapses back to orb
      if (e.key === 'Escape' && isExpanded) {
        e.preventDefault();
        collapseToOrb();
      }
    }

    function handleCustomTrigger() {
      if (!isExpanded) startRecallFlow();
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('trigger-recall-flow', handleCustomTrigger);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('trigger-recall-flow', handleCustomTrigger);
    };
  }, [isExpanded, phase]);

  // ── 4. ACTIVATION (ORB -> EXPANDED CAPSULE) ─────────────────────────────

  const startRecallFlow = async () => {
    dismissGuide();

    // 1. Capture active editable element
    const active = document.activeElement as HTMLElement | null;
    activeElementRef.current = active;

    if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
      selectionRangeRef.current = {
        start: active.selectionStart || 0,
        end: active.selectionEnd || 0,
        text: active.value.substring(active.selectionStart || 0, active.selectionEnd || 0),
      };
    } else {
      const sel = window.getSelection();
      selectionRangeRef.current = {
        start: 0,
        end: 0,
        text: sel ? sel.toString() : '',
      };
    }

    setIsExpanded(true);
    setPhase('listening');
    setTranscript('');
    setResultHeadline('Done');
    setResultDetails('');
    setAskAnswer('');
    setToolInfo({});
    setChoices([]);
    setErrorMessage('');
    setIsDirectlyInserted(null);
    setCopySuccessText('Copy');
    setIsRewriting(false);
    hasSpokenRef.current = false;
    abortControllerRef.current = new AbortController();

    // 2. Start microphone, audio analyser, and media recorder
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // MediaRecorder safety net
        try {
          audioChunksRef.current = [];
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };
          recorder.start(100);
          mediaRecorderRef.current = recorder;
        } catch (recErr) {
          console.warn('MediaRecorder notice:', recErr);
        }

        // Web Audio Analyser for volume visualization
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const checkVolume = () => {
            if (!streamRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const vol = Math.min(1, avg / 128);
            setVolume(vol);

            if (vol > 0.15) {
              hasSpokenRef.current = true;
              resetSilenceTimer();
            }

            requestAnimationFrame(checkVolume);
          };
          checkVolume();
        }
      }
    } catch (e) {
      console.warn('Microphone permission notice:', e);
    }

    // 3. Web Speech Recognition (corrected loop: loops through 0 to results.length)
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let interimStr = '';
          let finalStr = '';
          for (let i = 0; i < event.results.length; i++) {
            const piece = event.results[i];
            if (piece.isFinal) {
              finalStr += piece[0].transcript + ' ';
            } else {
              interimStr += piece[0].transcript;
            }
          }
          const full = (finalStr + interimStr).trim();
          if (full.length > 0) {
            setTranscript(full);
            transcriptRef.current = full;
            hasSpokenRef.current = true;
            resetSilenceTimer();
          }
        };

        rec.onerror = (err: any) => {
          console.warn('Speech recognition notice:', err);
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (e) {
        console.warn('SpeechRec start notice:', e);
      }
    }
  };

  const scheduleCollapse = (ms: number) => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => {
      collapseToOrb();
    }, ms);
  };

  // ── 5. STOP & PROCESS (OUTPUT MUST NEVER BE LOST) ────────────────────────

  const stopAndProcess = async (overrideIntent?: 'write' | 'action' | 'ask') => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    cleanupMicrophone();

    let textToProcess = transcriptRef.current.trim();

    // Audio base64 backup if transcript wasn't populated by SpeechRec
    let audioBase64: string | undefined = undefined;
    if (!textToProcess && audioChunksRef.current.length > 0) {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        audioBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const res = (reader.result as string) || '';
            const base64 = res.split(',')[1] || '';
            resolve(base64);
          };
          reader.readAsDataURL(audioBlob);
        });
      } catch (err) {
        console.warn('Audio base64 notice:', err);
      }
    }

    if (!textToProcess && !audioBase64) {
      setPhase('error');
      setErrorMessage("Didn't catch that.");
      scheduleCollapse(2000);
      return;
    }

    // Immediately show "Understanding…" — DO NOT HIDE OR DISAPPEAR!
    setPhase('understanding');

    try {
      let flowPrefs: any = undefined;
      try {
        const raw = localStorage.getItem('recall_flow_settings');
        if (raw) flowPrefs = JSON.parse(raw);
      } catch {}

      const res = await fetch('/api/ai/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToProcess,
          audioBase64: audioBase64,
          mimeType: 'audio/webm',
          context: {
            activeApplication: 'recall-web',
            selectedText: selectionRangeRef.current?.text || '',
          },
          userPreferences: flowPrefs ? {
            language: flowPrefs.inputLanguage,
            outputLanguage: flowPrefs.outputLanguage,
            style: flowPrefs.style,
            customStylePrompt: flowPrefs.customStylePrompt,
            dictionary: flowPrefs.dictionary,
            smartTranscription: flowPrefs.smartTranscription,
            autoInsert: flowPrefs.autoInsert,
          } : undefined,
          chosenIntent: overrideIntent,
        }),
        signal: abortControllerRef.current?.signal,
      });

      const data = await res.json();

      if (!data.success) {
        setPhase('error');
        setErrorMessage(data.error || 'Failed to process request.');
        scheduleCollapse(3000);
        return;
      }

      // ── MODE A: WRITE ──────────────────────────────────────────────
      if (data.intent === 'write') {
        setPhase('writing');
        setResultHeadline('Cleaning message…');
        setResultDetails(data.rewrittenText);

        setTimeout(() => {
          // Copy to clipboard fallback if enabled
          if (flowPrefs?.autoCopyFallback !== false) {
            try {
              navigator.clipboard.writeText(data.rewrittenText);
            } catch {}
          }

          let inserted = false;
          if (flowPrefs?.autoInsert !== false) {
            inserted = insertTextIntoActiveElement(data.rewrittenText);
          }
          setIsDirectlyInserted(inserted);
          setPhase('success');
          setResultHeadline(inserted ? 'Inserted' : 'Copied');
          setResultDetails(data.rewrittenText);
          // Keep response permanent until user clicks close (X) or Escape
        }, 400);
        return;
      }

      // ── MODE B: ACTION ─────────────────────────────────────────────
      if (data.intent === 'action') {
        setPhase('acting');
        setToolInfo(data.actionResult?.toolActivity || { calendar: true, whatsapp: true });
        setResultHeadline('Running Recall action…');
        setResultDetails(data.actionResult?.details || 'Scheduling event…');

        setTimeout(() => {
          setPhase('success');
          const cleanActionHeadline = (data.actionResult?.headline || 'Done').replace(/\s*✓\s*$/, '');
          setResultHeadline(cleanActionHeadline);
          setResultDetails(data.actionResult?.details || 'Meeting added · Reminder set');
          // Keep response permanent until user clicks close (X) or Escape
        }, 500);
        return;
      }

      // ── MODE C: ASK ────────────────────────────────────────────────
      if (data.intent === 'ask') {
        setPhase('ask');
        setAskAnswer(data.assistantResponse || 'Here is what you requested.');
        // Keep response permanent until user clicks close (X) or Escape
        return;
      }

      // ── AMBIGUOUS ──────────────────────────────────────────────────
      if (data.intent === 'ambiguous') {
        setPhase('needs_choice');
        setChoices(data.choices || [
          { id: 'write', label: 'Type Text' },
          { id: 'action', label: 'Run Action' },
        ]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setPhase('error');
      setErrorMessage("Notice: Copied to clipboard");
      if (textToProcess) {
        try { navigator.clipboard.writeText(textToProcess); } catch {}
      }
      scheduleCollapse(3000);
    }
  };

  const insertTextIntoActiveElement = (cleanText: string): boolean => {
    // 1. Safety fallback: Always ensure clipboard has clean text
    try {
      navigator.clipboard.writeText(cleanText);
    } catch {}

    let el = lastFocusedElementRef.current || activeElementRef.current;
    if (!el || el === document.body || (containerRef.current && containerRef.current.contains(el))) {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && (!containerRef.current || !containerRef.current.contains(active))) {
        el = active;
      } else {
        el = null;
      }
    }

    if (!el) {
      return false;
    }

    try {
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const start = selectionRangeRef.current?.start ?? el.value.length;
        const end = selectionRangeRef.current?.end ?? el.value.length;
        const val = el.value;
        el.value = val.substring(0, start) + cleanText + val.substring(end);
        el.selectionStart = el.selectionEnd = start + cleanText.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } else if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
        const inserted = document.execCommand('insertText', false, cleanText);
        if (inserted) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        } else {
          const textNode = document.createTextNode(cleanText);
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          } else {
            el.appendChild(textNode);
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
    } catch {}

    return false;
  };

  const cleanupMicrophone = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
  };

  const collapseToOrb = () => {
    cleanupMicrophone();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExpanded(false);
    setPhase('idle');
  };

  // ── 6. DRAGGABLE MOUSE HANDLERS (ALWAYS MOVABLE) ─────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;

    isDraggingRef.current = true;
    const rect = containerRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : (position?.x ?? window.innerWidth - 80);
    const currentY = rect ? rect.top : (position?.y ?? window.innerHeight - 80);

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentX,
      startY: currentY,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;
      const width = containerRef.current?.offsetWidth || 50;
      const height = containerRef.current?.offsetHeight || 50;

      const newX = Math.max(16, Math.min(window.innerWidth - width - 16, dragStartRef.current.startX + deltaX));
      const newY = Math.max(16, Math.min(window.innerHeight - height - 16, dragStartRef.current.startY + deltaY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (containerRef.current) {
        const finalRect = containerRef.current.getBoundingClientRect();
        try {
          localStorage.setItem('recall_flow_position', JSON.stringify({ x: finalRect.left, y: finalRect.top }));
        } catch {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ── 7. RENDER ────────────────────────────────────────────────────────────

  const orbState: VoiceOrbState =
    phase === 'listening'
      ? 'listening'
      : phase === 'understanding' || phase === 'writing' || phase === 'acting'
      ? 'processing'
      : phase === 'success'
      ? 'success'
      : 'idle';

  if (isOnboardingActive) return null;

  const positionStyle: React.CSSProperties = position
    ? { position: 'fixed', left: `${position.x}px`, top: `${position.y}px` }
    : { position: 'fixed', bottom: '32px', right: '32px' };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={positionStyle}
      className="z-[999] pointer-events-auto select-none transition-transform duration-75 cursor-grab active:cursor-grabbing"
    >
      {/* ── 1. FIRST-TIME MINI GUIDE (Above Orb: Ultra-minimal) ── */}
      {showGuide && !isExpanded && (
        <div className="absolute bottom-full right-0 mb-3 px-3 py-2 rounded-2xl bg-white/95 dark:bg-[#1f1f23]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-xl text-left apple-slide-down flex items-center gap-2.5 whitespace-nowrap">
          <div className="w-5 h-5 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#0052FF] shrink-0">
            <Mic className="w-3 h-3 stroke-[2.2]" />
          </div>
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10.5px] font-mono text-zinc-700 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.1]">
              ⌥ Space
            </kbd>
            <span>and speak</span>
          </span>
          <button
            type="button"
            onClick={dismissGuide}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs cursor-pointer p-0.5 rounded hover:bg-black/5 ml-1"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 2. IDLE FLOATING ORB (Clean Radiant Recall Orb with Visible Drag Handle) ── */}
      {!isExpanded ? (
        <div className="group relative flex flex-col items-center select-none">
          {/* Subtle Apple-style Drag Pill Element */}
          <div
            onMouseDown={handleMouseDown}
            title="Drag to reposition Recall Flow anywhere"
            className="flex items-center gap-1.5 px-2.5 py-0.5 mb-1 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.1] shadow-xs cursor-grab active:cursor-grabbing hover:scale-105 transition-all text-[9.5px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white opacity-70 group-hover:opacity-100"
          >
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 group-hover:bg-[#0052FF] transition-colors" />
              <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 group-hover:bg-[#0052FF] transition-colors" />
              <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600 group-hover:bg-[#0052FF] transition-colors" />
            </span>
            <span className="font-mono tracking-tight text-[9px] uppercase">Drag</span>
          </div>

          {/* Large Living Recall Orb */}
          <div
            onClick={(e) => {
              if (!isDraggingRef.current) {
                startRecallFlow();
              }
            }}
            onMouseDown={handleMouseDown}
            className="relative cursor-pointer select-none transition-transform duration-200 hover:scale-105 active:scale-95 flex items-center justify-center p-1"
            title="Recall Flow (Option + Space)"
          >
            <VoiceOrb state="idle" size="fab" />
          </div>
        </div>
      ) : (
        /* ── 3. EXPANDED GLASS CAPSULE (Speaking / Processing / Result) ── */
        <div className="min-w-[280px] max-w-[340px] rounded-2xl bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.1] p-2 pr-2.5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_-10px_rgba(0,0,0,0.6)] flex items-start gap-2.5 transition-all duration-200 animate-in fade-in zoom-in-95">
          {/* Animated Recall Orb (Click to finish) */}
          <div className="pt-0.5 shrink-0">
            <VoiceOrb
              state={orbState}
              audioVolume={volume}
              size="md"
              onClick={() => {
                if (phase === 'listening') stopAndProcess();
              }}
            />
          </div>

          {/* Interactive Status & Clean Output Area */}
          <div className="flex-1 min-w-0 pr-0.5">
            {phase === 'listening' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  <span>Listening…</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    Enter = done
                  </span>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    transcriptRef.current = e.target.value;
                    hasSpokenRef.current = true;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      stopAndProcess();
                    }
                  }}
                  placeholder="Speak naturally…"
                  className="w-full bg-transparent border-none text-[11px] text-zinc-700 dark:text-zinc-300 outline-none placeholder:text-zinc-400 p-0 font-normal"
                />
              </div>
            )}

            {phase === 'understanding' && (
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Cleaning message…
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[210px]">
                  {transcript || 'Processing speech…'}
                </p>
              </div>
            )}

            {phase === 'writing' && (
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {resultHeadline}
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate max-w-[210px]">
                  {resultDetails || transcript}
                </p>
              </div>
            )}

            {phase === 'acting' && (
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Running Recall action…
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[210px]">
                  {resultDetails || 'Creating event…'}
                </p>
              </div>
            )}

            {phase === 'ask' && (
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Recall</span>
                  <span className="text-[10px] text-zinc-400">Ask</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-3 leading-relaxed">
                  {askAnswer}
                </p>
              </div>
            )}

            {phase === 'success' && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{resultHeadline}</span>
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug break-words max-w-[220px]">
                  {resultDetails}
                </p>
                {/* Fallback compact options if direct insertion was unavailable */}
                {isDirectlyInserted === false && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          navigator.clipboard.writeText(resultDetails);
                          setCopySuccessText('Copied!');
                          setTimeout(() => setCopySuccessText('Copy'), 1500);
                        } catch {}
                      }}
                      className="px-2 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-[10.5px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {copySuccessText}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const didInsert = insertTextIntoActiveElement(resultDetails);
                        if (didInsert) {
                          setIsDirectlyInserted(true);
                          setResultHeadline('Inserted');
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-[10.5px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      disabled={isRewriting}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setIsRewriting(true);
                        try {
                          const res = await fetch('/api/ai/flow', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              transcript: resultDetails,
                              userPreferences: { style: 'concise' },
                              chosenIntent: 'write',
                            }),
                          });
                          const d = await res.json();
                          if (d.success && d.rewrittenText) {
                            setResultDetails(d.rewrittenText);
                            try { navigator.clipboard.writeText(d.rewrittenText); } catch {}
                          }
                        } catch {} finally {
                          setIsRewriting(false);
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-[10.5px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {isRewriting ? 'Rewriting…' : 'Rewrite'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {phase === 'needs_choice' && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                  Choose mode:
                </span>
                <div className="flex items-center gap-1.5">
                  {choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => stopAndProcess(c.id)}
                      className="px-2 py-0.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10.5px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      {c.id === 'write' ? 'Type text' : 'Run action'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span className="truncate max-w-[200px]">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Dismiss / Close Button */}
          <button
            type="button"
            onClick={collapseToOrb}
            className="w-5 h-5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-0.5"
            title="Dismiss (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
