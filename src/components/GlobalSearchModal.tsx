'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, Folder, CheckSquare, FileText, Calendar, X, ArrowRight } from 'lucide-react';
import { SearchResultItem } from '@/lib/local-store';
import { Portal } from './Portal';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat?: (chatId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectChat,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (data.success && data.results) {
          setResults(data.results);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.warn('Search error', err);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    if (item.type === 'chat') {
      onSelectChat?.(item.id);
      router.push(item.url);
    } else if (item.type === 'project') {
      router.push(item.url);
    } else if (item.type === 'task') {
      router.push(item.url);
    } else if (item.type === 'event') {
      router.push(item.url);
    } else if (item.type === 'file') {
      window.open(item.url, '_blank');
    }
  };

  const handleKeyDownInInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  const getIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
      case 'project':
        return <Folder className="w-3.5 h-3.5 text-purple-500" />;
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />;
      case 'event':
        return <Calendar className="w-3.5 h-3.5 text-sky-500" />;
      case 'file':
        return <FileText className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] flex items-start justify-center pt-20 px-4 bg-black/30 backdrop-blur-md animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-[24px] bg-white border border-black/[0.08] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.22)] overflow-hidden animate-in zoom-in-95 duration-150"
        >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-black/[0.05] gap-3">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownInInput}
            placeholder="Search Recall… chats, projects, tasks, files"
            style={{ color: 'var(--input-text)', WebkitTextFillColor: 'var(--input-text)' }}
            className="flex-1 bg-transparent text-sm !text-zinc-900 dark:!text-[#ececec] placeholder:!text-zinc-400 dark:placeholder:!text-zinc-500 outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2 divide-y divide-black/[0.02]">
          {results.length > 0 ? (
            results.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-zinc-100/90 text-zinc-900' : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-white border border-black/[0.04] shadow-2xs flex items-center justify-center shrink-0">
                      {getIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold tracking-tight truncate">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-zinc-400 truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 px-1.5 py-0.5 rounded bg-black/[0.03]">
                      {item.type}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                  </div>
                </div>
              );
            })
          ) : query ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              {isLoading ? 'Searching Recall…' : `No matches for "${query}"`}
            </div>
          ) : (
            <div className="py-6 px-4 text-center text-xs text-zinc-400 space-y-1">
              <p>Type to search across everything in Recall</p>
              <div className="flex items-center justify-center gap-2 pt-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">Novelle</span>
                <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">Prem Sweets</span>
                <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">DBMS</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </Portal>
);
};
