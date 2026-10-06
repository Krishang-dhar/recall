'use client';

import React from 'react';

export type PluginId = 'whatsapp' | 'calendar' | 'gmail' | 'notion' | 'drive' | 'maps' | 'recall';

export interface PluginMeta {
  id: PluginId;
  name: string;
  description: string;
  connected: boolean;
  statusText?: string;
  color: string;
}

export const PLUGINS_DATA: PluginMeta[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Instant reminders (Currently disabled)',
    connected: false,
    statusText: 'Disabled',
    color: '#25D366',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Schedule, meetings and free time',
    connected: false,
    statusText: 'Connect',
    color: '#4285F4',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Search, summarize and send email',
    connected: false,
    statusText: 'Connect',
    color: '#EA4335',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notes and workspace knowledge',
    connected: false,
    statusText: 'Connect',
    color: '#000000',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Files, documents and study material',
    connected: false,
    statusText: 'Connect',
    color: '#0F9D58',
  },
  {
    id: 'maps',
    name: 'Maps',
    description: 'Places and directions',
    connected: true,
    statusText: 'Automatic',
    color: '#EA4335',
  },
];

export const PluginIcon: React.FC<{
  id: PluginId;
  size?: number;
  className?: string;
}> = ({ id, size = 22, className = '' }) => {
  switch (id) {
    case 'maps':
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/icons/maps.png"
          alt="Google Maps"
          width={size}
          height={size}
          className={`object-contain ${className}`}
        />
      );
    case 'calendar':
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/icons/calendar.webp"
          alt="Google Calendar"
          width={size}
          height={size}
          className={`object-contain ${className}`}
        />
      );
    case 'gmail':
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/icons/gmail.svg"
          alt="Gmail"
          width={size}
          height={size}
          className={`object-contain ${className}`}
        />
      );
    case 'whatsapp':
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/icons/whatsapp.svg"
          alt="WhatsApp"
          width={size}
          height={size}
          className={`object-contain ${className}`}
        />
      );
    case 'notion':
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/icons/notion.png"
          alt="Notion"
          width={size}
          height={size}
          className={`object-contain ${className}`}
        />
      );
    case 'drive':
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/icons/drive.svg"
          alt="Google Drive"
          width={size}
          height={size}
          className={`object-contain ${className}`}
        />
      );
    case 'recall':
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/recall-logo.png"
          alt="Recall"
          width={size}
          height={size}
          className={`object-contain ${className}`}
        />
      );
    default:
      return null;
  }
};
