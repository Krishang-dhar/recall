'use client';

import React, { useState, useEffect } from 'react';

interface LaunchScreenProps {
  onComplete?: () => void;
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'breathe' | 'morph' | 'fadeout' | 'done'>('breathe');

  useEffect(() => {
    // 1. Session Storage check: Only show on the very first visit in a browser session!
    try {
      const alreadySeen = sessionStorage.getItem('recall_intro_seen');
      if (alreadySeen === 'true') {
        setPhase('done');
        onComplete?.();
        window.dispatchEvent(new CustomEvent('recall-intro-reveal'));
        return;
      }
    } catch (e) {}

    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      try {
        sessionStorage.setItem('recall_intro_seen', 'true');
      } catch (e) {}
      setPhase('done');
      onComplete?.();
      return;
    }

    // Step 1: 0 - 850ms: Smooth living orb & logo in center
    const timer1 = setTimeout(() => {
      setPhase('morph');
    }, 850);

    // Step 2: 850ms - 1450ms: Smooth Apple morph curve towards input bar
    const timer2 = setTimeout(() => {
      setPhase('fadeout');
      // Notify parent that home UI should build in
      window.dispatchEvent(new CustomEvent('recall-intro-reveal'));
    }, 1450);

    // Step 3: 1950ms: Fully complete and unmount (~1.95 seconds total)
    const timer3 = setTimeout(() => {
      try {
        sessionStorage.setItem('recall_intro_seen', 'true');
      } catch (e) {}
      setPhase('done');
      onComplete?.();
    }, 1950);

    // Skip on Escape or click
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        fastForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete]);

  const fastForward = () => {
    try {
      sessionStorage.setItem('recall_intro_seen', 'true');
    } catch (e) {}
    setPhase('done');
    window.dispatchEvent(new CustomEvent('recall-intro-reveal'));
    onComplete?.();
  };

  if (phase === 'done') return null;

  return (
    <div
      onClick={fastForward}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#F8F9FD] select-none cursor-pointer transition-opacity duration-500 ease-out ${
        phase === 'fadeout' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Radial Iridescent Glow Aura */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full bg-gradient-to-tr from-[#0052FF]/15 via-[#7928CA]/12 to-[#00D2FF]/15 blur-3xl animate-pulse" />
      </div>

      {/* Main Traveling Logo Element */}
      <div
        className={`relative flex flex-col items-center justify-center transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          phase === 'morph' || phase === 'fadeout'
            ? 'translate-y-[60px] scale-[0.68] opacity-0'
            : 'translate-y-0 scale-100 opacity-100'
        }`}
      >
        {/* Soft living orb aura behind logo */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0052FF]/30 via-[#7928CA]/25 to-[#00D2FF]/35 blur-xl animate-pulse" />

          {/* Official Recall 3D Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/recall-logo.png"
            alt="Recall"
            className="relative w-full h-full object-contain logo-breathe drop-shadow-[0_12px_36px_rgba(0,82,255,0.35)]"
          />
        </div>
      </div>

      {/* Skip button in bottom-right corner */}
      <div className="absolute bottom-6 right-6 z-10 text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors">
        Press Esc or tap to skip
      </div>
    </div>
  );
};
