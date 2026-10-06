'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface RecallSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const RecallSelect: React.FC<RecallSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  ariaLabel,
  className = '',
  buttonClassName = '',
  disabled = false,
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setIsOpen(true);
          const idx = options.findIndex((opt) => opt.value === value);
          setHighlightedIndex(idx >= 0 ? idx : 0);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          break;
      }
    },
    [disabled, isOpen, options, value, highlightedIndex, onChange]
  );

  const sizeClasses = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-11 px-3.5 text-xs',
    lg: 'h-12 px-4 text-sm',
  }[size];

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full select-none', className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button with Living Gradient Border Effect on Hover/Open */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        className={cn(
          'group relative w-full rounded-xl bg-white border text-left font-medium flex items-center justify-between gap-2.5 transition-all duration-200 outline-none cursor-pointer',
          sizeClasses,
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen
            ? 'border-transparent shadow-[0_0_0_1.5px_#0052FF,0_4px_16px_rgba(0,82,255,0.12)] bg-white'
            : 'border-black/[0.08] shadow-2xs hover:border-black/[0.14] hover:shadow-xs',
          buttonClassName
        )}
      >
        {/* Subtle Living Gradient Aura behind Trigger when active/hover */}
        <span
          className={cn(
            'absolute inset-[-1.5px] rounded-xl bg-gradient-to-r from-[#0052FF] via-[#00D2FF] to-[#7928CA] -z-10 transition-opacity duration-300 pointer-events-none',
            isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-20'
          )}
        />

        {/* Selected Label or Placeholder */}
        <span suppressHydrationWarning className="truncate flex items-center gap-2 text-zinc-900">
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span suppressHydrationWarning className={cn('truncate', !selectedOption && 'text-zinc-400 font-normal')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        {/* Apple Style Smooth Chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180 text-blue-600'
          )}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1.5 w-full min-w-[200px] max-h-64 overflow-y-auto rounded-2xl bg-white/95 backdrop-blur-xl border border-black/[0.08] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16)] p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isHighlighted = idx === highlightedIndex;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-blue-50/80 text-blue-900 font-semibold'
                    : isHighlighted
                    ? 'bg-zinc-100/80 text-zinc-900'
                    : 'text-zinc-700 hover:bg-zinc-50'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon && (
                    <span className="shrink-0 text-zinc-500">{option.icon}</span>
                  )}
                  <div className="truncate">
                    <div className="truncate">{option.label}</div>
                    {option.sublabel && (
                      <div className="text-[10px] text-zinc-400 truncate font-normal">
                        {option.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2 animate-in zoom-in-50 duration-150" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
