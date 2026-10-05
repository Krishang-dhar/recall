import { NextRequest, NextResponse } from 'next/server';
import { processRecallInstruction } from '@/lib/recall-ai';
import {
  getProjectById,
  getAllTasks,
  getAllAttachments,
  createProject,
  addMessageToConversation,
  updateConversation,
  getConversationById,
} from '@/lib/local-store';

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      history,
      tasksContext,
      userTimeZone,
      assistantType = 'recall',
      projectId,
      conversationId,
      attachedFileName,
      attachedFileContent,
      preflightContext,
    } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Retrieve project context if scoped
    let projectContext: any = undefined;
    if (projectId) {
      const proj = getProjectById(projectId);
      if (proj) {
        const projTasks = getAllTasks().filter((t) => t.projectId === projectId);
        const projFiles = getAllAttachments().filter((a) => a.projectId === projectId);
        projectContext = {
          id: proj.id,
          name: proj.name,
          description: proj.description,
          tasks: projTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, due_at: t.due_at })),
          files: projFiles.map((f) => ({ id: f.id, name: f.name, type: f.type, url: f.url })),
        };
      }
    }

    // Check if user is asking to create a project
    const msgTrimmed = message.trim();
    const createProjectMatch = msgTrimmed.match(/create (?:a )?project (?:called |named )?["']?([^"'\n]+?)["']?(?:$|\.|\band\b)/i);
    let createdProject = undefined;
    if (createProjectMatch && createProjectMatch[1]) {
      const newProjName = createProjectMatch[1].trim();
      createdProject = createProject(newProjName);
      if (conversationId) {
        updateConversation(conversationId, {
          projectId: createdProject.id,
          projectName: createdProject.name,
        });
      }
    }

    const result = await processRecallInstruction({
      message: msgTrimmed,
      history,
      currentTasks: Array.isArray(tasksContext) ? tasksContext : getAllTasks(),
      userTimeZone: userTimeZone || 'Asia/Kolkata',
      attachedFileName,
      attachedFileContent,
      preflightContext,
    });

    // If conversationId is present, persist the user message & AI reply
    if (conversationId) {
      addMessageToConversation({
        conversationId,
        role: 'user',
        content: msgTrimmed,
        attachments: attachedFileName
          ? [{ id: `att-${Date.now()}`, name: attachedFileName, type: 'file', url: '#', createdAt: new Date().toISOString() }]
          : undefined,
      });

      addMessageToConversation({
        conversationId,
        role: 'assistant',
        content: result.reply,
        planData: result.generativeUI?.planSlots,
        actionExecuted: createdProject ? `Project "${createdProject.name}" created ✓` : undefined,
      });

      // Generate a title if untitled
      const conv = getConversationById(conversationId);
      if (conv && (conv.title === 'New conversation' || !conv.title)) {
        const words = msgTrimmed.split(' ').slice(0, 5).join(' ');
        const autoTitle = words.charAt(0).toUpperCase() + words.slice(1);
        updateConversation(conversationId, { title: autoTitle });
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      createdProject,
    });
  } catch (err: any) {
    console.error('Chat API route error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
