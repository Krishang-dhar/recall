export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'completed';

export type AssistantType = 'recall' | 'study' | 'planner' | 'writer';

export interface Task {
  id: string;
  title: string;
  note?: string | null;
  due_at: string; // ISO string with timezone
  end_time?: string | null; // ISO string for meetings/events
  priority: TaskPriority;
  status: TaskStatus;
  whatsapp_sent: boolean;
  location?: string | null;
  calendar_event_id?: string | null;
  whatsapp_reminder_id?: string | null;
  reminder_time?: string | null;
  is_meeting?: boolean;
  projectId?: string | null;
  project_name?: string | null;
  created_at: string;
}

export interface DayPlanItem {
  id: string;
  time: string;
  title: string;
  category?: 'meeting' | 'study' | 'task' | 'break';
  done?: boolean;
}

export interface Attachment {
  id: string;
  conversationId?: string;
  projectId?: string;
  name: string;
  type: string;
  url: string;
  size?: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  planData?: DayPlanItem[];
  actionExecuted?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string;
  projectName?: string;
  assistantType: AssistantType;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface Project {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  conversationCount?: number;
  taskCount?: number;
  fileCount?: number;
  createdAt: string;
}

export interface GeminiParsedTask {
  title: string;
  due_at: string; // ISO string
  note?: string | null;
  priority: TaskPriority;
  location?: string | null;
  formatted_time_label?: string; // e.g. "Tomorrow · 4:00 PM"
  actions?: {
    createReminder?: boolean;
    addToCalendar?: boolean;
    hasLocation?: boolean;
    checkEmails?: boolean;
    findFollowUps?: boolean;
    searchQuery?: string;
  };
}

export interface IntegrationRecord {
  id: string;
  provider: 'google' | 'whatsapp';
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scopes?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EmailFollowUpSuggestion {
  id: string;
  sender: string;
  subject: string;
  date: string;
  snippet: string;
  relativeTime: string;
}
