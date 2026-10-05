'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';
import { overlayManager } from '@/lib/overlay-manager';
import { Portal } from './Portal';

export interface BulkPreviewItem {
  id: string;
  title: string;
  subtitle?: string; // time, date info
}

interface BulkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool: PluginId;
  actionLabel: string;       // e.g. "Delete" 
  itemsLabel?: string;       // e.g. "calendar events"
  dateLabel?: string;        // e.g. "Tomorrow" 
  items: BulkPreviewItem[];
  confirmLabel?: string;     // e.g. "Delete 5 events"
  onConfirm: (selectedIds: string[]) => void;
}

export const BulkPreviewModal: React.FC<BulkPreviewModalProps> = ({
  isOpen,
  onClose,
  tool,
  actionLabel,
  itemsLabel = 'items',
  dateLabel,
  items,
  confirmLabel,
  onConfirm,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map((i) => i.id)));

  // Reset selections when items change
  useEffect(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  useEffect(() => {
    if (isOpen) {
      overlayManager.open('task-composer'); // reuse modal slot
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const confirmText = confirmLabel || `${actionLabel} ${selectedCount} ${itemsLabel}`;

  return (
    <Portal>
      {/* Full Screen Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-md z-[80] transition-opacity duration-200"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-[420px] rounded-[24px] bg-white border border-black/[0.08] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.16)] pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-black/[0.05]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[12px] bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  {actionLabel} {selectedCount} {itemsLabel}?
                </div>
                {dateLabel && (
                  <div className="text-[11px] text-zinc-400 mt-0.5">{dateLabel}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Item List */}
          <div className="px-6 py-3 max-h-[40vh] overflow-y-auto space-y-1">
            {items.map((item) => {
              const checked = selectedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    checked ? 'bg-red-50/60' : 'hover:bg-zinc-50'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all ${
                      checked
                        ? 'bg-red-500 border-red-500'
                        : 'border-zinc-300'
                    }`}
                  >
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-zinc-900 truncate">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-[11px] text-zinc-400 mt-0.5">{item.subtitle}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-6 pb-6 pt-3 border-t border-black/[0.05]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                if (selectedCount > 0) {
                  onConfirm(Array.from(selectedIds));
                  onClose();
                }
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCount > 0
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-xs active:scale-[0.98]'
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
