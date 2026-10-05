import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { addAttachment } from '@/lib/local-store';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = (formData.get('conversationId') as string) || undefined;
    const projectId = (formData.get('projectId') as string) || undefined;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${safeName}`;
    const attachment = addAttachment({
      name: file.name,
      type: file.type,
      url: fileUrl,
      size: file.size,
      conversationId,
      projectId,
    });

    return NextResponse.json({
      success: true,
      attachment,
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
