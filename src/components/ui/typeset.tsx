import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TypesetProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'prose' | 'compact' | 'response';
  children: React.ReactNode;
}

/**
 * shadcn Typeset component
 * Provides consistent typography, spacing, heading hierarchy, lists, and streaming response rhythm
 * matching Recall's calm, premium white/off-white + dark theme identity.
 */
export const Typeset = React.forwardRef<HTMLDivElement, TypesetProps>(
  ({ className, variant = 'response', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'typeset select-text font-sans antialiased text-zinc-800 dark:text-[#ececec]',
          variant === 'response' && [
            'text-[13px] sm:text-sm leading-relaxed space-y-2.5',
            '[&_p]:leading-[1.65] [&_p]:text-zinc-700 dark:[&_p]:text-[#d4d4d8]',
            '[&_p_strong]:font-semibold [&_p_strong]:text-zinc-950 dark:[&_p_strong]:text-white',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
            '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
            '[&_li]:text-zinc-700 dark:[&_li]:text-[#d4d4d8] [&_li]:leading-normal',
            '[&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-zinc-950 dark:[&_h1]:text-white [&_h1]:mt-3 [&_h1]:mb-1',
            '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-zinc-950 dark:[&_h2]:text-white [&_h2]:mt-2.5 [&_h2]:mb-1',
            '[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100 [&_h3]:mt-2 [&_h3]:mb-0.5',
            '[&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-black/[0.05] dark:[&_code]:bg-white/[0.08] [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-blue-600 dark:[&_code]:text-blue-400',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-blue-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-500 dark:[&_blockquote]:text-zinc-400',
            '[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:my-2',
            '[&_th]:border-b [&_th]:border-black/10 dark:[&_th]:border-white/10 [&_th]:pb-1.5 [&_th]:text-left [&_th]:font-semibold',
            '[&_td]:border-b [&_td]:border-black/[0.05] dark:[&_td]:border-white/[0.05] [&_td]:py-1.5',
          ],
          variant === 'compact' && [
            'text-xs leading-normal space-y-1.5',
            '[&_p]:text-zinc-600 dark:[&_p]:text-zinc-300',
            '[&_p_strong]:font-semibold [&_p_strong]:text-zinc-900 dark:[&_p_strong]:text-white',
            '[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-0.5',
          ],
          variant === 'prose' && [
            'text-sm leading-relaxed space-y-3 max-w-prose',
            '[&_p]:text-zinc-700 dark:[&_p]:text-zinc-300',
            '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-zinc-950 dark:[&_h1]:text-white',
            '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 dark:[&_h2]:text-white',
          ],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Typeset.displayName = 'Typeset';
