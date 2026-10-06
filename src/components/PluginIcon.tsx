'use client';

import React from 'react';

export type PluginId =
  | 'apple'
  | 'google'
  | 'whatsapp'
  | 'notion'
  | 'calendar'
  | 'gmail'
  | 'drive'
  | 'maps'
  | 'recall';

export interface PluginMeta {
  id: PluginId;
  name: string;
  description: string;
  connected: boolean;
  statusText?: string;
  color: string;
}

export const MAIN_CONNECTORS: PluginMeta[] = [
  {
    id: 'apple',
    name: 'Apple',
    description: 'Calendar · Reminders · Notifications',
    connected: true,
    statusText: 'Connected',
    color: '#000000',
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Calendar · Gmail · Drive',
    connected: false,
    statusText: 'Connect',
    color: '#4285F4',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Reminders',
    connected: false,
    statusText: 'Connect',
    color: '#25D366',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notes & Workspace',
    connected: false,
    statusText: 'Connect',
    color: '#000000',
  },
];

export const PLUGINS_DATA: PluginMeta[] = [
  ...MAIN_CONNECTORS,
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
    case 'google':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 ${className}`}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
      );
    case 'apple':
      return (
        <svg
          viewBox="0 0 170 170"
          width={size}
          height={size}
          fill="currentColor"
          className={`shrink-0 ${className}`}
        >
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.65-7.73-11.83-14.07-5.55-8.48-9.96-18.44-13.23-29.87-3.26-11.43-4.89-22.39-4.89-32.88 0-14.13 3.59-26.04 10.77-35.73 7.18-9.69 16.27-14.65 27.27-14.89 5.22 0 11.07 1.41 17.55 4.23 6.48 2.82 10.42 4.35 11.82 4.6 2.39-.43 6.64-2.07 12.74-4.91 6.1-2.84 11.66-4.13 16.68-3.87 12.63.76 22.75 5.54 30.36 14.34-11.01 6.74-16.39 16.09-16.14 28.05.25 9.35 3.86 17.27 10.82 23.77 6.96 6.5 15.11 10.33 24.45 11.49-2.17 6.53-4.78 13.06-7.84 19.59zM119.22 31.84c0-7.39 2.66-14.46 7.98-21.21 5.32-6.75 12.01-11.23 20.07-13.43.33 1.3.54 2.39.65 3.26.11.87.16 2.07.16 3.59 0 7.39-2.77 14.35-8.31 20.88-5.54 6.53-12.39 10.77-20.55 12.72-.11-1.3-.27-2.4-.48-3.3-.21-.9-.35-2-.42-3.3-.78.43-1.46.7-2.04.81l2.94-3.02z" />
        </svg>
      );
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
