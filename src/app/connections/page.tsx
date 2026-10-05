'use client';

import React, { useState, useEffect } from 'react';
import { GlassPanel } from '@/components/GlassPanel';
import { PluginIcon, PluginMeta, PLUGINS_DATA } from '@/components/PluginIcon';
import { ConnectorSidePanel } from '@/components/ConnectorSidePanel';
import { Check, Plus, ExternalLink, ArrowRight } from 'lucide-react';
import { useUserSession } from '@/lib/user-session';

export default function ConnectionsPage() {
  const { session } = useUserSession();
  const [plugins, setPlugins] = useState<PluginMeta[]>(PLUGINS_DATA);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginMeta | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [whatsAppNumber, setWhatsAppNumber] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch('/api/google/status', {
          headers: { 'x-session-mode': session.mode },
        });
        const data = await res.json();
        if (data?.google?.connected) {
          const email = data.google.email || 'Connected Google Account';
          setGoogleEmail(email);
          setPlugins((prev) =>
            prev.map((p) =>
              p.id === 'calendar' || p.id === 'gmail' || p.id === 'drive'
                ? { ...p, connected: true, statusText: `Connected as ${email}` }
                : p
            )
          );
        } else {
          setGoogleEmail(null);
          setPlugins((prev) =>
            prev.map((p) =>
              p.id === 'calendar' || p.id === 'gmail' || p.id === 'drive'
                ? { ...p, connected: false, statusText: 'Configure' }
                : p
            )
          );
        }
        if (data?.whatsapp?.connected && data?.whatsapp?.recipient) {
          setWhatsAppNumber(`+${data.whatsapp.recipient.replace(/^\+/, '')}`);
          setPlugins((prev) =>
            prev.map((p) =>
              p.id === 'whatsapp'
                ? { ...p, connected: true, statusText: 'Connected' }
                : p
            )
          );
        } else {
          setWhatsAppNumber(null);
          setPlugins((prev) =>
            prev.map((p) =>
              p.id === 'whatsapp'
                ? { ...p, connected: false, statusText: 'Configure' }
                : p
            )
          );
        }
      } catch (e) {}
    }
    loadStatus();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected') === 'google') {
        setFeedback('Google Workspace connected successfully.');
        window.history.replaceState({}, '', '/connections');
      }
    }
  }, []);

  const handlePluginClick = (plugin: PluginMeta) => {
    setSelectedPlugin(plugin);
    setIsPanelOpen(true);
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 md:pb-12 max-w-[760px] mx-auto apple-fade-in">
      {/* Header */}
      <section className="pt-2 sm:pt-4">
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
          Connections
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Connected tools Recall can access to read schedule, emails, files, and send reminders.
        </p>
      </section>

      {feedback && (
        <div className="py-2.5 px-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 font-medium flex items-center justify-between">
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-indigo-400 hover:text-indigo-700 text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Integration List Surface */}
      <GlassPanel className="p-2 sm:p-3 divide-y divide-black/[0.04]">
        {plugins.map((plugin) => {
          const isGoogle = plugin.id === 'calendar' || plugin.id === 'gmail' || plugin.id === 'drive';
          const subtitle = isGoogle && plugin.connected && googleEmail
            ? `Connected as ${googleEmail}`
            : plugin.id === 'whatsapp'
            ? plugin.connected && whatsAppNumber ? `Connected · ${whatsAppNumber}` : plugin.description
            : plugin.id === 'maps'
            ? 'Built-in navigation & travel times'
            : plugin.description;

          return (
            <div
              key={plugin.id}
              onClick={() => handlePluginClick(plugin)}
              className="flex items-center justify-between py-4 px-3 sm:px-4 gap-4 hover:bg-zinc-50/60 rounded-xl transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-black/[0.06] shadow-xs group-hover:scale-105 transition-transform">
                  <PluginIcon id={plugin.id} size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 tracking-tight flex items-center gap-1.5">
                    <span>{plugin.name}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {plugin.connected ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePluginClick(plugin);
                    }}
                    className="flex items-center gap-1 text-zinc-700 hover:text-zinc-950 bg-black/[0.03] hover:bg-black/[0.06] border border-black/[0.06] px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span>Manage</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (plugin.id === 'calendar' || plugin.id === 'gmail' || plugin.id === 'drive') {
                        window.location.href = '/api/auth/google?returnTo=/connections';
                      } else {
                        handlePluginClick(plugin);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-all shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Connect</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </GlassPanel>

      {/* Side Panel Drawer */}
      <ConnectorSidePanel
        plugin={selectedPlugin}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}
