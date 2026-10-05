import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  size = 'default',
}) => {
  const isSm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30 disabled:cursor-not-allowed disabled:opacity-40',
        isSm ? 'h-4 w-7' : 'h-5 w-9',
        checked ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out',
          checked ? 'bg-white dark:bg-zinc-950' : 'bg-white dark:bg-zinc-300',
          isSm ? 'h-3 w-3' : 'h-4 w-4',
          isSm
            ? checked ? 'translate-x-3.5 translate-y-0.5' : 'translate-x-0.5 translate-y-0.5'
            : checked ? 'translate-x-4.5 translate-y-0.5' : 'translate-x-0.5 translate-y-0.5'
        )}
      />
    </button>
  );
};

export const Separator: React.FC<{
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}> = ({ orientation = 'horizontal', className }) => {
  return (
    <div
      role="separator"
      className={cn(
        'shrink-0 bg-black/[0.06] dark:bg-white/[0.07]',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
    />
  );
};

export const Badge: React.FC<{
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'blue';
  className?: string;
  children: React.ReactNode;
}> = ({ variant = 'default', className, children }) => {
  const variants = {
    default: 'bg-black/[0.05] text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-200 border-black/[0.04]',
    success: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/15',
    warning: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/15',
    destructive: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-red-500/15',
    outline: 'border border-black/[0.08] dark:border-white/[0.1] text-zinc-600 dark:text-zinc-300',
    blue: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border-blue-500/15',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
