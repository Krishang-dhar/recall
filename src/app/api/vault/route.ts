import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAllConversations, getMessagesByConversationId, getAllTasks } from '@/lib/local-store';

function getDesktopVaultPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, 'Desktop', 'Recall_Vault');
}

export async function GET() {
  const vaultPath = getDesktopVaultPath();
  const exists = fs.existsSync(vaultPath);

  if (!exists) {
    return NextResponse.json({
      granted: false,
      path: vaultPath,
      exists: false,
      chatsCount: 0,
      tasksCount: 0,
    });
  }

  try {
    const chatsDir = path.join(vaultPath, 'chats');
    const tasksFile = path.join(vaultPath, 'tasks.json');

    const chatsCount = fs.existsSync(chatsDir) ? fs.readdirSync(chatsDir).filter((f) => f.endsWith('.md')).length : 0;
    const tasksCount = fs.existsSync(tasksFile) ? JSON.parse(fs.readFileSync(tasksFile, 'utf-8')).length : 0;

    return NextResponse.json({
      granted: true,
      exists: true,
      path: vaultPath,
      chatsCount,
      tasksCount,
    });
  } catch (err: any) {
    return NextResponse.json({
      granted: false,
      error: err.message,
      path: vaultPath,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const vaultPath = getDesktopVaultPath();
    const chatsDir = path.join(vaultPath, 'chats');
    const tasksDir = path.join(vaultPath, 'tasks');
    const notesDir = path.join(vaultPath, 'notes');

    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }
    if (!fs.existsSync(chatsDir)) {
      fs.mkdirSync(chatsDir, { recursive: true });
    }
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    // Write initial README and metadata
    const readmeContent = `# Recall Local Vault\n\nThis folder holds your local Recall data:\n- **/chats/**: Your chat conversations with Recall saved as Markdown files.\n- **/tasks/**: Your tasks and schedules.\n- **/notes/**: Your notes and memory.\n\nAll data is stored locally on your machine.\n`;
    fs.writeFileSync(path.join(vaultPath, 'README.md'), readmeContent, 'utf-8');

    // Sync all existing conversations to Markdown in ~/Desktop/Recall_Vault/chats/
    const convs = getAllConversations();
    for (const conv of convs) {
      const messages = getMessagesByConversationId(conv.id);
      let md = `# ${conv.title}\n\n*Created: ${new Date(conv.createdAt).toLocaleString()}*\n\n---\n\n`;
      for (const msg of messages) {
        const sender = msg.role === 'user' ? 'You' : 'Recall';
        md += `### ${sender} (${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})\n\n${msg.content}\n\n---\n\n`;
      }
      const safeTitle = (conv.title || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const filename = `${safeTitle}-${conv.id.slice(-6)}.md`;
      fs.writeFileSync(path.join(chatsDir, filename), md, 'utf-8');
    }

    // Sync tasks
    const tasks = getAllTasks();
    fs.writeFileSync(path.join(vaultPath, 'tasks.json'), JSON.stringify(tasks, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      granted: true,
      path: vaultPath,
      syncedChats: convs.length,
      syncedTasks: tasks.length,
    });
  } catch (err: any) {
    console.error('Error initializing desktop vault:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to initialize desktop vault' },
      { status: 500 }
    );
  }
}
