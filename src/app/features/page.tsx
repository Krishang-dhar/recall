'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  X,
  Info,
} from 'lucide-react';
import { RECALL_SLASH_COMMANDS, SlashCommand } from '@/lib/slash-commands';
import {
  RECALL_FEATURES,
  FeatureToggleItem,
  getFeaturesState,
  setFeatureEnabled,
} from '@/lib/features-store';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function FeaturesPage() {
  const router = useRouter();
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'tools' | 'commands'>('all');
  const [infoModalItem, setInfoModalItem] = useState<{
    type: 'feature' | 'command';
    title: string;
    description: string;
    details: string;
    example?: string;
    category: string;
    id: string;
    isEnabled?: boolean;
    configHref?: string;
  } | null>(null);

  useEffect(() => {
    setFeatureStates(getFeaturesState());

    const handleFeatureChanged = (e: any) => {
      if (e.detail?.all) setFeatureStates(e.detail.all);
    };
    window.addEventListener('recall-features-changed', handleFeatureChanged);

    return () => {
      window.removeEventListener('recall-features-changed', handleFeatureChanged);
    };
  }, []);

  const handleToggle = (id: string) => {
    const next = !featureStates[id];
    setFeatureStates((prev) => ({ ...prev, [id]: next }));
    setFeatureEnabled(id, next);
    if (infoModalItem && infoModalItem.id === id) {
      setInfoModalItem((prev) => (prev ? { ...prev, isEnabled: next } : null));
    }
  };

  const handleRunCommand = (cmd: SlashCommand) => {
    router.push(`/?prompt=${encodeURIComponent(cmd.command + ' ')}`);
  };

  // Filter features & commands
  const filteredFeatures = RECALL_FEATURES.filter((f) => {
    if (activeTab === 'commands') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
  });

  const filteredCommands = RECALL_SLASH_COMMANDS.filter((cmd) => {
    if (activeTab === 'tools') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return cmd.command.toLowerCase().includes(q) || cmd.label.toLowerCase().includes(q);
  });

  const openFeatureInfo = (f: FeatureToggleItem) => {
    const isEnabled = featureStates[f.id] ?? f.defaultEnabled;
    setInfoModalItem({
      type: 'feature',
      id: f.id,
      title: f.name,
      description: f.description,
      details: `Autonomous background capability in Recall. Works seamlessly with your day timeline, reminders, and voice instructions.`,
      category: f.section,
      isEnabled,
      configHref: f.configHref,
    });
  };

  const openCommandInfo = (cmd: SlashCommand) => {
    setInfoModalItem({
      type: 'command',
      id: cmd.id,
      title: cmd.label,
      description: cmd.description,
      details: `Type ${cmd.command} in the composer. It will highlight in blue so you can add extra context before sending.`,
      example: cmd.example,
      category: 'Slash Command',
    });
  };

  const activeCount = Object.values(featureStates).filter(Boolean).length;

  return (
    <div className="w-full max-w-[900px] mx-auto flex flex-col gap-6 pb-24 pt-2 font-sans apple-fade-in text-zinc-900 dark:text-zinc-100">
      {/* ── 1. SHADCN CLEAN HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Tools
            </h1>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
              ({activeCount} enabled)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Configure assistant capabilities, integrations, and keyboard shortcuts.
          </p>
        </div>

        <Link href="/settings">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-md">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Settings</span>
          </Button>
        </Link>
      </div>

      {/* ── 2. SHADCN TABS & SEARCH BAR ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Segmented shadcn tabs */}
        <div className="inline-flex h-8 items-center rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-0.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer',
              activeTab === 'all'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-2xs font-semibold'
                : 'hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={cn(
              'inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer',
              activeTab === 'tools'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-2xs font-semibold'
                : 'hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            Tools
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('commands')}
            className={cn(
              'inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer',
              activeTab === 'commands'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-2xs font-semibold'
                : 'hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            Commands (/)
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools & commands..."
            className="h-8 rounded-md pl-8 pr-7 text-xs bg-white/70 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── 3. SHADCN TOOLS GRID ──────────────────────────────────────────── */}
      {activeTab !== 'commands' && filteredFeatures.length > 0 && (
        <div className="space-y-3">
          {activeTab === 'all' && (
            <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Capabilities
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredFeatures.map((f) => {
              const isEnabled = featureStates[f.id] ?? f.defaultEnabled;

              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/40 p-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                        {f.name}
                      </span>
                      {f.badge && (
                        <kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 px-1 font-mono text-[9px] font-medium text-zinc-500">
                          {f.badge}
                        </kbd>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {f.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openFeatureInfo(f)}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 cursor-pointer"
                      title={`About ${f.name}`}
                    >
                      <Info className="h-3.5 w-3.5 stroke-[2]" />
                    </button>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggle(f.id)}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. SHADCN COMMANDS GRID ───────────────────────────────────────── */}
      {activeTab !== 'tools' && filteredCommands.length > 0 && (
        <div className="space-y-3">
          {activeTab === 'all' && (
            <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pt-2">
              Commands
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/40 p-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="space-y-0.5 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 px-1.5 font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {cmd.command}
                    </kbd>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                      {cmd.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {cmd.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openCommandInfo(cmd)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 cursor-pointer"
                    title={`About ${cmd.command}`}
                  >
                    <Info className="h-3.5 w-3.5 stroke-[2]" />
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunCommand(cmd)}
                    className="h-7 px-2.5 text-xs rounded-md"
                  >
                    Run
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. SHADCN DIALOG FOR INFO (i) ─────────────────────────────────── */}
      {infoModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-lg space-y-4 relative animate-in zoom-in-95 duration-100">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setInfoModalItem(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-6">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 tracking-tight">
                  {infoModalItem.title}
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {infoModalItem.description}
              </p>
            </div>

            {/* Details Box */}
            <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs text-zinc-600 dark:text-zinc-300 space-y-2 leading-relaxed">
              <p>{infoModalItem.details}</p>

              {infoModalItem.example && (
                <div className="pt-1">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Syntax:</span>
                  <div className="mt-1 font-mono text-[11px] p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {infoModalItem.example}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              {infoModalItem.type === 'feature' ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={infoModalItem.isEnabled ?? true}
                    onCheckedChange={() => handleToggle(infoModalItem.id)}
                    size="sm"
                  />
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">
                    {infoModalItem.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-zinc-400">Recall Command</span>
              )}

              <div className="flex items-center gap-2">
                {infoModalItem.configHref && (
                  <Link href={infoModalItem.configHref}>
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-md">
                      Configure
                    </Button>
                  </Link>
                )}

                {infoModalItem.type === 'command' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs rounded-md"
                    onClick={() => {
                      const cmd = RECALL_SLASH_COMMANDS.find((c) => c.id === infoModalItem.id);
                      if (cmd) handleRunCommand(cmd);
                    }}
                  >
                    Use in Composer
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
