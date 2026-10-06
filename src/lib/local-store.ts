import fs from 'fs';
import path from 'path';
import { Task, Conversation, Message, Project, Attachment, AssistantType } from './types';
import { sendWhatsAppText } from './whatsapp';
import { dispatchAppleNotification } from './apple-notifications';

const DATA_DIR = path.join(process.cwd(), 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const ATTACHMENTS_FILE = path.join(DATA_DIR, 'attachments.json');

// Clean start: no demo or fake data
const DEFAULT_PROJECTS: Project[] = [];
const DEFAULT_CONVERSATIONS: Conversation[] = [];
const DEFAULT_ATTACHMENTS: Attachment[] = [];

// Ensure data directory and files exist
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(CONVERSATIONS_FILE)) {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(ATTACHMENTS_FILE)) {
    fs.writeFileSync(ATTACHMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/* ==================== PROJECTS ==================== */
export function getAllProjects(): Project[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
    const projects: Project[] = JSON.parse(raw);
    const tasks = getAllTasks();
    const convs = getAllConversations();
    const atts = getAllAttachments();

    return projects.map((p) => ({
      ...p,
      taskCount: tasks.filter((t) => t.projectId === p.id).length,
      conversationCount: convs.filter((c) => c.projectId === p.id).length,
      fileCount: atts.filter((a) => a.projectId === p.id).length,
    }));
  } catch (err) {
    console.error('Error reading projects:', err);
    return DEFAULT_PROJECTS;
  }
}

export function getProjectById(id: string): Project | null {
  const projects = getAllProjects();
  return projects.find((p) => p.id === id) || null;
}

export function createProject(name: string, description?: string, color?: string): Project {
  ensureStorage();
  const projects = getAllProjects();
  const newProject: Project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    description: description?.trim() || '',
    color: color || '#0052FF',
    createdAt: new Date().toISOString(),
  };
  projects.push(newProject);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  return newProject;
}

export function deleteProject(id: string): boolean {
  ensureStorage();
  const projects = getAllProjects();
  const filtered = projects.filter((p) => p.id !== id);
  if (filtered.length === projects.length) return false;
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  return true;
}

/* ==================== CONVERSATIONS ==================== */
export function getAllConversations(): Conversation[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
    const convs: Conversation[] = JSON.parse(raw);
    return Array.isArray(convs) ? convs : [];
  } catch (err) {
    console.error('Error reading conversations:', err);
    return [];
  }
}

export function getConversationById(id: string): Conversation | null {
  const convs = getAllConversations();
  return convs.find((c) => c.id === id) || null;
}

export function createConversation(data: {
  title?: string;
  projectId?: string;
  assistantType?: AssistantType;
  initialMessage?: string;
}): Conversation {
  ensureStorage();
  const convs = getAllConversations();
  const projects = getAllProjects();
  const project = data.projectId ? projects.find((p) => p.id === data.projectId) : undefined;

  const newConv: Conversation = {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: data.title?.trim() || 'New conversation',
    projectId: data.projectId,
    projectName: project?.name,
    assistantType: data.assistantType || 'recall',
    lastMessage: data.initialMessage,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinned: false,
    archived: false,
  };

  convs.unshift(newConv);
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(convs, null, 2), 'utf-8');
  syncConversationToDesktopVault(newConv.id);
  return newConv;
}

export function syncConversationToDesktopVault(conversationId: string): void {
  try {
    const os = require('os');
    const vaultPath = path.join(os.homedir(), 'Desktop', 'Recall_Vault', 'chats');
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }
    const conv = getConversationById(conversationId);
    if (!conv) return;
    const messages = getMessagesByConversationId(conversationId);
    let md = `# ${conv.title}\n\n*Created: ${new Date(conv.createdAt).toLocaleString()}*\n\n---\n\n`;
    for (const msg of messages) {
      const sender = msg.role === 'user' ? 'You' : 'Recall';
      md += `### ${sender} (${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})\n\n${msg.content}\n\n---\n\n`;
    }
    const safeTitle = (conv.title || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const filename = `${safeTitle}-${conv.id.slice(-6)}.md`;
    fs.writeFileSync(path.join(vaultPath, filename), md, 'utf-8');
  } catch (err) {}
}

export function updateConversation(
  id: string,
  updates: Partial<Conversation>
): Conversation | null {
  ensureStorage();
  const convs = getAllConversations();
  const idx = convs.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  convs[idx] = {
    ...convs[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(convs, null, 2), 'utf-8');
  syncConversationToDesktopVault(id);
  return convs[idx];
}

export function deleteConversation(id: string): boolean {
  ensureStorage();
  const convs = getAllConversations();
  const filtered = convs.filter((c) => c.id !== id);
  if (filtered.length === convs.length) return false;
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    const allMsgs: Message[] = JSON.parse(raw);
    const filteredMsgs = allMsgs.filter((m) => m.conversationId !== id);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(filteredMsgs, null, 2), 'utf-8');
  } catch {}
  return true;
}

export function clearAllConversations(): void {
  ensureStorage();
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2), 'utf-8');
}

/* ==================== MESSAGES ==================== */
export function getMessagesByConversationId(conversationId: string): Message[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    const allMsgs: Message[] = JSON.parse(raw);
    return allMsgs.filter((m) => m.conversationId === conversationId);
  } catch (err) {
    return [];
  }
}

export function addMessageToConversation(messageData: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  planData?: any[];
  actionExecuted?: string;
}): Message {
  ensureStorage();
  const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
  const allMsgs: Message[] = JSON.parse(raw);

  const newMsg: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversationId: messageData.conversationId,
    role: messageData.role,
    content: messageData.content,
    attachments: messageData.attachments,
    planData: messageData.planData,
    actionExecuted: messageData.actionExecuted,
    createdAt: new Date().toISOString(),
  };

  allMsgs.push(newMsg);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(allMsgs, null, 2), 'utf-8');

  // Update parent conversation lastMessage and timestamp
  updateConversation(messageData.conversationId, {
    lastMessage: messageData.content.slice(0, 100),
  });

  return newMsg;
}

/* ==================== ATTACHMENTS ==================== */
export function getAllAttachments(): Attachment[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(ATTACHMENTS_FILE, 'utf-8');
    const atts: Attachment[] = JSON.parse(raw);
    return Array.isArray(atts) ? atts : [];
  } catch (err) {
    return DEFAULT_ATTACHMENTS;
  }
}

export function addAttachment(data: {
  name: string;
  type: string;
  url: string;
  size?: number;
  conversationId?: string;
  projectId?: string;
}): Attachment {
  ensureStorage();
  const atts = getAllAttachments();
  const newAtt: Attachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: data.name,
    type: data.type,
    url: data.url,
    size: data.size || 0,
    conversationId: data.conversationId,
    projectId: data.projectId,
    createdAt: new Date().toISOString(),
  };

  atts.unshift(newAtt);
  fs.writeFileSync(ATTACHMENTS_FILE, JSON.stringify(atts, null, 2), 'utf-8');
  return newAtt;
}

/* ==================== TASKS ==================== */

export function getAllTasks(): Task[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(TASKS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading tasks:', err);
    return [];
  }
}

export function saveAllTasks(tasks: Task[]): void {
  ensureStorage();
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving tasks:', err);
  }
}

export function addLocalTask(taskData: {
  title: string;
  note?: string | null;
  due_at: string;
  end_time?: string | null;
  priority?: any;
  location?: string | null;
  calendar_event_id?: string | null;
  whatsapp_reminder_id?: string | null;
  reminder_time?: string | null;
  is_meeting?: boolean;
  projectId?: string | null;
  project_name?: string | null;
}): Task {
  const tasks = getAllTasks();
  const newTask: Task = {
    id: crypto.randomUUID(),
    title: taskData.title.trim(),
    note: taskData.note || null,
    due_at: taskData.due_at,
    end_time: taskData.end_time || null,
    priority: taskData.priority || 'medium',
    status: 'pending',
    whatsapp_sent: false,
    location: taskData.location || null,
    calendar_event_id: taskData.calendar_event_id || null,
    whatsapp_reminder_id: taskData.whatsapp_reminder_id || null,
    reminder_time: taskData.reminder_time || null,
    is_meeting: taskData.is_meeting ?? false,
    projectId: taskData.projectId || null,
    project_name: taskData.project_name || null,
    created_at: new Date().toISOString(),
  };

  tasks.unshift(newTask);
  saveAllTasks(tasks);
  return newTask;
}

export function updateLocalTask(id: string, updates: Partial<Task>): Task | null {
  const tasks = getAllTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  tasks[index] = { ...tasks[index], ...updates };
  saveAllTasks(tasks);
  return tasks[index];
}

export function deleteLocalTask(id: string): boolean {
  const tasks = getAllTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  if (filtered.length === tasks.length) return false;

  saveAllTasks(filtered);
  return true;
}

export function clearAllTasks(): void {
  saveAllTasks([]);
}

export const createTask = addLocalTask;
export const updateTask = updateLocalTask;

/**
 * Checks all tasks in the local store and dispatches WhatsApp messages
 * for tasks where due_at <= now, status != completed, and whatsapp_sent == false.
 */
export async function checkAndDispatchDueReminders(): Promise<{
  checkedAt: string;
  dispatched: number;
  results: Array<{ id: string; title: string; sent: boolean; messageId?: string; error?: string }>;
}> {
  const tasks = getAllTasks();
  const now = new Date();
  const dueTasks = tasks.filter((t) => {
    if (t.status === 'completed' || t.whatsapp_sent) return false;
    const dueDate = new Date(t.due_at);
    return dueDate <= now;
  });

  const results: Array<{ id: string; title: string; sent: boolean; messageId?: string; error?: string }> = [];
  let dispatched = 0;

  for (const task of dueTasks) {
    try {
      console.log(`[Local Scheduler] Due task found: "${task.title}" (Due: ${task.due_at})`);
      const sendResult = await sendWhatsAppText({
        title: task.title,
        dueText: 'Due now',
        note: task.note,
        allowFallbackTemplate: false,
      });

      // Dispatch to Apple ecosystem (macOS banner + iPhone/Watch Reminders + Bark push)
      dispatchAppleNotification({
        title: task.title,
        body: task.note ? `${task.note} — Due now` : 'Your Recall reminder is due now.',
        dueAt: task.due_at,
        isUrgent: task.priority === 'high' || task.priority === 'urgent',
      }).catch((e) => console.warn('[Local Scheduler] Apple dispatch notice:', e));

      if (sendResult.success) {
        // Mark whatsapp_sent true on the persistent local store
        updateLocalTask(task.id, { whatsapp_sent: true });
        dispatched++;
        results.push({
          id: task.id,
          title: task.title,
          sent: true,
          messageId: sendResult.messageId,
        });
        console.log(`[Local Scheduler] Reminder delivered for "${task.title}"`);
      } else {
        results.push({
          id: task.id,
          title: task.title,
          sent: false,
          error: sendResult.error,
        });
        console.warn(`[Local Scheduler] WhatsApp delivery skipped/failed for "${task.title}":`, sendResult.error);
      }
    } catch (e: any) {
      results.push({
        id: task.id,
        title: task.title,
        sent: false,
        error: e.message || 'Unknown dispatch error',
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    dispatched,
    results,
  };
}

// Global server-side scheduler interval
declare global {
  var __recall_scheduler_timer__: NodeJS.Timeout | undefined;
}

export function ensureLocalSchedulerStarted(): void {
  if (global.__recall_scheduler_timer__) {
    return; // Already running in this Node process
  }

  console.log('[Local Scheduler] Starting Recall server-side background reminder scheduler (every 30s)...');

  // Initial check
  checkAndDispatchDueReminders().catch((err) =>
    console.error('[Local Scheduler] Initial scan error:', err)
  );

  // Poll every 30 seconds
  global.__recall_scheduler_timer__ = setInterval(() => {
    checkAndDispatchDueReminders().catch((err) =>
      console.error('[Local Scheduler] Background poll error:', err)
    );
  }, 30000);
}

/* ==================== GLOBAL SEARCH ==================== */
export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'chat' | 'project' | 'task' | 'file' | 'event';
  url: string;
}

export function globalSearch(query: string): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResultItem[] = [];

  // Search calendar events
  try {
    const calFile = path.join(DATA_DIR, 'calendar-local.json');
    if (fs.existsSync(calFile)) {
      const raw = fs.readFileSync(calFile, 'utf8');
      const events = JSON.parse(raw);
      if (Array.isArray(events)) {
        for (const e of events) {
          const summary = e.summary || '';
          const desc = e.description || '';
          if (summary.toLowerCase().includes(q) || desc.toLowerCase().includes(q)) {
            const startStr = e.start?.dateTime || e.start?.date;
            results.push({
              id: e.id,
              title: summary || '(Untitled Event)',
              subtitle: startStr
                ? `Event · ${new Date(startStr).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Calendar Event',
              type: 'event',
              url: '/calendar',
            });
          }
        }
      }
    }
  } catch (err) {}

  // Search projects
  const projects = getAllProjects();
  for (const p of projects) {
    if (p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))) {
      results.push({
        id: p.id,
        title: p.name,
        subtitle: p.description || `${p.taskCount || 0} tasks · ${p.conversationCount || 0} chats`,
        type: 'project',
        url: `/project/${p.id}`,
      });
    }
  }

  // Search conversations
  const convs = getAllConversations();
  for (const c of convs) {
    if (c.title.toLowerCase().includes(q) || (c.lastMessage && c.lastMessage.toLowerCase().includes(q))) {
      results.push({
        id: c.id,
        title: c.title,
        subtitle: c.projectName ? `Project: ${c.projectName}` : c.lastMessage,
        type: 'chat',
        url: `/chat/${c.id}`,
      });
    }
  }

  // Search tasks
  const tasks = getAllTasks();
  for (const t of tasks) {
    if (t.title.toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q))) {
      results.push({
        id: t.id,
        title: t.title,
        subtitle: t.due_at ? new Date(t.due_at).toLocaleDateString() : undefined,
        type: 'task',
        url: `/?taskId=${t.id}`,
      });
    }
  }

  // Search attachments / files
  const atts = getAllAttachments();
  for (const a of atts) {
    if (a.name.toLowerCase().includes(q)) {
      results.push({
        id: a.id,
        title: a.name,
        subtitle: a.type,
        type: 'file',
        url: a.url,
      });
    }
  }

  return results.slice(0, 15);
}

/**
 * Completely wipes all local application data (tasks, conversations, messages, projects, action history, attachments)
 * Preserves google-tokens.json and external credentials so active integrations remain connected.
 */
export function wipeAllData(): {
  success: boolean;
  clearedCount: { tasks: number; conversations: number; messages: number; projects: number; attachments: number };
} {
  ensureStorage();
  const tasks = getAllTasks();
  const convs = getAllConversations();
  const projs = getAllProjects();
  const atts = getAllAttachments();

  let msgCount = 0;
  try {
    const rawMsgs = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    msgCount = JSON.parse(rawMsgs).length;
  } catch (e) {}

  fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2), 'utf-8');
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2), 'utf-8');
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  fs.writeFileSync(ATTACHMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');

  const historyFile = path.join(DATA_DIR, 'action-history.json');
  if (fs.existsSync(historyFile)) {
    fs.writeFileSync(historyFile, JSON.stringify([], null, 2), 'utf-8');
  }

  const calLocalFile = path.join(DATA_DIR, 'calendar-local.json');
  if (fs.existsSync(calLocalFile)) {
    fs.writeFileSync(calLocalFile, JSON.stringify([], null, 2), 'utf-8');
  }

  return {
    success: true,
    clearedCount: {
      tasks: tasks.length,
      conversations: convs.length,
      messages: msgCount,
      projects: projs.length,
      attachments: atts.length,
    },
  };
}
