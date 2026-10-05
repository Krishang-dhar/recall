'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Mic } from 'lucide-react';
import { VoiceOrb, VoiceOrbState } from './VoiceOrb';

interface AICommandBarProps {
  onParsed: (result: any) => void;
  isLoading?: boolean;
  onOpenChat?: () => void;
}

export const AICommandBar: React.FC<AICommandBarProps> = ({
  onParsed,
  isLoading = false,
  onOpenChat,
}) => {
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState<VoiceOrbState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioVolume, setAudioVolume] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastSoundTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    return () => {
      stopMicrophoneStream();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

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

  const executeParse = async (text: string) => {
    setState('processing');
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text.trim(),
          referenceTime: new Date().toISOString(),
          timeZone: 'Asia/Kolkata',
        }),
      });

      const data = await res.json();
      if (data.data) {
        setState('understood');
        setTimeout(() => {
          onParsed(data.data);
          setPrompt('');
          setState('idle');
          setLiveTranscript('');
          setErrorMessage(null);
        }, 350);
      } else {
        setState('idle');
        setErrorMessage("Couldn’t hear that clearly.");
      }
    } catch (err) {
      console.error(err);
      setState('idle');
      setErrorMessage("Couldn’t hear that clearly.");
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || state === 'processing' || isLoading) return;
    executeParse(prompt.trim());
  };

  const startVoiceCapture = async () => {
    try {
      setErrorMessage(null);
      setLiveTranscript('');
      setAudioVolume(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setState('listening');

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
      let hasHeardSpeech = false;

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
          hasHeardSpeech = true;
        }

        if (hasHeardSpeech && Date.now() - lastSoundTimeRef.current > 2400) {
          stopVoiceCapture();
          return;
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      // Real-time Web Speech Recognition (Chrome/Safari/Edge/Brave) for instant live speech transcription
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      let recognitionInstance: any = null;
      if (SpeechRecognition) {
        try {
          recognitionInstance = new SpeechRecognition();
          recognitionInstance.continuous = true;
          recognitionInstance.interimResults = true;
          // Set language detection for Indian English & Hindi
          recognitionInstance.lang = 'en-IN';

          recognitionInstance.onresult = (event: any) => {
            let transcriptText = '';
            for (let i = 0; i < event.results.length; i++) {
              transcriptText += event.results[i][0].transcript;
            }
            if (transcriptText.trim()) {
              setLiveTranscript(transcriptText.trim());
              lastSoundTimeRef.current = Date.now();
              hasHeardSpeech = true;
            }
          };

          recognitionInstance.onerror = (e: any) => {
            console.warn('SpeechRecognition interim event:', e.error);
          };

          recognitionInstance.start();
          (mediaRecorderRef as any).currentRecognition = recognitionInstance;
        } catch (e) {
          console.warn('Web Speech recognition init error:', e);
        }
      }

      animFrameRef.current = requestAnimationFrame(checkVolume);

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const supportedType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

      const mediaRecorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stopMicrophoneStream();
        setAudioVolume(0);
        setState('processing');

        if (audioChunksRef.current.length === 0) {
          setState('idle');
          setErrorMessage("I didn’t catch that.");
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: supportedType || 'audio/webm',
        });

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob);

          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (data.success && data.text && data.text.trim()) {
            setLiveTranscript(data.text);
            executeParse(data.text);
          } else {
            setState('idle');
            setErrorMessage("I didn’t catch that.");
          }
        } catch (err) {
          console.error(err);
          setState('idle');
          setErrorMessage("Couldn’t hear that clearly.");
        }
      };

      mediaRecorder.start(250);
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      setState('idle');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage("Microphone access is off.");
      } else {
        setErrorMessage("I didn’t catch that.");
      }
    }
  };

  const stopVoiceCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleOrbClick = () => {
    if (state === 'listening') {
      stopVoiceCapture();
    } else if (state === 'idle') {
      startVoiceCapture();
    }
  };

  const busy = state === 'processing' || isLoading;

  return (
    <div className="w-full relative">
      <form
        onSubmit={handleTextSubmit}
        className={`ai-composer-glow relative rounded-[24px] h-[64px] sm:h-[68px] flex items-center px-4 sm:px-5 gap-3.5 transition-all duration-200 border ${
          state === 'listening'
            ? 'bg-white border-indigo-300 shadow-[0_12px_36px_-6px_rgba(99,102,241,0.18)]'
            : state === 'processing'
            ? 'bg-white/95 border-purple-200'
            : 'bg-white/80 backdrop-blur-2xl border-white/90 hover:bg-white/95 focus-within:bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.9)]'
        }`}
      >
        {/* Left: Siri/Recall Voice Orb matching screenshot */}
        <div className="shrink-0 flex items-center justify-center">
          <VoiceOrb
            state={state}
            audioVolume={audioVolume}
            size="md"
            onClick={handleOrbClick}
          />
        </div>

        {/* Center: Input or Fluid Voice Text */}
        {state === 'listening' ? (
          <div
            onClick={stopVoiceCapture}
            className="flex-1 flex items-center justify-between cursor-pointer py-1 select-none min-w-0"
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[11px] font-semibold text-indigo-600 tracking-tight">
                Listening…
              </span>
              <span className="text-xs sm:text-sm text-zinc-600 truncate font-normal">
                {liveTranscript || 'Speak your reminder naturally…'}
              </span>
            </div>
          </div>
        ) : state === 'processing' ? (
          <div className="flex-1 flex items-center py-1">
            <span className="text-xs font-medium text-purple-600 animate-pulse tracking-tight">
              Understanding…
            </span>
          </div>
        ) : (
          <input
            type="text"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setErrorMessage(null);
            }}
            disabled={busy}
            placeholder="What do you need to remember?"
            className="flex-1 bg-transparent text-sm sm:text-[15px] text-zinc-900 placeholder-zinc-400 font-normal outline-none border-none disabled:opacity-50 tracking-tight"
          />
        )}

        {/* Right: Ask Recall chat trigger + Send Plane Icon */}
        <div className="shrink-0 flex items-center gap-1.5">
          {onOpenChat && state === 'idle' && (
            <button
              type="button"
              onClick={onOpenChat}
              title="Ask Recall anything..."
              className="px-2.5 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-zinc-600 hover:text-zinc-900 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Ask</span>
            </button>
          )}

          {state === 'listening' ? (
            <button
              type="button"
              onClick={stopVoiceCapture}
              className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-all active:scale-95 shadow-xs"
            >
              Done
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim() || busy}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                prompt.trim() && !busy
                  ? 'text-zinc-900 bg-black/[0.04] hover:bg-black/[0.08] active:scale-90 cursor-pointer'
                  : 'text-zinc-300 bg-black/[0.02] cursor-not-allowed'
              }`}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <Send className="w-4 h-4 stroke-[1.8] -rotate-12 translate-x-[-1px]" />
              )}
            </button>
          )}
        </div>
      </form>

      {/* Gentle Error Feedback */}
      {errorMessage && (
        <div className="pt-2 px-3 flex items-center justify-between text-xs text-zinc-500 animate-in fade-in">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={startVoiceCapture}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 ml-2"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};
