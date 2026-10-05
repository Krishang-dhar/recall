'use client';

import React, { useState } from 'react';
import { PluginIcon, PluginMeta } from './PluginIcon';
import { ChevronRight } from 'lucide-react';

interface ConnectedPluginsBarProps {
  plugins: PluginMeta[];
  onTogglePlugin?: (plugin: PluginMeta) => void;
  onOpenSidePanel: (plugin: PluginMeta) => void;
  onAskRecall?: (prompt: string) => void;
  pulsingPluginId?: string | null;
}

export const ConnectedPluginsBar: React.FC<ConnectedPluginsBarProps> = ({
  plugins,
  onOpenSidePanel,
  pulsingPluginId,
}) => {
  const [hoveredPlugin, setHoveredPlugin] = useState<PluginMeta | null>(null);

  return (
    <div className="w-full flex items-center justify-between gap-3 px-1 py-1">
      {/* Left: Compact Connected Apps Row */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-medium text-zinc-400 select-none">
          Connected apps
        </span>

        <div className="flex items-center gap-1.5">
          {plugins.map((plugin) => {
            const isPulsing = pulsingPluginId === plugin.id;

            return (
              <div
                key={plugin.id}
                className="relative group shrink-0"
                onMouseEnter={() => setHoveredPlugin(plugin)}
                onMouseLeave={() => setHoveredPlugin(null)}
              >
                <button
                  type="button"
                  onClick={() => onOpenSidePanel(plugin)}
                  className={`relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer select-none transition-all duration-150 ${
                    plugin.connected
                      ? 'bg-white hover:bg-zinc-50 border border-black/[0.06] shadow-2xs hover:shadow-xs'
                      : 'bg-zinc-100/60 hover:bg-zinc-100 border border-black/[0.03] opacity-40 hover:opacity-80'
                  } ${
                    isPulsing
                      ? 'ring-2 ring-[#0052FF]/60 shadow-[0_0_10px_rgba(0,82,255,0.3)] scale-105'
                      : ''
                  }`}
                  aria-label={plugin.name}
                >
                  <PluginIcon id={plugin.id} size={16} />

                  {/* Connected subtle green dot */}
                  {plugin.connected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#262626]" />
                  )}
                </button>

                {/* Clean Floating Tooltip */}
                {hoveredPlugin?.id === plugin.id && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 pointer-events-none apple-fade-in">
                    <div className="px-2 py-1 rounded-lg bg-zinc-900 text-white text-[10px] font-medium shadow-md whitespace-nowrap flex items-center gap-1.5">
                      <span>{plugin.name}</span>
                      <span className="text-zinc-400">·</span>
                      <span className={plugin.connected ? 'text-emerald-400' : 'text-zinc-400'}>
                        {plugin.connected ? 'Active' : 'Click to connect'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Quick shortcut to integrations workspace */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() =>
            onOpenSidePanel(plugins.find((p) => p.id === 'calendar') || plugins[0])
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-medium transition-colors cursor-pointer"
        >
          <span>Integrations</span>
          <ChevronRight className="w-3 h-3 text-zinc-400" />
        </button>
      </div>
    </div>
  );
};
