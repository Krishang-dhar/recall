import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'subtle';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]';

    const variants = {
      default:
        'bg-zinc-900 text-white hover:bg-black dark:bg-[#ececec] dark:text-[#171717] dark:hover:bg-white shadow-xs',
      primary:
        'bg-gradient-to-r from-[#0052FF] via-[#5b21b6] to-[#7928CA] text-white hover:opacity-95 shadow-[0_2px_12px_rgba(0,82,255,0.25)]',
      secondary:
        'bg-black/[0.04] text-zinc-800 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.1] border border-black/[0.04] dark:border-white/[0.06]',
      ghost:
        'text-zinc-600 hover:text-zinc-950 hover:bg-black/[0.04] dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06]',
      outline:
        'border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#262626] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.05] shadow-xs',
      destructive:
        'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:bg-red-500/15 dark:text-red-400 border border-red-500/10',
      subtle:
        'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50',
    };

    const sizes = {
      default: 'h-9 px-4 py-2 text-xs rounded-xl',
      xs: 'h-6 px-2 text-[10.5px] rounded-lg',
      sm: 'h-7.5 px-3 text-[11px] rounded-lg',
      lg: 'h-11 px-5 text-sm rounded-2xl',
      icon: 'h-8 w-8 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
