-- Recall Supabase Schema: Single main tasks table & Minimal integrations table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    note TEXT,
    due_at TIMESTAMPTZ NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
    location TEXT,
    calendar_event_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- If tasks table already exists, alter to add location and calendar_event_id
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Indexes for performance & scheduling
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks (due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_whatsapp_pending ON public.tasks (due_at, whatsapp_sent, status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on tasks" 
ON public.tasks 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Minimal Integrations table for server-side OAuth tokens (Google Calendar & Gmail)
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    access_token TEXT,
    refresh_token TEXT,
    expires_at BIGINT,
    scopes TEXT[],
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on integrations" 
ON public.integrations 
FOR ALL 
USING (true) 
WITH CHECK (true);
