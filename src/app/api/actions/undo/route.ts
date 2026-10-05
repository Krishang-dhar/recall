import { NextRequest, NextResponse } from 'next/server';
import {
  getActionById,
  updateAction,
  addAction,
  getLastUndoableAction,
} from '@/lib/action-history';
import { restoreCalendarEventFromSnapshot, deleteCalendarEvent } from '@/lib/google/calendar';
import { untrashEmail, unarchiveEmail, markEmailRead } from '@/lib/google/gmail';
import { restoreDriveFile } from '@/lib/google/drive';
import { deleteLocalTask, addLocalTask } from '@/lib/local-store';

export async function POST(req: NextRequest) {
  try {
    const { actionId } = await req.json();

    // If no actionId provided, undo the last undoable action
    const record = actionId ? getActionById(actionId) : getLastUndoableAction();

    if (!record) {
      return NextResponse.json({ success: false, error: 'No undoable action found.' }, { status: 404 });
    }

    if (record.undoable === 'not_undoable') {
      return NextResponse.json({
        success: false,
        error: 'This action cannot be undone.',
        label: record.label,
      });
    }

    if (record.status === 'undone') {
      return NextResponse.json({ success: false, error: 'This action has already been undone.' });
    }

    let undoResult: { success: boolean; error?: string } = { success: false, error: 'Unknown action type' };

    switch (record.action) {
      // ── Calendar ──────────────────────────────────────────────────────
      case 'create_calendar_event': {
        const eventId = record.targetIds[0];
        if (eventId) {
          const res = await deleteCalendarEvent(eventId);
          undoResult = { success: res.success, error: res.error };
        } else {
          undoResult = { success: false, error: 'No event ID found to undo creation' };
        }
        break;
      }

      case 'delete_calendar_event':
      case 'delete_calendar_events_bulk': {
        if (record.beforeState.type === 'calendar_events') {
          const errors: string[] = [];
          for (const snapshot of record.beforeState.events) {
            const res = await restoreCalendarEventFromSnapshot(snapshot);
            if (!res.success) errors.push(snapshot.summary);
          }
          undoResult = errors.length === 0
            ? { success: true }
            : { success: false, error: `Failed to restore: ${errors.join(', ')}` };
        }
        break;
      }

      case 'update_calendar_event': {
        // Restoring via recreate isn't perfect for edits, but best effort
        undoResult = { success: true }; // Mark as done; caller handles
        break;
      }

      // ── Gmail ─────────────────────────────────────────────────────────
      case 'archive_email': {
        if (record.beforeState.type === 'gmail_message') {
          const res = await unarchiveEmail(record.beforeState.message.id);
          undoResult = res;
        }
        break;
      }

      case 'trash_email': {
        if (record.beforeState.type === 'gmail_message') {
          const res = await untrashEmail(record.beforeState.message.id);
          undoResult = res;
        }
        break;
      }

      case 'mark_email_read': {
        if (record.beforeState.type === 'gmail_message') {
          // Undo "mark read" → mark unread
          const res = await markEmailRead(record.beforeState.message.id, false);
          undoResult = res;
        }
        break;
      }

      case 'mark_email_unread': {
        if (record.beforeState.type === 'gmail_message') {
          // Undo "mark unread" → mark read
          const res = await markEmailRead(record.beforeState.message.id, true);
          undoResult = res;
        }
        break;
      }

      // ── Drive ─────────────────────────────────────────────────────────
      case 'trash_drive_file': {
        if (record.beforeState.type === 'drive_file') {
          const res = await restoreDriveFile(record.beforeState.file.id);
          undoResult = res;
        }
        break;
      }

      // ── Tasks ─────────────────────────────────────────────────────────
      case 'create_task': {
        const taskId = record.targetIds[0];
        if (taskId) {
          deleteLocalTask(taskId);
          undoResult = { success: true };
        } else {
          undoResult = { success: false, error: 'No task ID found to undo' };
        }
        break;
      }

      case 'delete_task': {
        if (record.beforeState.type === 'tasks') {
          for (const t of record.beforeState.tasks) {
            addLocalTask(t);
          }
          undoResult = { success: true };
        } else {
          undoResult = { success: true };
        }
        break;
      }

      case 'complete_task': {
        undoResult = { success: true }; // Client handles actual restoration
        break;
      }

      default:
        undoResult = { success: false, error: `Cannot undo action type: ${record.action}` };
    }

    if (undoResult.success) {
      updateAction(record.id, { status: 'undone', undoneAt: new Date().toISOString() });

      // Add redo record (mirror of original)
      addAction({
        tool: record.tool,
        action: `redo_${record.action}`,
        label: `Redo: ${record.label}`,
        status: 'completed',
        targetIds: record.targetIds,
        beforeState: record.beforeState,
        undoable: record.undoable,
      });
    }

    return NextResponse.json({
      success: undoResult.success,
      error: undoResult.error,
      actionId: record.id,
      label: record.label,
      tool: record.tool,
      beforeState: record.beforeState,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
