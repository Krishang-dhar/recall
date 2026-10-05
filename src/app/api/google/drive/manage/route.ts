import { NextRequest, NextResponse } from 'next/server';
import { trashDriveFile, restoreDriveFile } from '@/lib/google/drive';

export async function POST(req: NextRequest) {
  try {
    const { action, fileId, fileName, mimeType } = await req.json();

    if (!action || !fileId) {
      return NextResponse.json(
        { success: false, error: 'action and fileId are required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'trash': {
        const result = await trashDriveFile(fileId, fileName, mimeType);
        return NextResponse.json(result);
      }
      case 'restore': {
        const result = await restoreDriveFile(fileId);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
