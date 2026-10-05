import { NextRequest, NextResponse } from 'next/server';
import { searchDriveFiles } from '@/lib/google/drive';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const pageSize = parseInt(searchParams.get('pageSize') || '8', 10);

    const result = await searchDriveFiles(q, pageSize);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to search Drive' },
      { status: 500 }
    );
  }
}
