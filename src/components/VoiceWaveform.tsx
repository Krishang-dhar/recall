'use client';

import React from 'react';

interface VoiceWaveformProps {
  isActive: boolean;
  className?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isActive,
  className = '',
}) => {
  // 9 organic fluid animated bars
  const heights = [
    'h-2 animate-[pulse_0.9s_ease-in-out_infinite]',
    'h-4 animate-[pulse_1.1s_ease-in-out_infinite_0.1s]',
    'h-6 animate-[pulse_0.8s_ease-in-out_infinite_0.2s]',
    'h-7 animate-[pulse_1.2s_ease-in-out_infinite_0.15s]',
    'h-5 animate-[pulse_0.7s_ease-in-out_infinite_0.3s]',
    'h-7 animate-[pulse_1.0s_ease-in-out_infinite_0.05s]',
    'h-6 animate-[pulse_0.85s_ease-in-out_infinite_0.25s]',
    'h-4 animate-[pulse_1.15s_ease-in-out_infinite_0.12s]',
    'h-2 animate-[pulse_0.95s_ease-in-out_infinite_0.18s]',
  ];

  return (
    <div className={`flex items-center gap-[3px] py-1 ${className}`}>
      {heights.map((anim, idx) => (
        <span
          key={idx}
          className={`w-[3px] rounded-full transition-all duration-300 ${
            isActive
              ? `bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500 ${anim}`
              : 'h-1.5 bg-zinc-300'
          }`}
        />
      ))}
    </div>
  );
};
