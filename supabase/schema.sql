-- Schema for the teacher portfolio system.
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
--
-- NOTE ON ROW LEVEL SECURITY: this app never talks to Supabase from the
-- browser. Every request goes through Next.js server code using the
-- SERVICE ROLE key, which bypasses RLS by design. Authorization is enforced
-- in middleware.ts and inside each API route handler instead. Do not enable
-- RLS/policies on these tables assuming client-side/anon access -- there is
-- none, and policies here would be dead code.

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('teacher', 'agent', 'manager');
exception
  when duplicate_object then null;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  national_id text not null unique,
  password_hash text not null,
  role user_role not null,
  name text not null,
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  category text not null,
  subcategory text,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references users(id),
  viewed_at timestamptz
);
create index if not exists idx_attachments_teacher on attachments(teacher_id);
create index if not exists idx_attachments_teacher_category on attachments(teacher_id, category, subcategory);

-- Idempotent migration for the viewed_at column added after the initial launch.
alter table attachments add column if not exists viewed_at timestamptz;

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references users(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references users(id)
);
