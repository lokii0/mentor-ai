-- mentor.ai — schema + Row Level Security.
-- Run once in Supabase → SQL Editor (or `supabase db push`).
-- Every table belongs to exactly one user (auth.uid()); RLS lets only that user see or change it.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  lang text not null default 'pl' check (lang in ('pl','en')),
  intensity int not null default 10 check (intensity between 1 and 10),
  mentor_paused_until timestamptz,
  autolock_min int not null default 2 check (autolock_min between 1 and 5),
  notifications boolean not null default false,
  onboarding_done boolean not null default false,
  last_open_at timestamptz,
  push_backoff int not null default 0,
  last_push_at timestamptz,
  dns_note text,
  timezone text not null default 'Europe/Warsaw'
);

create table if not exists public.profile_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  category text not null,
  text text not null,
  source text not null default 'manual'
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  name text not null,
  kind text not null check (kind in ('check','count','duration')),
  unit text,
  target numeric not null default 1,
  period text not null default 'day' check (period in ('day','week')),
  step numeric,
  reminder_times text[],
  shield boolean not null default true,
  preset text,
  archived boolean not null default false,
  sort int not null default 0
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  habit_id uuid not null references public.habits on delete cascade,
  date date not null,
  value numeric not null default 0,
  note text
);
create index if not exists habit_logs_habit_date on public.habit_logs (habit_id, date);

create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  key text not null,
  name text not null,
  started_at timestamptz not null default now(),
  best_days int not null default 0,
  daily_limit_minutes int,
  sort int not null default 0
);

create table if not exists public.relapses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  streak_id uuid not null references public.streaks on delete cascade,
  at timestamptz not null default now(),
  days_lost int not null default 0,
  note text
);

create table if not exists public.triggers_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  at timestamptz not null default now(),
  streak_key text,
  mood int check (mood between 1 and 5),
  place text not null default '',
  before text not null default '',
  intensity int check (intensity between 1 and 10),
  outcome text not null check (outcome in ('won','slipped')),
  note text
);

create table if not exists public.daily_interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  date date not null,
  about_date date,
  kind text not null check (kind in ('morning','onboarding')),
  answers jsonb not null default '{}',
  completed boolean not null default false
);
create index if not exists daily_interviews_date on public.daily_interviews (user_id, date);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  title text not null,
  description text,
  deadline date,
  status text not null default 'active' check (status in ('active','done','paused')),
  metric text,
  sort int not null default 0
);

create table if not exists public.goal_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  goal_id uuid not null references public.goals on delete cascade,
  title text not null,
  scope text not null default 'milestone' check (scope in ('milestone','week','day')),
  due date,
  done boolean not null default false,
  sort int not null default 0
);

create table if not exists public.priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  date date not null,
  text text not null,
  done boolean not null default false,
  goal_id uuid references public.goals on delete set null,
  sort int not null default 0
);

create table if not exists public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  date date not null,
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440),
  title text not null,
  kind text not null default 'focus',
  proposed boolean not null default false,
  goal_id uuid references public.goals on delete set null,
  done boolean not null default false
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  title text,
  body text not null default '',
  tags text[] not null default '{}',
  kind text not null default 'other',
  pinned boolean not null default false
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  title text not null,
  description text not null default '',
  potential int check (potential between 1 and 10),
  risk int check (risk between 1 and 10),
  first_step text,
  time_to_first_sale text,
  mentor_verdict text,
  status text not null default 'new'
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  kind text not null check (kind in ('income','expense')),
  name text not null,
  key text,
  monthly_limit numeric,
  sort int not null default 0
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  amount numeric(12,2) not null check (amount >= 0),
  category_id uuid references public.categories on delete set null,
  date date not null,
  note text
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  amount numeric(12,2) not null check (amount >= 0),
  category_id uuid references public.categories on delete set null,
  date date not null,
  note text
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  month text not null,
  total_limit numeric not null default 0,
  income_goal numeric not null default 10000,
  unique (user_id, month)
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  date date not null,
  kind text not null,
  value numeric,
  unit text,
  meta jsonb,
  note text
);

create table if not exists public.leads_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  date date not null,
  messages int not null default 0,
  leads int not null default 0,
  replies int not null default 0,
  clients int not null default 0,
  revenue numeric not null default 0
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  role text not null check (role in ('user','mentor')),
  content text not null,
  context text not null default 'chat',
  meta jsonb
);
create index if not exists chat_messages_created on public.chat_messages (user_id, created_at desc);

create table if not exists public.oaths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  text text not null,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','kept','broken')),
  message_id uuid
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  week_start date not null,
  stats jsonb not null default '{}',
  positives text not null default '',
  negatives text not null default '',
  plan_next text not null default '',
  mentor_feedback text
);

create table if not exists public.monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  month text not null,
  stats jsonb not null default '{}',
  mentor_feedback text,
  recommendations text
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text
);

-- ---------- Row Level Security: owner only ----------

do $$
declare t text;
begin
  foreach t in array array[
    'settings','profile_facts','habits','habit_logs','streaks','relapses','triggers_log','daily_interviews',
    'goals','goal_steps','priorities','calendar_blocks','notes','ideas','categories','incomes','expenses',
    'budgets','measurements','leads_log','chat_messages','oaths','weekly_reviews','monthly_reviews','push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- ---------- "Delete all my data" (PRD 8) ----------

create or replace function public.delete_my_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from chat_messages; delete from oaths; delete from profile_facts; delete from habit_logs;
  delete from habits; delete from relapses; delete from streaks; delete from triggers_log;
  delete from daily_interviews; delete from priorities; delete from calendar_blocks; delete from goal_steps;
  delete from goals; delete from notes; delete from ideas; delete from incomes; delete from expenses;
  delete from categories; delete from budgets; delete from measurements; delete from leads_log;
  delete from weekly_reviews; delete from monthly_reviews; delete from push_subscriptions; delete from settings;
  -- RLS scopes every delete to auth.uid(); nobody else's rows are visible here.
end $$;

-- ---------- Private storage for skin photos ----------

insert into storage.buckets (id, name, public) values ('private', 'private', false) on conflict (id) do nothing;

drop policy if exists private_owner_select on storage.objects;
drop policy if exists private_owner_insert on storage.objects;
drop policy if exists private_owner_update on storage.objects;
drop policy if exists private_owner_delete on storage.objects;
create policy private_owner_select on storage.objects for select to authenticated using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy private_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy private_owner_update on storage.objects for update to authenticated using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy private_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
