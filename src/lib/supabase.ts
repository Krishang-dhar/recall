import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Task } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('example.com')
);

// Fallback in-memory / local storage sample tasks for instant testability
export const INITIAL_MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: 'Send Novelle quotation',
    note: 'Attach updated pricing deck and service terms',
    due_at: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
    priority: 'high',
    status: 'pending',
    whatsapp_sent: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Call Prem Sweets',
    note: 'Confirm batch order delivery schedule for Diwali hampers',
    due_at: new Date(new Date().setHours(14, 30, 0, 0)).toISOString(),
    priority: 'urgent',
    status: 'pending',
    whatsapp_sent: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Review packaging samples',
    note: 'Check matte laminate quality with vendor',
    due_at: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(),
    priority: 'medium',
    status: 'pending',
    whatsapp_sent: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Follow up with Nishakar',
    note: 'Check partnership contract feedback',
    due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'medium',
    status: 'pending',
    whatsapp_sent: false,
    created_at: new Date().toISOString(),
  },
];

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}
