import { NextResponse } from 'next/server';
import {
  getProjectById,
  deleteProject,
  getAllTasks,
  getAllConversations,
  getAllAttachments,
} from '@/lib/local-store';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = getProjectById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const tasks = getAllTasks().filter((t) => t.projectId === id);
    const conversations = getAllConversations().filter((c) => c.projectId === id);
    const attachments = getAllAttachments().filter((a) => a.projectId === id);

    return NextResponse.json({
      success: true,
      project,
      tasks,
      conversations,
      attachments,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteProject(id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
