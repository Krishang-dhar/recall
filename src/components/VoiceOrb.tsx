'use client';

import React from 'react';

export type VoiceOrbState = 'idle' | 'listening' | 'speaking' | 'processing' | 'understood' | 'success';

export type VoiceOrbSize = 'sm' | 'md' | 'fab' | 'lg' | 'xl';

export interface VoiceOrbProps {
  state?: VoiceOrbState;
  audioVolume?: number; // 0 to 1 real volume from Web Audio API
  size?: VoiceOrbSize;
  className?: string;
  onClick?: () => void;
  withGlow?: boolean; // explicitly control glow aura (defaults to true only for 'fab')
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state = 'idle',
  audioVolume = 0,
  size = 'md',
  className = '',
  onClick,
  withGlow,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    fab: 'w-16 h-16 sm:w-[68px] sm:h-[68px]',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-32 h-32',
  }[size];

  // Only the floating FAB gets the ambient glow aura; main search bar and inputs have zero glow bleed
  const hasGlow = withGlow ?? (size === 'fab');

  // Dynamic subtle scale based on microphone volume (calm Apple feel)
  const reactiveScale =
    state === 'listening'
      ? 1 + Math.min(audioVolume * 0.16, 0.12)
      : state === 'speaking'
      ? 1 + Math.min(audioVolume * 0.1, 0.08)
      : 1;

  const isVoiceActive = state === 'listening' || state === 'speaking';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ transform: `scale(${reactiveScale})` }}
      className={`relative rounded-full flex items-center justify-center transition-transform duration-200 cursor-pointer select-none group focus:outline-none shrink-0 ${sizeClasses} ${className}`}
      aria-label="Recall Voice Assistant Orb"
    >
      {/* Outer subtle atmospheric aura bloom: ONLY when hasGlow is true (FAB only) */}
      {hasGlow && (
        <div
          style={
            isVoiceActive
              ? {
                  transform: `scale(${1 + Math.min(audioVolume * 0.25, 0.15)})`,
                  opacity: 0.6,
                }
              : undefined
          }
          className={`absolute inset-[-5px] rounded-full blur-md transition-all duration-300 pointer-events-none ${
            isVoiceActive
              ? 'bg-gradient-to-tr from-[#0052FF]/35 via-[#7928CA]/30 to-[#00D2FF]/35 opacity-60 siri-aura-flow siri-orb-breathing'
              : state === 'processing'
              ? 'bg-gradient-to-r from-[#0052FF]/40 via-[#7928CA]/35 to-[#00D2FF]/40 opacity-55 animate-spin duration-3000'
              : state === 'understood' || state === 'success'
              ? 'bg-emerald-400/25 opacity-40'
              : 'bg-gradient-to-tr from-[#0052FF]/30 via-[#7928CA]/25 to-[#00D2FF]/30 opacity-35 group-hover:opacity-55'
          }`}
        />
      )}

      {/* Processing rotating iridescent ring container */}
      {state === 'processing' ? (
        <div className="absolute inset-[-3px] rounded-full bg-gradient-to-tr from-[#0052FF] via-[#00D2FF] to-[#7928CA] animate-spin p-[2px] pointer-events-none">
          <div className="w-full h-full rounded-full bg-transparent" />
        </div>
      ) : null}

      {/* Core 3D Iridescent Orb Graphic with smooth Siri-like rotation */}
      <div className="relative w-full h-full rounded-full flex items-center justify-center overflow-hidden transition-all duration-300">
        {/* Iridescent fluid back-glow disk under orb during active voice or processing */}
        {(isVoiceActive || state === 'processing') && (
          <div className="absolute inset-0 rounded-full siri-aura-flow siri-orb-rotating opacity-75 blur-[2px] pointer-events-none" />
        )}

        {/* 3D Recall Orb with smooth continuous flow & breathing */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/recall-logo.png"
          alt="Recall Orb"
          className={`relative z-[1] w-full h-full object-contain pointer-events-none select-none transition-transform duration-300 ${
            isVoiceActive
              ? 'siri-orb-rotating siri-orb-breathing drop-shadow-[0_4px_16px_rgba(188,130,243,0.55)]'
              : state === 'processing'
              ? 'animate-spin [animation-duration:4s] drop-shadow-[0_4px_16px_rgba(0,82,255,0.6)]'
              : state === 'idle'
              ? 'group-hover:scale-105 drop-shadow-[0_4px_12px_rgba(0,82,255,0.4)]'
              : ''
          }`}
        />

        {/* Dynamic center audio reactive indicator while listening */}
        {state === 'listening' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 backdrop-blur-[0.5px] rounded-full">
            <div className="flex items-center gap-[2px]">
              <span
                style={{ height: `${4 + Math.round(audioVolume * 14)}px` }}
                className="w-[2px] bg-white rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
              <span
                style={{ height: `${8 + Math.round(audioVolume * 18)}px` }}
                className="w-[2px] bg-white rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
              <span
                style={{ height: `${12 + Math.round(audioVolume * 22)}px` }}
                className="w-[2px] bg-white rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
              <span
                style={{ height: `${8 + Math.round(audioVolume * 18)}px` }}
                className="w-[2px] bg-white rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
              <span
                style={{ height: `${4 + Math.round(audioVolume * 14)}px` }}
                className="w-[2px] bg-white rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
            </div>
          </div>
        )}

        {/* Dynamic audio reactive indicator while speaking */}
        {state === 'speaking' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 backdrop-blur-[0.5px] rounded-full">
            <div className="flex items-center gap-[2px]">
              <span
                style={{ height: `${5 + Math.round(audioVolume * 12)}px` }}
                className="w-[2px] bg-white/90 rounded-full transition-all duration-75 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
              />
              <span
                style={{ height: `${10 + Math.round(audioVolume * 16)}px` }}
                className="w-[2px] bg-white/90 rounded-full transition-all duration-75 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
              />
              <span
                style={{ height: `${5 + Math.round(audioVolume * 12)}px` }}
                className="w-[2px] bg-white/90 rounded-full transition-all duration-75 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
              />
            </div>
          </div>
        )}
      </div>
    </button>
  );
};
