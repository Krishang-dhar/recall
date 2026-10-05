'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, Check, Clock } from 'lucide-react';
import { PluginIcon, PluginId } from './PluginIcon';

interface ActionRecord {
  id: string;
  tool: string;
  action: string;
  label: string;
  timestamp: string;
  status: 'completed' | 'undone' | 'redone' | 'failed';
  undoable: string;
}

interface ActionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onUndoAction?: (actionId: string) => void;
}

export const ActionHistory: React.FC<ActionHistoryProps> = ({ isOpen, onClose, onUndoAction }) => {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/actions/history?limit=30');
      const data = await res.json();
      if (data.success) {
        setActions(data.actions);
      }
    } catch (e) {
      console.warn('Failed to load action history');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Group by Today / Yesterday / Earlier
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterdayStr = new Date(now.getTime() - 86400000).toDateString();

  type Group = { label: string; items: ActionRecord[] };
  const groups: Group[] = [];
  const addToGroup = (label: string, item: ActionRecord) => {
    const g = groups.find((g) => g.label === label);
    if (g) g.items.push(item);
    else groups.push({ label, items: [item] });
  };

  for (const a of actions) {
    const d = new Date(a.timestamp).toDateString();
    if (d === todayStr) addToGroup('Today', a);
    else if (d === yesterdayStr) addToGroup('Yesterday', a);
    else addToGroup('Earlier', a);
  }

  const toolIcon = (tool: string) => {
    const validIds: PluginId[] = ['calendar', 'gmail', 'drive', 'whatsapp', 'notion', 'maps', 'recall'];
    const id = validIds.includes(tool as PluginId) ? (tool as PluginId) : 'recall';
    return <PluginIcon id={id} size={14} />;
  };

  const statusIcon = (status: string) => {
    if (status === 'undone') return <RotateCcw className="w-3 h-3 text-amber-500" />;
    if (status === 'redone') return <RotateCcw className="w-3 h-3 text-blue-500" />;
    if (status === 'failed') return <span className="w-3 h-3 text-red-400">✕</span>;
    return <Check className="w-3 h-3 text-emerald-500" />;
  };

  const timeStr = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[40] bg-transparent" />
      <div className="absolute right-0 top-full mt-2 z-[50] w-[320px] max-h-[480px] flex flex-col rounded-[20px] bg-white border border-black/[0.08] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04]">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-900">Recent Actions</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-zinc-400">Loading…</div>
          ) : actions.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">No actions yet.</div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((action) => {
                  const canUndo =
                    action.status === 'completed' && action.undoable !== 'not_undoable';
                  return (
                    <div
                      key={action.id}
                      className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-zinc-50 transition-colors"
                    >
                      {/* Tool icon */}
                      <div className="mt-0.5 shrink-0 opacity-70">{toolIcon(action.tool)}</div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(action.status)}
                          <span className="text-xs text-zinc-800 leading-tight truncate">
                            {action.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{timeStr(action.timestamp)}</div>
                      </div>

                      {/* Undo chip */}
                      {canUndo && onUndoAction && (
                        <button
                          type="button"
                          onClick={() => {
                            onUndoAction(action.id);
                            onClose();
                          }}
                          className="shrink-0 px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-[10px] font-medium text-zinc-700 transition-colors cursor-pointer"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
