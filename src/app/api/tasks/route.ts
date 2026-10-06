import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTasks,
  addLocalTask,
  updateLocalTask,
  deleteLocalTask,
  ensureLocalSchedulerStarted,
} from '@/lib/local-store';
import {
  isMacOS,
  createAppleReminder,
  createAppleCalendarEvent,
} from '@/lib/apple-notifications';

// Start the local background scheduler on the very first API request
ensureLocalSchedulerStarted();

// GET /api/tasks: list all local tasks
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let tasks = getAllTasks();

  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  // Sort ascending by due date
  tasks.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  return NextResponse.json({
    configured: true,
    storage: 'local-store',
    tasks,
  });
}

// POST /api/tasks: create task into local store
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      note,
      due_at,
      end_time,
      priority = 'medium',
      location,
      calendar_event_id,
      whatsapp_reminder_id,
      reminder_time,
      is_meeting,
      projectId,
      project_name,
    } = body;

    if (!title || !due_at) {
      return NextResponse.json(
        { error: 'Title and due_at are required' },
        { status: 400 }
      );
    }

    const newTask = addLocalTask({
      title,
      note,
      due_at,
      end_time,
      priority,
      location,
      calendar_event_id,
      whatsapp_reminder_id,
      reminder_time,
      is_meeting,
      projectId,
      project_name,
    });

    // Auto-sync to Apple Ecosystem on macOS (syncs to iPhone & Apple Watch via iCloud)
    if (isMacOS()) {
      if (newTask.is_meeting) {
        createAppleCalendarEvent({
          title: newTask.title,
          startAt: newTask.due_at,
          endAt: newTask.end_time || null,
          location: newTask.location || null,
          notes: newTask.note || null,
        }).catch((e) => console.warn('[Tasks API] Apple Calendar sync notice:', e));
      } else {
        createAppleReminder({
          title: newTask.title,
          dueAt: newTask.due_at,
          notes: newTask.note || null,
        }).catch((e) => console.warn('[Tasks API] Apple Reminders sync notice:', e));
      }
    }

    return NextResponse.json({
      configured: true,
      storage: 'local-store',
      task: newTask,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks: update task in local store
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const updated = updateLocalTask(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
      configured: true,
      storage: 'local-store',
      task: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks: delete task from local store
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const success = deleteLocalTask(id);
    return NextResponse.json({
      configured: true,
      storage: 'local-store',
      success,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete task' },
      { status: 500 }
    );
  }
}
