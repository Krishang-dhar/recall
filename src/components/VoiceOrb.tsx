'use client';

import React from 'react';

export type VoiceOrbState = 'idle' | 'listening' | 'speaking' | 'processing' | 'understood' | 'success';

export type VoiceOrbSize = 'sm' | 'md' | 'fab' | 'lg' | 'xl';

export interface VoiceOrbProps {
  state?: VoiceOrbState;
  audioVolume?: number;
  size?: VoiceOrbSize;
  className?: string;
  onClick?: () => void;
  withGlow?: boolean;
}

// Voice agent permanently disabled per user requirement - returns null
export const VoiceOrb: React.FC<VoiceOrbProps> = () => {
  return null;
};
