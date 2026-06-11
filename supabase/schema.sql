-- Dadi Prompt Library Backend Schema
-- Run this in Supabase SQL Editor before deploying the backend-enabled Vercel site.

create extension if not exists pgcrypto;

create table if not exists public.prompts (
  id text primary key,
  title text not null,
  category text not null default 'Uploaded Prompts',
  structure text not null default 'Role-Based',
  expected_output text default '',
  department text default 'General',
  level text default 'Custom',
  best_use_case text default '',
  placeholders text default '',
  tags text default '',
  prompt text not null,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_activity_logs (
  id uuid primary key default gen_random_uuid(),
  prompt_id text references public.prompts(id) on delete set null,
  actor text not null default 'system',
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_prompts_status on public.prompts(status);
create index if not exists idx_prompts_category on public.prompts(category);
create index if not exists idx_prompts_updated_at on public.prompts(updated_at desc);
create index if not exists idx_activity_prompt_id on public.prompt_activity_logs(prompt_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_prompts_updated_at on public.prompts;
create trigger set_prompts_updated_at
before update on public.prompts
for each row
execute function public.set_updated_at();

alter table public.prompts enable row level security;
alter table public.prompt_activity_logs enable row level security;

-- Public read policy for approved prompts only.
-- The Vercel backend uses the service role key for admin actions.
drop policy if exists "Approved prompts are readable" on public.prompts;
create policy "Approved prompts are readable"
on public.prompts
for select
to anon, authenticated
using (status = 'approved');

-- Block direct client-side writes by default.
-- All writes should go through Vercel API routes with the service role key.
drop policy if exists "No direct prompt inserts" on public.prompts;
create policy "No direct prompt inserts"
on public.prompts
for insert
to anon, authenticated
with check (false);

drop policy if exists "No direct prompt updates" on public.prompts;
create policy "No direct prompt updates"
on public.prompts
for update
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct prompt deletes" on public.prompts;
create policy "No direct prompt deletes"
on public.prompts
for delete
to anon, authenticated
using (false);

-- Activity logs should only be visible through backend admin APIs.
drop policy if exists "No direct activity log access" on public.prompt_activity_logs;
create policy "No direct activity log access"
on public.prompt_activity_logs
for all
to anon, authenticated
using (false)
with check (false);
