import { NextRequest, NextResponse } from 'next/server';
import {
  checkAndDispatchDueReminders,
  getAllTasks,
  ensureLocalSchedulerStarted,
} from '@/lib/local-store';

ensureLocalSchedulerStarted();

export async function GET(req: NextRequest) {
  const result = await checkAndDispatchDueReminders();
  return NextResponse.json({
    success: true,
    mode: 'local_scheduler',
    ...result,
  });
}

export async function POST(req: NextRequest) {
  const result = await checkAndDispatchDueReminders();
  return NextResponse.json({
    success: true,
    mode: 'local_scheduler_manual_trigger',
    ...result,
  });
}
