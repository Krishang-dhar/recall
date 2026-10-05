'use client';

import React, { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';
import { overlayManager } from '@/lib/overlay-manager';
import { Portal } from './Portal';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool?: PluginId;
  itemName: string;
  itemSubtitle?: string; // e.g. "Today · 4 PM"
  confirmLabel?: string;
  onConfirm: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  tool,
  itemName,
  itemSubtitle,
  confirmLabel = 'Delete',
  onConfirm,
}) => {
  useEffect(() => {
    if (isOpen) {
      overlayManager.open('task-composer');
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Full Screen Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-md z-[80] transition-opacity duration-200"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-[340px] rounded-[22px] bg-white border border-black/[0.08] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.14)] pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div className="text-sm font-semibold text-zinc-900">Delete?</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Item */}
          <div className="mx-5 mb-5 p-3.5 rounded-xl bg-zinc-50 border border-black/[0.05]">
            {tool && (
              <div className="flex items-center gap-2 mb-2">
                <PluginIcon id={tool} size={14} />
              </div>
            )}
            <div className="text-sm font-medium text-zinc-900 leading-snug">"{itemName}"</div>
            {itemSubtitle && (
              <div className="text-xs text-zinc-400 mt-1">{itemSubtitle}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
