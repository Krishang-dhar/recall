import { NextResponse } from 'next/server';
import { getMessagesByConversationId, addMessageToConversation } from '@/lib/local-store';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = getMessagesByConversationId(id);
    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const message = addMessageToConversation({
      conversationId: id,
      role: body.role || 'user',
      content: body.content,
      attachments: body.attachments,
      planData: body.planData,
      actionExecuted: body.actionExecuted,
    });
    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
