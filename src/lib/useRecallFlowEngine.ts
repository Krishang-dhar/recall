'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RecallFlowSettings,
  DEFAULT_FLOW_SETTINGS,
  getFlowSettings,
  saveFlowSettings as saveFlowSettingsUtil,
} from '@/lib/flow-settings';

export type FlowPhase =
  | 'idle'
  | 'listening'
  | 'understanding'
  | 'writing'
  | 'acting'
  | 'ask'
  | 'success'
  | 'needs_choice'
  | 'error'
  | 'no_speech';

export interface RecallFlowChoice {
  id: 'write' | 'action';
  label: string;
}

export interface UseRecallFlowEngineOptions {
  autoInsert?: boolean;
  onPhaseChange?: (phase: FlowPhase) => void;
  onSuccess?: (result: {
    intent: 'write' | 'action' | 'ask';
    cleanedText: string;
    headline: string;
    details: string;
  }) => void;
}

export function useRecallFlowEngine(options: UseRecallFlowEngineOptions = {}) {
  const [phase, setPhase] = useState<FlowPhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [cleanedResult, setCleanedResult] = useState('');
  const [volume, setVolume] = useState(0);
  const [resultHeadline, setResultHeadline] = useState('Done');
  const [resultDetails, setResultDetails] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  const [toolInfo, setToolInfo] = useState<{
    calendar?: boolean;
    whatsapp?: boolean;
    task?: boolean;
  }>({});
  const [choices, setChoices] = useState<RecallFlowChoice[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDirectlyInserted, setIsDirectlyInserted] = useState<boolean | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [settings, setSettings] = useState<RecallFlowSettings>(DEFAULT_FLOW_SETTINGS);

  // References
  const activeElementRef = useRef<HTMLElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const selectionRangeRef = useRef<{ start: number; end: number; text: string } | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasSpokenRef = useRef(false);
  const transcriptRef = useRef('');

  // Sync settings across windows/components
  useEffect(() => {
    setSettings(getFlowSettings());

    const handleSettingsEvent = (e: any) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener('recall-flow-settings-changed', handleSettingsEvent);
    return () => {
      window.removeEventListener('recall-flow-settings-changed', handleSettingsEvent);
    };
  }, []);

  // Track active element focus to allow insertion into inputs
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

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
        lastFocusedElementRef.current = active;
        activeElementRef.current = active;
        selectionRangeRef.current = {
          start: active.selectionStart || 0,
          end: active.selectionEnd || 0,
          text: active.value.substring(active.selectionStart || 0, active.selectionEnd || 0),
        };
      }
    };

    window.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('selectionchange', handleSelectionChange, true);
    return () => {
      window.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('selectionchange', handleSelectionChange, true);
    };
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Cleanup microphone and audio contexts
  const cleanupMicrophone = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setVolume(0);
  }, []);

  // Update settings and notify all components
  const updateSettings = useCallback((patch: Partial<RecallFlowSettings>) => {
    const updated = saveFlowSettingsUtil(patch);
    setSettings(updated);
    return updated;
  }, []);

  // Insert cleaned text into active input element or copy to clipboard
  const insertTextIntoActiveElement = useCallback((cleanText: string): boolean => {
    try {
      navigator.clipboard.writeText(cleanText);
    } catch {}

    let el = lastFocusedElementRef.current || activeElementRef.current;
    if (!el || el === document.body) {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) {
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
      } else if (
        el.isContentEditable ||
        el.getAttribute('contenteditable') === 'true' ||
        el.getAttribute('role') === 'textbox'
      ) {
        const inserted = document.execCommand('insertText', false, cleanText);
        if (inserted) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
    } catch (e) {
      console.warn('Direct text insertion fallback to clipboard:', e);
    }

    return false;
  }, []);

  // Stop & Process speech with full audio fallback
  const stopAndProcess = useCallback(
    async (overrideIntent?: 'write' | 'action' | 'ask') => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // 1. Stop SpeechRecognition
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }

      // 2. Await MediaRecorder stop gracefully to flush all audio chunks
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

      cleanupMicrophone();

      let textToProcess = transcriptRef.current.trim();

      // Audio base64 backup if transcript wasn't populated by SpeechRec (e.g. browser network error)
      let audioBase64: string | undefined = undefined;
      const mimeTypeToSend = audioBlob?.type || recorder?.mimeType || 'audio/webm';
      if (audioBlob && audioBlob.size > 200) {
        try {
          const reader = new FileReader();
          audioBase64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const res = (reader.result as string) || '';
              const base64 = res.split(',')[1] || '';
              resolve(base64);
            };
            reader.readAsDataURL(audioBlob!);
          });
        } catch (err) {
          console.warn('Audio base64 notice:', err);
        }
      }

      // If genuine silence (no text and no audio chunks recorded)
      if (!textToProcess && !audioBase64) {
        setPhase('no_speech');
        setErrorMessage("Didn't catch that. Please speak again.");
        return;
      }

      setPhase('understanding');

      try {
        const currentSettings = getFlowSettings();

        const res = await fetch('/api/ai/flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: textToProcess,
            audioBase64: audioBase64,
            mimeType: mimeTypeToSend,
            context: {
              activeApplication: 'recall-web',
              selectedText: selectionRangeRef.current?.text || '',
            },
            userPreferences: {
              language: currentSettings.inputLanguage,
              outputLanguage: currentSettings.outputLanguage,
              style: currentSettings.style,
              customStylePrompt: currentSettings.customStylePrompt,
              dictionary: currentSettings.dictionary,
              smartTranscription: currentSettings.smartTranscription,
              autoInsert: currentSettings.autoInsert,
            },
            chosenIntent: overrideIntent,
          }),
          signal: abortControllerRef.current?.signal,
        });

        const data = await res.json();

        if (!data.success) {
          // If server reports no speech was present in audio
          if (
            data.error &&
            (data.error.includes('No speech detected') ||
              data.error.includes('silent') ||
              data.error.includes('Didn’t catch that'))
          ) {
            setPhase('no_speech');
            setErrorMessage("Didn't catch that.");
            return;
          }
          setPhase('error');
          setErrorMessage(data.error || 'Failed to process audio.');
          return;
        }

        // ── MODE A: WRITE ──────────────────────────────────────────────
        if (data.intent === 'write') {
          setPhase('writing');
          const finalCleaned = data.rewrittenText || data.rawTranscript || textToProcess;
          setCleanedResult(finalCleaned);
          setResultHeadline('Cleaning message…');
          setResultDetails(finalCleaned);

          setTimeout(() => {
            // Auto copy to clipboard
            if (currentSettings.autoCopyFallback !== false) {
              try {
                navigator.clipboard.writeText(finalCleaned);
                setCopiedSuccess(true);
              } catch {}
            }

            let inserted = false;
            if (options.autoInsert !== false && currentSettings.autoInsert !== false) {
              inserted = insertTextIntoActiveElement(finalCleaned);
            }
            setIsDirectlyInserted(inserted);
            setPhase('success');
            setResultHeadline(inserted ? 'Inserted' : 'Copied');
            setResultDetails(finalCleaned);

            options.onSuccess?.({
              intent: 'write',
              cleanedText: finalCleaned,
              headline: inserted ? 'Inserted' : 'Copied',
              details: finalCleaned,
            });
          }, 350);
          return;
        }

        // ── MODE B: ACTION ─────────────────────────────────────────────
        if (data.intent === 'action') {
          setPhase('acting');
          setToolInfo(data.actionResult?.toolActivity || { calendar: true, whatsapp: true });
          const actionHeadline = (data.actionResult?.headline || 'Done').replace(/\s*✓\s*$/, '');
          const actionDetails = data.actionResult?.details || 'Meeting added · Reminder set';
          setResultHeadline('Running Recall action…');
          setResultDetails(actionDetails);

          setTimeout(() => {
            setPhase('success');
            setResultHeadline(actionHeadline);
            setResultDetails(actionDetails);

            options.onSuccess?.({
              intent: 'action',
              cleanedText: data.rawTranscript || textToProcess,
              headline: actionHeadline,
              details: actionDetails,
            });
          }, 450);
          return;
        }

        // ── MODE C: ASK ────────────────────────────────────────────────
        if (data.intent === 'ask') {
          setPhase('ask');
          setAskAnswer(data.assistantResponse || 'Here is what you requested.');
          return;
        }

        // ── AMBIGUOUS ──────────────────────────────────────────────────
        if (data.intent === 'ambiguous') {
          setPhase('needs_choice');
          setChoices(
            data.choices || [
              { id: 'write', label: 'Type Text' },
              { id: 'action', label: 'Run Action' },
            ]
          );
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setPhase('error');
        setErrorMessage('Failed to connect to Recall engine. Please check your network.');
        if (textToProcess) {
          try {
            navigator.clipboard.writeText(textToProcess);
          } catch {}
        }
      }
    },
    [cleanupMicrophone, insertTextIntoActiveElement, options]
  );

  // Automatic silence detection (VAD)
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (!hasSpokenRef.current) return;

    // Detect 1.3s of pause and auto-finalize
    silenceTimerRef.current = setTimeout(() => {
      if (hasSpokenRef.current && (transcriptRef.current.trim().length > 0 || audioChunksRef.current.length > 0)) {
        stopAndProcess();
      }
    }, 1300);
  }, [stopAndProcess]);

  // Start listening with audio capture, visualizer, media recorder & speech recognition
  const startListening = useCallback(async () => {
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

    setPhase('listening');
    setTranscript('');
    setCleanedResult('');
    setResultHeadline('Done');
    setResultDetails('');
    setAskAnswer('');
    setToolInfo({});
    setChoices([]);
    setErrorMessage('');
    setIsDirectlyInserted(null);
    setCopiedSuccess(false);
    hasSpokenRef.current = false;
    setHasSpoken(false);
    transcriptRef.current = '';
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
              setHasSpoken(true);
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

    // 3. Web Speech Recognition
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        const currentSettings = getFlowSettings();
        rec.lang = currentSettings.inputLanguage === 'hi' ? 'hi-IN' : 'en-US';

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
            setHasSpoken(true);
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
  }, [resetSilenceTimer]);

  // Cancel flow and revert to idle cleanly
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    cleanupMicrophone();
    setPhase('idle');
    setTranscript('');
    setVolume(0);
    setErrorMessage('');
  }, [cleanupMicrophone]);

  // Copy cleaned result to clipboard
  const copyResult = useCallback(async () => {
    const textToCopy = cleanedResult || resultDetails || transcript;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch {}
  }, [cleanedResult, resultDetails, transcript]);

  return {
    phase,
    transcript,
    cleanedResult,
    volume,
    resultHeadline,
    resultDetails,
    askAnswer,
    toolInfo,
    choices,
    errorMessage,
    isDirectlyInserted,
    copiedSuccess,
    settings,
    hasSpoken,
    startListening,
    stopAndProcess,
    cancel,
    updateSettings,
    setPhase,
    copyResult,
  };
}
