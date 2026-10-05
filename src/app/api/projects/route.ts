import { NextResponse } from 'next/server';
import { getAllProjects, createProject } from '@/lib/local-store';

export async function GET() {
  try {
    const projects = getAllProjects();
    return NextResponse.json({ success: true, projects });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    }
    const project = createProject(body.name, body.description, body.color);
    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
