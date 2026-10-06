'use client';

import React, { useState, useEffect } from 'react';
import { PluginId, PluginIcon, PluginMeta, PLUGINS_DATA } from './PluginIcon';
import { Portal } from './Portal';
import { cn } from '@/lib/utils';
import {
  X,
  ExternalLink,
  Plus,
  Send,
  Loader2,
  Calendar as CalendarIcon,
  Check,
  Mail,
  FileText,
  MessageCircle,
  MapPin,
  Search,
  Clock,
  ArrowRight,
  AlertCircle,
  FileSpreadsheet,
  Folder,
  Navigation,
} from 'lucide-react';
import { CalendarEventItem } from '@/lib/google/calendar';
import { EmailFollowUpSuggestion } from '@/lib/types';
import { DriveFileItem } from '@/lib/google/drive';
import { useUserSession } from '@/lib/user-session';

interface ConnectorSidePanelProps {
  plugin: PluginMeta | null;
  isOpen: boolean;
  onClose: () => void;
  onAskRecall?: (prompt: string) => void;
  onScheduleReminder?: (title: string, dueText: string) => void;
}

export const ConnectorSidePanel: React.FC<ConnectorSidePanelProps> = ({
  plugin,
  isOpen,
  onClose,
  onAskRecall,
  onScheduleReminder,
}) => {
  // All-in-One active connector state
  const [activeId, setActiveId] = useState<PluginId>(plugin?.id || 'calendar');

  useEffect(() => {
    if (plugin?.id) {
      setActiveId(plugin.id);
    }
  }, [plugin?.id]);

  const activePlugin = PLUGINS_DATA.find((p) => p.id === activeId) || plugin || PLUGINS_DATA[0];

  // Calendar state

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [isCalLoading, setIsCalLoading] = useState(false);
  const [isCreatingCal, setIsCreatingCal] = useState(false);
  const [newCalTitle, setNewCalTitle] = useState('');
  const [newCalTime, setNewCalTime] = useState('16:00');
  const [calApiNeeded, setCalApiNeeded] = useState(false);

  // Gmail state
  const [gmailQuery, setGmailQuery] = useState('');
  const [emails, setEmails] = useState<EmailFollowUpSuggestion[]>([]);
  const [isGmailLoading, setIsGmailLoading] = useState(false);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [mailSentStatus, setMailSentStatus] = useState<string | null>(null);

  // Drive state
  const [driveQuery, setDriveQuery] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);

  // WhatsApp state
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [whatsAppTestStatus, setWhatsAppTestStatus] = useState<string | null>(null);
  const [whatsAppDeliveryActive, setWhatsAppDeliveryActive] = useState(true);
  const [whatsAppTokenInput, setWhatsAppTokenInput] = useState('');
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [tokenUpdateFeedback, setTokenUpdateFeedback] = useState<string | null>(null);
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  // Maps state
  const [mapsQuery, setMapsQuery] = useState('');

  // Notion state
  const [notionQuery, setNotionQuery] = useState('');

  // User session & Connected account info
  const { session } = useUserSession();
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      if (session.isGuest) {
        setGoogleEmail(null);
        setWhatsAppRecipient(null);
      } else {
        fetch('/api/google/status', {
          headers: { 'x-session-mode': session.mode },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data?.google?.email) setGoogleEmail(data.google.email);
            if (data?.whatsapp?.recipient) {
              setWhatsAppRecipient(`+${data.whatsapp.recipient.replace(/^\+/, '')}`);
            }
          })
          .catch(() => {});
      }
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, session.mode, session.isGuest]);

  useEffect(() => {
    if (!isOpen) return;

    if (activeId === 'calendar') {
      loadCalendarEvents();
    } else if (activeId === 'gmail') {
      loadGmail();
    } else if (activeId === 'drive') {
      loadDrive();
    } else if (activeId === 'whatsapp') {
      loadWhatsAppConfig();
    }
  }, [isOpen, activeId]);

  const loadWhatsAppConfig = async () => {
    if (session.isGuest) {
      setWhatsAppRecipient(null);
      setIsTokenExpired(false);
      return;
    }

    try {
      const res = await fetch('/api/whatsapp/config', {
        headers: { 'x-session-mode': session.mode },
      });
      const data = await res.json();
      setIsTokenExpired(Boolean(data.isExpired));
      if (data.recipient) {
        setWhatsAppRecipient(`+${data.recipient.replace(/^\+/, '')}`);
      }
      if (data.isExpired) {
        setWhatsAppTestStatus(
          'Authentication Error: Meta Access Token has expired (24h temporary token).'
        );
      }
    } catch (e) {}
  };

  const loadCalendarEvents = async () => {
    setIsCalLoading(true);
    try {
      const res = await fetch('/api/google/calendar/events');
      const data = await res.json();
      if (data.events) {
        setCalendarEvents(data.events);
      }
      setCalApiNeeded(Boolean(data.needsApiEnable));
    } catch (e) {
      console.warn('Failed to load calendar events', e);
    } finally {
      setIsCalLoading(false);
    }
  };

  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalTitle.trim()) return;

    setIsCalLoading(true);
    const now = new Date();
    const [hours, minutes] = newCalTime.split(':').map((v) => parseInt(v, 10));
    now.setHours(hours || 16, minutes || 0, 0, 0);

    try {
      const res = await fetch('/api/google/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCalTitle.trim(),
          start: now.toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success && data.event) {
        setCalendarEvents((prev) => [data.event, ...prev]);
        setNewCalTitle('');
        setIsCreatingCal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCalLoading(false);
    }
  };

  const loadGmail = async (q: string = '') => {
    setIsGmailLoading(true);
    try {
      const res = await fetch(`/api/google/gmail/search?q=${encodeURIComponent(q || 'category:primary')}`);
      const data = await res.json();
      if (data.emails) {
        setEmails(data.emails);
      }
    } catch (e) {
      console.warn('Failed to search emails', e);
    } finally {
      setIsGmailLoading(false);
    }
  };

  const handleSendDraft = async () => {
    if (!draftTo.trim() || !draftSubject.trim()) return;
    setIsSendingMail(true);
    setMailSentStatus(null);
    try {
      const res = await fetch('/api/google/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: draftTo.trim(),
          subject: draftSubject.trim(),
          body: draftBody.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMailSentStatus('✓ Email sent via Gmail');
        setTimeout(() => {
          setIsDrafting(false);
          setDraftTo('');
          setDraftSubject('');
          setDraftBody('');
          setMailSentStatus(null);
        }, 2000);
      } else if (data.needsScope) {
        setMailSentStatus('Notice: Re-connect Google to grant sending scope.');
      } else {
        setMailSentStatus(data.error || 'Failed to send email');
      }
    } catch (e: any) {
      setMailSentStatus(e.message || 'Network error');
    } finally {
      setIsSendingMail(false);
    }
  };

  const loadDrive = async (q: string = '') => {
    setIsDriveLoading(true);
    try {
      const res = await fetch(`/api/google/drive/files?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.files) {
        setDriveFiles(data.files);
      }
    } catch (e) {
      console.warn('Failed to load drive files', e);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setIsTestingWhatsApp(true);
    setWhatsAppTestStatus(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Recall Test Reminder',
          dueText: 'Due now',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWhatsAppTestStatus(
          data.recipient
            ? `✓ WhatsApp message delivered to +${data.recipient.replace(/^\+/, '')}`
            : '✓ WhatsApp test message delivered successfully'
        );
      } else {
        setWhatsAppTestStatus(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setWhatsAppTestStatus(`Network error: ${e.message}`);
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const handleSaveWhatsAppToken = async () => {
    if (!whatsAppTokenInput.trim()) return;
    setIsUpdatingToken(true);
    setTokenUpdateFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: whatsAppTokenInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setTokenUpdateFeedback('✓ Token verified & active!');
        setIsTokenExpired(false);
        setWhatsAppTokenInput('');
        setWhatsAppTestStatus(null);
      } else {
        setTokenUpdateFeedback(`Saved, but Meta replied: ${data.errorDetail || data.message}`);
      }
    } catch (e: any) {
      setTokenUpdateFeedback(`Error: ${e.message}`);
    } finally {
      setIsUpdatingToken(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Edge-to-Edge Full Screen Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-md z-[80] transition-opacity duration-300"
      />

      {/* Floating Apple Workspace Card */}
      <aside
        className="fixed inset-x-0 bottom-0 max-h-[88vh] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[580px] sm:max-h-[84vh] bg-white rounded-t-[24px] sm:rounded-[24px] border border-black/[0.08] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.22)] z-[90] flex flex-col overflow-hidden transition-all duration-300 ease-out animate-in fade-in sm:zoom-in-95"
      >
        {/* Minimal Clean Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.04] flex items-center justify-center shrink-0">
              <PluginIcon id={activePlugin.id} size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-zinc-900 tracking-tight">
                  {activePlugin.name}
                </h2>
                {activePlugin.connected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[10px] font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-500 font-medium">
                {(activePlugin.id === 'calendar' || activePlugin.id === 'gmail' || activePlugin.id === 'drive') && googleEmail ? (
                  <span>Connected as {googleEmail}</span>
                ) : activePlugin.id === 'whatsapp' ? (
                  whatsAppRecipient ? (
                    <span>Connected · {whatsAppRecipient}</span>
                  ) : (
                    <span>Not connected · Configure below</span>
                  )
                ) : (
                  activePlugin.description
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-black/[0.04] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* All-in-One Integrations Switcher Tabs */}
        <div className="px-5 py-2.5 border-b border-black/[0.04] bg-zinc-50/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {PLUGINS_DATA.filter((p) => p.id !== 'recall').map((p) => {
            const isSelected = activeId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer',
                  isSelected
                    ? 'bg-white text-zinc-950 shadow-2xs border border-black/[0.08] font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04]'
                )}
              >
                <PluginIcon id={p.id} size={14} />
                <span>{p.name}</span>
                {p.connected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ==================== 1. GOOGLE CALENDAR ==================== */}
          {activeId === 'calendar' && (
            <div className="space-y-5">
              {/* Account Pill */}
              {googleEmail && (
                <div className="px-3 py-1.5 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 flex items-center justify-between">
                  <span>Google Calendar account</span>
                  <span className="font-medium font-mono">{googleEmail}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsCreatingCal(!isCreatingCal)}
                  className="px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200/60 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New event</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Find free time on my calendar for today and tomorrow');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Find free time</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Look at my Google Calendar schedule and create a plan for today');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Plan around calendar</span>
                </button>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Open Google Calendar</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>

              {/* API Notice if applicable */}
              {calApiNeeded && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Google Cloud Calendar API</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Enable <code className="font-mono bg-amber-100/80 px-1 py-0.2 rounded">calendar-json.googleapis.com</code> in Google Cloud Console project <span className="font-mono font-medium">642561150357</span> to sync with cloud. Local schedule is active below:
                  </p>
                  <a
                    href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=642561150357"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-950 underline pt-0.5"
                  >
                    <span>Enable in Google Cloud Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Minimal Inline Event Creator */}
              {isCreatingCal && (
                <form
                  onSubmit={handleCreateCalendarEvent}
                  className="p-4 rounded-2xl bg-zinc-50/80 border border-black/[0.06] space-y-3 apple-slide-down shadow-xs"
                >
                  <div className="text-xs font-semibold text-zinc-900">Add to Schedule</div>
                  <input
                    type="text"
                    placeholder="Event title (e.g. Sync with Rahul)"
                    value={newCalTitle}
                    onChange={(e) => setNewCalTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-black/[0.08] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-indigo-400"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <input
                      type="time"
                      value={newCalTime}
                      onChange={(e) => setNewCalTime(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-black/[0.08] text-xs text-zinc-800 outline-none font-mono"
                      style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingCal(false)}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newCalTitle.trim()}
                        className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-medium cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                      >
                        Add Event
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Timeline Layout */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Today
                  </div>
                </div>

                {isCalLoading ? (
                  <div className="py-10 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    <span>Loading schedule…</span>
                  </div>
                ) : calendarEvents.length === 0 ? (
                  <div className="py-12 text-center space-y-1">
                    <p className="text-xs font-medium text-zinc-700">Your calendar is clear.</p>
                    <p className="text-[11px] text-zinc-400">No events scheduled for today.</p>
                  </div>
                ) : (
                  <div className="relative pl-4 space-y-3 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-zinc-200">
                    {calendarEvents.map((evt) => {
                      const timeLabel = evt.start?.dateTime
                        ? new Date(evt.start.dateTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : 'All day';
                      const endLabel = evt.end?.dateTime
                        ? new Date(evt.end.dateTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : '';

                      return (
                        <div
                          key={evt.id}
                          className="relative group p-2.5 rounded-xl hover:bg-zinc-50/90 transition-all flex items-start justify-between gap-3 border-b border-black/[0.03] last:border-b-0"
                        >
                          {/* Timeline node */}
                          <div className="absolute -left-[18px] top-3.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-white" />

                          <div className="space-y-0.5 min-w-0">
                            <div className="text-xs font-semibold text-zinc-900 tracking-tight truncate">
                              {evt.summary}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500">
                              {timeLabel} {endLabel ? `– ${endLabel}` : ''}
                            </div>
                            {evt.location && (
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1 truncate pt-0.5">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span>{evt.location}</span>
                              </div>
                            )}
                          </div>

                          <a
                            href={evt.htmlLink || 'https://calendar.google.com'}
                            target="_blank"
                            rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 transition-opacity p-1"
                            title="Open in Google Calendar"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 2. GMAIL ==================== */}
          {activeId === 'gmail' && (
            <div className="space-y-5">
              {/* Account Pill */}
              {googleEmail && (
                <div className="px-3 py-1.5 rounded-xl bg-red-50/60 border border-red-100 text-[11px] text-red-900 flex items-center justify-between">
                  <span>Gmail account</span>
                  <span className="font-medium font-mono">{googleEmail}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Catch me up on my recent emails and urgent requests');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium border border-red-200/50 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Catch me up</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    loadGmail('is:unread label:important');
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Important unread</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrafting(!isDrafting)}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Draft email</span>
                </button>
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Open Gmail</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>

              {/* Minimal Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search mail (e.g. from:Sia, proposal)..."
                  value={gmailQuery}
                  onChange={(e) => {
                    setGmailQuery(e.target.value);
                    loadGmail(e.target.value);
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-50 border border-black/[0.06] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-red-300 transition-all"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>

              {/* Draft Section */}
              {isDrafting && (
                <div className="p-4 rounded-2xl bg-zinc-50 border border-black/[0.06] space-y-2.5 apple-slide-down">
                  <div className="text-xs font-semibold text-zinc-900">New Email Draft</div>
                  <input
                    type="email"
                    placeholder="To: (e.g. sia@company.com)"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-black/[0.08] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                  <input
                    type="text"
                    placeholder="Subject"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-black/[0.08] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                  <textarea
                    rows={3}
                    placeholder="Email body..."
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-black/[0.08] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none resize-none"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                  {mailSentStatus && (
                    <div className="text-[11px] font-medium text-zinc-800 pt-1">
                      {mailSentStatus}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsDrafting(false)}
                      className="px-3 py-1 text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSendDraft}
                      disabled={isSendingMail || !draftTo.trim() || !draftSubject.trim()}
                      className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      {isSendingMail ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Email Items */}
              {isGmailLoading ? (
                <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  <span>Searching mail…</span>
                </div>
              ) : emails.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <p className="text-xs font-medium text-zinc-600">No emails found.</p>
                  <p className="text-[11px] text-zinc-400">Your primary inbox is up to date.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emails.map((m) => {
                    const isExpanded = expandedEmailId === m.id;
                    const initial = m.sender.charAt(0).toUpperCase() || 'M';

                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-zinc-50/70 hover:bg-zinc-100/70 transition-colors space-y-1.5 cursor-pointer border border-black/[0.03]"
                        onClick={() => setExpandedEmailId(isExpanded ? null : m.id)}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 font-semibold text-[10px] flex items-center justify-center">
                              {initial}
                            </div>
                            <span className="font-semibold text-zinc-900">{m.sender}</span>
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {m.relativeTime}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-800 font-medium tracking-tight">
                          {m.subject}
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                          {m.snippet}
                        </p>

                        {isExpanded && (
                          <div
                            className="pt-2 mt-2 border-t border-black/[0.05] flex items-center gap-2 apple-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                onAskRecall?.(
                                  `Summarize this email from ${m.sender} regarding "${m.subject}": ${m.snippet}`
                                );
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Summarize</span>
                            </button>
                            <button
                              onClick={() => {
                                setDraftTo(m.sender);
                                setDraftSubject(`Re: ${m.subject}`);
                                setDraftBody(`Hi ${m.sender},\n\n`);
                                setIsDrafting(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-zinc-700 text-[11px] font-medium cursor-pointer"
                            >
                              Reply
                            </button>
                            <a
                              href="https://mail.google.com"
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto text-zinc-400 hover:text-zinc-700 p-1"
                              title="Open in Gmail"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== 3. GOOGLE DRIVE ==================== */}
          {activeId === 'drive' && (
            <div className="space-y-5">
              {/* Account Pill */}
              {googleEmail && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-900 flex items-center justify-between">
                  <span>Google Drive account</span>
                  <span className="font-medium font-mono">{googleEmail}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Search my Google Drive and answer questions about my documents');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium border border-emerald-200/50 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Ask about a document</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadDrive('')}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Recent files</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Add my recent Google Drive files as knowledge references to Recall');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Add to Recall</span>
                </button>
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Open Drive</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search files (e.g. DBMS, Proposal)..."
                  value={driveQuery}
                  onChange={(e) => {
                    setDriveQuery(e.target.value);
                    loadDrive(e.target.value);
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-50 border border-black/[0.06] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-emerald-300 transition-all"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>

              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  Files & Notes
                </span>

                {isDriveLoading ? (
                  <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    <span>Loading files…</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="py-8 text-center space-y-1">
                    <p className="text-xs font-medium text-zinc-600">No documents found.</p>
                    <p className="text-[11px] text-zinc-400">Search for any file in your Drive above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 rounded-2xl bg-zinc-50/70 hover:bg-zinc-100/70 transition-colors flex items-center justify-between gap-3 group border border-black/[0.03]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white shadow-2xs border border-black/[0.05] flex items-center justify-center shrink-0">
                            {file.iconType === 'pdf' ? (
                              <FileText className="w-4 h-4 text-red-500" />
                            ) : file.iconType === 'sheet' ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            ) : file.iconType === 'folder' ? (
                              <Folder className="w-4 h-4 text-amber-500" />
                            ) : (
                              <FileText className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-zinc-800 truncate">
                              {file.name}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {file.size || 'Google Doc'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              onAskRecall?.(
                                `Read and summarize "${file.name}" from Google Drive and create a plan.`
                              );
                              onClose();
                            }}
                            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Summarize</span>
                          </button>
                          <a
                            href={file.webViewLink || 'https://drive.google.com'}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-zinc-400 hover:text-zinc-700"
                            title="Open in Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 4. WHATSAPP ==================== */}
          {activeId === 'whatsapp' && (
            <div className="space-y-4">
              {/* Clean Disabled Card */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      WhatsApp Connector
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold">
                    Currently Disabled
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  WhatsApp reminders and cloud notifications are currently disabled in this local environment.
                </p>

                <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Status</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Disabled (Local Session)</span>
                </div>
              </div>

              {/* Informative Guidance */}
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-200 space-y-1.5">
                <div className="font-semibold text-xs flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                  <Check className="w-3.5 h-3.5 text-blue-600" />
                  <span>Other Features Active & Smooth</span>
                </div>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  Google Calendar, Recall Flow speech engine, day schedule planning, and in-app reminders are active and running without needing any external WhatsApp configuration.
                </p>
              </div>

              {/* Quick Actions into active features */}
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveId('calendar');
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Open Calendar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Plan my day around meetings and work');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Plan my day</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== 5. MAPS ==================== */}
          {activeId === 'maps' && (
            <div className="space-y-5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search destination, venue, or address..."
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mapsQuery.trim()) {
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          mapsQuery.trim()
                        )}`,
                        '_blank'
                      );
                    }
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-50 border border-black/[0.06] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-red-300 transition-all"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>

              {mapsQuery.trim() && (
                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-black/[0.06] space-y-2 apple-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-zinc-900 truncate">
                      {mapsQuery}
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">Location Result</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>Estimated travel: ~15-20 min</span>
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        mapsQuery.trim()
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-[11px] font-medium flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  Quick Directions
                </span>

                <div className="space-y-2">
                  <div className="p-3.5 rounded-2xl bg-zinc-50/70 hover:bg-zinc-100/70 transition-colors flex items-center justify-between border border-black/[0.03]">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Prem Sweets</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">Gandhi Nagar · ~18 min away</div>
                    </div>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=Prem+Sweets+Gandhi+Nagar"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-[11px] font-medium flex items-center gap-1 hover:bg-black shadow-xs cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-50/70 hover:bg-zinc-100/70 transition-colors flex items-center justify-between border border-black/[0.03]">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">College Campus</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">Main Hall · ~12 min away</div>
                    </div>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=College+Campus"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-[11px] font-medium flex items-center gap-1 hover:bg-black shadow-xs cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 6. NOTION ==================== */}
          {activeId === 'notion' && (
            <div className="space-y-5">
              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Save my active Recall tasks into Notion');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-black text-white text-xs font-medium shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save to Notion</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Create a new Notion page for my project notes');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Create page</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAskRecall?.('Show recent pages Recall created or synced with Notion');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Recent Recall pages</span>
                </button>
                <a
                  href="https://notion.so"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-zinc-700 text-xs font-medium border border-black/[0.04] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Open Notion</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search workspace (e.g. Novelle, DBMS)..."
                  value={notionQuery}
                  onChange={(e) => setNotionQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-50 border border-black/[0.06] text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:border-zinc-400 transition-all"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>

              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  Workspace Pages
                </span>

                <div className="space-y-2">
                  {[
                    { title: 'Novelle', tag: 'Project', modified: 'Yesterday' },
                    { title: 'DBMS Notes', tag: 'Study', modified: 'Today' },
                    { title: 'Ideas & Backlog', tag: 'Notes', modified: '3 days ago' },
                  ].map((page) => (
                    <div
                      key={page.title}
                      className="p-3 rounded-2xl bg-zinc-50/70 hover:bg-zinc-100/70 transition-colors flex items-center justify-between gap-3 group border border-black/[0.03]"
                    >
                      <div>
                        <div className="text-xs font-semibold text-zinc-800">{page.title}</div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {page.tag} · {page.modified}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onAskRecall?.(`Summarize my Notion page "${page.title}"`);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-zinc-700 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Ask Recall</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </Portal>
  );
};
