'use client';

import React, { useRef, useEffect } from 'react';
import { AssistantType } from '@/lib/types';
import { Check, BookOpen, Calendar, PenTool } from 'lucide-react';
import { overlayManager } from '@/lib/overlay-manager';

interface AssistantPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAssistant: AssistantType;
  onChange: (assistant: AssistantType) => void;
  className?: string;
}

export const ASSISTANT_PRESETS: Array<{
  id: AssistantType;
  name: string;
  tagline: string;
  placeholder: string;
}> = [
  {
    id: 'recall',
    name: 'Recall',
    tagline: 'General assistant',
    placeholder: 'Ask Recall anything...',
  },
  {
    id: 'study',
    name: 'Study',
    tagline: 'Study & revision',
    placeholder: 'Ask Study anything…',
  },
  {
    id: 'planner',
    name: 'Planner',
    tagline: 'Day & schedule planning',
    placeholder: 'Ask Planner anything…',
  },
  {
    id: 'writer',
    name: 'Writer',
    tagline: 'Writing & communication',
    placeholder: 'Ask Writer anything…',
  },
];

const AssistantIcon: React.FC<{ id: AssistantType; isSelected?: boolean }> = ({ id }) => {
  if (id === 'recall') {
    return (
      <div className="relative w-7 h-7 rounded-full shrink-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/recall-logo.png"
          alt="Recall"
          className="w-full h-full object-contain drop-shadow-[0_1px_4px_rgba(0,82,255,0.25)] select-none pointer-events-none"
        />
      </div>
    );
  }

  if (id === 'study') {
    return (
      <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
        <BookOpen className="w-3.5 h-3.5 stroke-[2]" />
      </div>
    );
  }

  if (id === 'planner') {
    return (
      <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
        <Calendar className="w-3.5 h-3.5 stroke-[2]" />
      </div>
    );
  }

  return (
    <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
      <PenTool className="w-3.5 h-3.5 stroke-[2]" />
    </div>
  );
};

export const AssistantPicker: React.FC<AssistantPickerProps> = ({
  isOpen,
  onClose,
  currentAssistant,
  onChange,
  className = '',
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      overlayManager.open('assistant-picker');
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={`absolute left-0 top-full mt-2.5 z-50 w-[280px] p-1.5 rounded-[20px] bg-white border border-black/[0.08] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12)] space-y-1 animate-in fade-in zoom-in-95 duration-150 ${className}`}
    >
      {ASSISTANT_PRESETS.map((preset) => {
        const isSelected = preset.id === currentAssistant;
        const selectedClasses =
          preset.id === 'study'
            ? 'bg-purple-50/80 border-purple-200/60 text-zinc-900'
            : preset.id === 'planner'
            ? 'bg-sky-50/80 border-sky-200/60 text-zinc-900'
            : preset.id === 'writer'
            ? 'bg-indigo-50/80 border-indigo-200/60 text-zinc-900'
            : 'bg-blue-50/80 border-blue-200/60 text-zinc-900';

        const checkColor =
          preset.id === 'study'
            ? 'bg-purple-600'
            : preset.id === 'planner'
            ? 'bg-sky-600'
            : preset.id === 'writer'
            ? 'bg-indigo-600'
            : 'bg-[#0052FF]';

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              onChange(preset.id);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-2.5 rounded-[16px] text-left transition-all cursor-pointer ${
              isSelected
                ? `${selectedClasses} border shadow-2xs`
                : 'hover:bg-zinc-50 border border-transparent text-zinc-700 hover:text-zinc-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <AssistantIcon id={preset.id} />

              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-900 leading-tight">
                  {preset.name}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 truncate font-normal">
                  {preset.tagline}
                </div>
              </div>
            </div>

            {isSelected && (
              <div className={`w-4 h-4 rounded-full ${checkColor} text-white flex items-center justify-center shrink-0`}>
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
