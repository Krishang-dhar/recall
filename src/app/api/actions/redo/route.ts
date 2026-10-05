import { NextRequest, NextResponse } from 'next/server';
import { getActionById, updateAction, getLastRedoableAction } from '@/lib/action-history';
import { deleteCalendarEvents } from '@/lib/google/calendar';
import { trashEmail, archiveEmail } from '@/lib/google/gmail';
import { trashDriveFile } from '@/lib/google/drive';

export async function POST(req: NextRequest) {
  try {
    const { actionId } = await req.json();

    // If no actionId, redo the last undone action
    const record = actionId ? getActionById(actionId) : getLastRedoableAction();

    if (!record) {
      return NextResponse.json({ success: false, error: 'No redoable action found.' }, { status: 404 });
    }

    if (record.status !== 'undone') {
      return NextResponse.json({ success: false, error: 'This action is not in an undone state.' });
    }

    let redoResult: { success: boolean; error?: string } = { success: false, error: 'Unknown action type' };

    switch (record.action) {
      // ── Calendar ──────────────────────────────────────────────────────
      case 'delete_calendar_event':
      case 'delete_calendar_events_bulk': {
        if (record.beforeState.type === 'calendar_events') {
          const eventIds = record.beforeState.events.map((e) => e.id);
          const res = await deleteCalendarEvents(eventIds);
          redoResult = res;
        }
        break;
      }

      // ── Gmail ─────────────────────────────────────────────────────────
      case 'archive_email': {
        if (record.beforeState.type === 'gmail_message') {
          const res = await archiveEmail(record.beforeState.message.id, record.beforeState.message.subject);
          redoResult = res;
        }
        break;
      }

      case 'trash_email': {
        if (record.beforeState.type === 'gmail_message') {
          const res = await trashEmail(record.beforeState.message.id, record.beforeState.message.subject);
          redoResult = res;
        }
        break;
      }

      // ── Drive ─────────────────────────────────────────────────────────
      case 'trash_drive_file': {
        if (record.beforeState.type === 'drive_file') {
          const file = record.beforeState.file;
          const res = await trashDriveFile(file.id, file.name, file.mimeType);
          redoResult = res;
        }
        break;
      }

      // ── Tasks (client-side) ───────────────────────────────────────────
      case 'delete_task':
      case 'complete_task': {
        redoResult = { success: true };
        break;
      }

      default:
        redoResult = { success: false, error: `Cannot redo action type: ${record.action}` };
    }

    if (redoResult.success) {
      updateAction(record.id, { status: 'redone', redoneAt: new Date().toISOString() });
    }

    return NextResponse.json({
      success: redoResult.success,
      error: redoResult.error,
      actionId: record.id,
      label: record.label,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
