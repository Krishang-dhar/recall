import { NextResponse } from 'next/server';
import { getAllConversations, createConversation, clearAllConversations } from '@/lib/local-store';

export async function GET() {
  try {
    const conversations = getAllConversations();
    return NextResponse.json({ success: true, conversations });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const conversation = createConversation({
      title: body.title,
      projectId: body.projectId,
      assistantType: body.assistantType,
      initialMessage: body.initialMessage,
    });
    return NextResponse.json({ success: true, conversation });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearAllConversations();
    return NextResponse.json({ success: true, message: 'All conversations cleared' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
