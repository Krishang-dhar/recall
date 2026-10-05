'use client';

import React, { useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { PluginIcon, PluginMeta } from './PluginIcon';

interface ConnectPluginsPopoverProps {
  plugins: PluginMeta[];
  onTogglePlugin: (plugin: PluginMeta) => void;
  onClose: () => void;
}

export const ConnectPluginsPopover: React.FC<ConnectPluginsPopoverProps> = ({
  plugins,
  onTogglePlugin,
  onClose,
}) => {
  const [search, setSearch] = useState('');

  const filtered = plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-[380px] sm:w-[380px] rounded-[22px] glass-popover p-3.5 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 z-50 text-left select-none"
    >
      {/* Search Input */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/[0.04] border border-black/[0.04]">
        <Search className="w-3.5 h-3.5 text-zinc-400 stroke-[2]" />
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps..."
          className="bg-transparent text-xs text-zinc-800 placeholder-zinc-400 outline-none w-full"
        />
      </div>

      {/* App List */}
      <div className="flex flex-col gap-1 max-h-[340px] overflow-y-auto py-1 pr-1">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-400">
            No matching apps found.
          </div>
        ) : (
          filtered.map((plugin) => (
            <div
              key={plugin.id}
              onClick={() => onTogglePlugin(plugin)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-black/[0.03] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                {/* Official Icon inside small tile */}
                <div className="w-8 h-8 rounded-lg bg-white border border-black/[0.06] shadow-2xs flex items-center justify-center shrink-0">
                  <PluginIcon id={plugin.id} size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-800 truncate">
                    {plugin.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate leading-snug">
                    {plugin.description}
                  </div>
                </div>
              </div>

              {/* Action Button: Connected ✓, Connect +, Automatic ✓ */}
              <div className="shrink-0 flex items-center">
                {plugin.id === 'maps' ? (
                  <span className="text-[11px] font-medium text-zinc-600 bg-black/[0.04] px-2 py-0.5 rounded-full flex items-center gap-1">
                    Automatic ✓
                  </span>
                ) : plugin.connected ? (
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    Connected ✓
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-zinc-500 bg-black/[0.04] group-hover:bg-zinc-900 group-hover:text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-colors">
                    Connect +
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
