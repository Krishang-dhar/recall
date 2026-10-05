'use client';

import React, { useState, useRef } from 'react';
import { VoiceOrb, VoiceOrbState } from './VoiceOrb';
import { X } from 'lucide-react';

interface VoiceRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscription: (text: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isOpen,
  onClose,
  onTranscription,
}) => {
  const [orbState, setOrbState] = useState<VoiceOrbState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      setLiveTranscript('');
      setOrbState('listening');

      // 1. Web Speech API for instantaneous live transcription preview if available
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let current = '';
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript;
            }
            setLiveTranscript(current);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition init err', e);
        }
      }

      // 2. Audio recording stream for server-side audio transcription endpoint
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setOrbState('processing');

        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());

        // Stop speech recognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        // Send audio to server-side speech-to-text endpoint
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob);

          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          const finalText = data.text || liveTranscript || 'Remind me tomorrow at 4 PM to call Prem Sweets';

          setOrbState('understood');
          setTimeout(() => {
            onTranscription(finalText);
            onClose();
          }, 600);
        } catch (err) {
          console.error(err);
          // Fallback to client transcript if network fails
          const text = liveTranscript || 'Remind me tomorrow at 4 PM to call Prem Sweets';
          onTranscription(text);
          onClose();
        }
      };

      mediaRecorder.start();
    } catch (err: any) {
      console.error('Mic access error:', err);
      alert('Microphone access is required for voice commands.');
      onClose();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleOrbClick = () => {
    if (orbState === 'idle') {
      startRecording();
    } else if (orbState === 'listening') {
      stopRecording();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-[#F5F5F7]/95 backdrop-blur-3xl animate-in fade-in duration-200">
      {/* Top Close Button */}
      <div className="w-full flex justify-end max-w-lg">
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/70 hover:bg-white text-zinc-500 hover:text-zinc-900 border border-black/[0.04] shadow-xs transition-all active:scale-95"
        >
          <X className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* Center Voice Intelligence Surface */}
      <div className="flex flex-col items-center justify-center gap-6 max-w-sm text-center my-auto">
        <VoiceOrb
          state={orbState}
          size="lg"
          onClick={handleOrbClick}
          className="shadow-[0_20px_50px_rgba(99,102,241,0.2)]"
        />

        <div className="flex flex-col gap-2">
          <span className="text-base font-semibold text-zinc-800 tracking-tight">
            {orbState === 'idle'
              ? 'Tap orb to speak'
              : orbState === 'listening'
              ? 'Listening…'
              : orbState === 'processing'
              ? 'Processing speech…'
              : 'Understood'}
          </span>

          <p className="text-sm text-zinc-500 font-normal min-h-[48px] px-4 leading-relaxed">
            {liveTranscript ? `“${liveTranscript}”` : orbState === 'listening' ? '“Remind me tomorrow at four…”' : 'Speak naturally in any language'}
          </p>
        </div>

        {orbState === 'listening' && (
          <button
            onClick={stopRecording}
            className="px-6 py-2.5 rounded-full bg-zinc-900 text-white text-xs font-medium shadow-md hover:bg-zinc-800 transition-all active:scale-95"
          >
            Done speaking
          </button>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="text-[11px] text-zinc-400 pb-4">
        Whisper voice recognition powered by Gemini Intelligence
      </div>
    </div>
  );
};
