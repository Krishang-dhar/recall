import fs from 'fs';
import path from 'path';

export type ActionTool = 'calendar' | 'gmail' | 'drive' | 'tasks' | 'whatsapp';
export type ActionStatus = 'completed' | 'undone' | 'redone' | 'failed';

export type Undoability =
  | 'fully_undoable'       // local tasks — recreate exactly
  | 'recreatable'          // calendar events — recreate from snapshot
  | 'provider_reversible'  // gmail/drive trash-untrash
  | 'not_undoable';        // sent email, delivered WA

export interface CalendarEventSnapshot {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string | null; date?: string | null };
  end: { dateTime?: string | null; date?: string | null };
  location?: string;
  htmlLink?: string;
  isLocalOnly?: boolean;
}

export interface GmailMessageSnapshot {
  id: string;
  labelIds?: string[];
  subject?: string;
  from?: string;
}

export interface DriveFileSnapshot {
  id: string;
  name: string;
  mimeType: string;
  trashed?: boolean;
}

export interface TaskSnapshot {
  id: string;
  title: string;
  note?: string | null;
  due_at: string;
  priority: string;
  status: string;
  whatsapp_sent: boolean;
}

export type BeforeState =
  | { type: 'calendar_events'; events: CalendarEventSnapshot[] }
  | { type: 'gmail_message'; message: GmailMessageSnapshot }
  | { type: 'drive_file'; file: DriveFileSnapshot }
  | { type: 'tasks'; tasks: TaskSnapshot[] };

export interface ActionRecord {
  id: string;
  tool: ActionTool;
  action: string;           // e.g. "delete_calendar_event", "archive_email"
  label: string;            // human-readable, e.g. "Deleted \"Rahul meeting\""
  timestamp: string;        // ISO
  status: ActionStatus;
  targetIds: string[];      // eventIds / messageIds / fileIds / taskIds
  beforeState: BeforeState;
  afterState?: Record<string, unknown>;
  undoable: Undoability;
  undoneAt?: string;
  redoneAt?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'action-history.json');
const MAX_HISTORY = 100;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getAllActions(): ActionRecord[] {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(raw) as ActionRecord[];
  } catch {
    return [];
  }
}

function saveActions(records: ActionRecord[]) {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(records, null, 2), 'utf8');
}

export function addAction(record: Omit<ActionRecord, 'id' | 'timestamp'>): ActionRecord {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newRecord: ActionRecord = {
    ...record,
    id,
    timestamp: new Date().toISOString(),
  };

  const current = getAllActions();
  const updated = [newRecord, ...current].slice(0, MAX_HISTORY);
  saveActions(updated);
  return newRecord;
}

export function updateAction(id: string, updates: Partial<ActionRecord>): ActionRecord | null {
  const current = getAllActions();
  const index = current.findIndex((a) => a.id === id);
  if (index < 0) return null;

  const updated = { ...current[index], ...updates };
  current[index] = updated;
  saveActions(current);
  return updated;
}

export function getActionById(id: string): ActionRecord | null {
  return getAllActions().find((a) => a.id === id) || null;
}

/** Returns the most recent action that is undoable/redoable */
export function getLastUndoableAction(): ActionRecord | null {
  const records = getAllActions();
  // Most recent completed (not yet undone) action that is undoable
  return (
    records.find(
      (a) =>
        a.status === 'completed' &&
        a.undoable !== 'not_undoable'
    ) || null
  );
}

export function getLastRedoableAction(): ActionRecord | null {
  const records = getAllActions();
  return records.find((a) => a.status === 'undone') || null;
}

export function getRecentActions(limit = 20): ActionRecord[] {
  return getAllActions().slice(0, limit);
}
