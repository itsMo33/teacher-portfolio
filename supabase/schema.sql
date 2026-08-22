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

-- Idempotent migrations for the trash / read-receipt / audit-log features
-- added after the initial launch.

-- Soft delete: rows are hidden from normal queries once deleted_at is set,
-- but nothing is actually removed until an admin purges it from the trash.
alter table users add column if not exists deleted_at timestamptz;
alter table attachments add column if not exists deleted_at timestamptz;
alter table schedules add column if not exists deleted_at timestamptz;

-- Teacher-side read receipt for the schedule (attachments.viewed_at already exists above).
alter table schedules add column if not exists viewed_at timestamptz;

-- Admin-side read receipt: set when an admin/agent opens a teacher's drill-in
-- page, for attachments the *teacher* uploaded (teacherWritable sections).
alter table attachments add column if not exists admin_viewed_at timestamptz;

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  actor_name text not null,
  action text not null,
  target_teacher_id uuid,
  target_teacher_name text,
  details text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_log_created_at on activity_log(created_at desc);
