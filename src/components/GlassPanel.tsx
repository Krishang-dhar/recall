import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
  elevated = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl transition-all duration-200 ${
        elevated ? 'glass-surface-elevated' : 'glass-surface'
      } ${className}`}
    >
      {children}
    </div>
  );
};
