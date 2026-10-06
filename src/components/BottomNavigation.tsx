'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Link2 } from 'lucide-react';

interface BottomNavigationProps {
  onOpenCompose?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  onOpenCompose,
}) => {
  const pathname = usePathname();

  if (pathname.startsWith('/chat/')) {
    return null;
  }

  const navItems = [
    {
      label: 'Today',
      href: '/',
      svg: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="4" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Upcoming',
      href: '/upcoming',
      svg: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      href: '/completed',
      svg: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe pt-2 px-3 pointer-events-none">
      <div className="max-w-md mx-auto mb-3 flex items-center justify-between px-3 py-2 rounded-full bg-white/85 dark:bg-[#262626]/90 backdrop-blur-3xl border border-white/80 dark:border-white/[0.08] shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.6)] pointer-events-auto">
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-[#ececec] dark:text-[#171717] shadow-[0_2px_8px_rgba(0,0,0,0.18)]'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-[#ececec] hover:bg-white/50 dark:hover:bg-white/[0.05]'
                }`}
              >
                {item.svg}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {onOpenCompose && (
          <button
            onClick={onOpenCompose}
            className="w-8 h-8 rounded-full bg-zinc-900 text-white dark:bg-[#ececec] dark:text-[#171717] flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-white transition-all active:scale-90 shadow-[0_2px_8px_rgba(0,0,0,0.18)] shrink-0 ml-1"
            aria-label="Add Reminder"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
};
