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

-- Admin-set status for "مسائلات" (accountability) attachments: whether the
-- teacher's excuse for the file was accepted or not. Null = not yet decided.
alter table attachments add column if not exists accountability_status text;
do $$ begin
  alter table attachments add constraint attachments_accountability_status_check
    check (accountability_status in ('excused', 'rejected'));
exception
  when duplicate_object then null;
end $$;

-- Admin-only files not tied to any teacher (مدير المدرسة، وكيل شؤون المعلمين، إلخ), shown under
-- "إدارة المدرسة" -- never visible to teachers.
create table if not exists school_files (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references users(id),
  deleted_at timestamptz
);
create index if not exists idx_school_files_category on school_files(category);

-- When set, this admin/agent (or teacher) account is scoped to a single إدارة المدرسة
-- category (school_files.category value) and can't see or touch anything else under /admin.
alter table users add column if not exists restricted_category text;

-- Some إدارة المدرسة categories (e.g. المختبرات المدرسية) have their own subsections,
-- mirroring how portfolio attachments carry a subcategory.
alter table school_files add column if not exists subcategory text;

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

-- جدول الانتظار assignments, persisted so totals survive "بدء أسبوع جديد" and aren't stuck in
-- one admin's browser. `active` rows are the current, still-editable week shown on screen;
-- "بدء أسبوع جديد" archives them (active=false) instead of deleting them, so every assignment
-- ever made keeps counting toward a teacher's total انتظار history. A row is only ever hard-deleted
-- while still active (an in-progress correction or a genuine cancel before the day happens) --
-- once archived it's a permanent historical record.
create table if not exists substitute_assignments (
  id uuid primary key default gen_random_uuid(),
  day text not null,
  period text not null,
  absent_teacher text not null,
  section text not null,
  substitute text not null,
  rank integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_substitute_assignments_active on substitute_assignments(active);
create index if not exists idx_substitute_assignments_substitute on substitute_assignments(substitute);

-- إدارة المدرسة categories, now admin-editable instead of hardcoded in lib/school-files.ts.
-- `key` is a stable internal id (never shown to the admin, never edited) that school_files.category
-- and users.restricted_category values reference -- deleting a category does NOT touch those rows,
-- so their files just become unreachable through the UI until the category is re-created with the
-- same key (which the app never does automatically).
create table if not exists school_management_categories (
  key text primary key,
  label_ar text not null,
  accent_color text not null default '#2563eb',
  subsections jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- One-time seed matching the categories that used to be hardcoded -- idempotent, so re-running
-- this file after an admin has since edited/deleted one of these does nothing.
insert into school_management_categories (key, label_ar, accent_color, subsections, sort_order) values
  ('principal', 'ملف مدير المدرسة', '#1d4ed8', '[]', 0),
  ('teacher_affairs_agent', 'وكيل شؤون المعلمين والشؤون التعليمية', '#0f766e', '[
    {"key": "teacher_data", "labelAr": "بيانات المعلمين"},
    {"key": "schedules_loads", "labelAr": "الجداول والأنصبة"},
    {"key": "waiting_duty_supervision", "labelAr": "الانتظار والمناوبات والإشراف"},
    {"key": "attendance_regularity", "labelAr": "الدوام والانتظام"},
    {"key": "assignments_tasks", "labelAr": "التكليفات والمهام"},
    {"key": "performance_followup", "labelAr": "متابعة أداء المعلمين"},
    {"key": "classroom_visits", "labelAr": "الزيارات الصفية"},
    {"key": "support_development", "labelAr": "الدعم والتنمية المهنية"},
    {"key": "exams_evaluation", "labelAr": "الاختبارات والتقويم"},
    {"key": "achievement_analysis", "labelAr": "التحصيل الدراسي وتحليل النتائج"}
  ]', 1),
  ('student_affairs_agent', 'وكيل شؤون الطلاب', '#b45309', '[
    {"key": "plan", "labelAr": "خطة شؤون الطلاب"},
    {"key": "attendance", "labelAr": "الحضور والغياب والمواظبة"},
    {"key": "conduct_discipline", "labelAr": "السلوك والانضباط"},
    {"key": "struggling_students", "labelAr": "متابعة الطلاب المتعثرين"},
    {"key": "programs_activities", "labelAr": "البرامج والأنشطة الطلابية"},
    {"key": "parent_communication", "labelAr": "التواصل مع أولياء الأمور"},
    {"key": "meetings_minutes", "labelAr": "الاجتماعات والمحاضر"}
  ]', 2),
  ('student_counselor', 'ملف الموجه الطلابي', '#7c3aed', '[]', 3),
  ('student_activity', 'ملف النشاط الطلابي', '#be123c', '[]', 4),
  ('security_safety', 'الأمن والسلامة', '#0284c7', '[]', 5),
  ('school_health', 'الصحة المدرسية', '#0ea5e9', '[]', 6),
  ('school_labs', 'المختبرات المدرسية', '#059669', '[
    {"key": "weekly_visits", "labelAr": "الزيارات الأسبوعية"},
    {"key": "inventory_equipment", "labelAr": "الجرد والتجهيزات"}
  ]', 7),
  ('student_guidance', 'التوجيه الطلابي', '#c026d3', '[
    {"key": "operational_plan", "labelAr": "الخطة التشغيلية"},
    {"key": "programs_events", "labelAr": "البرامج والفعاليات"},
    {"key": "individual_cases", "labelAr": "الحالات الفردية"},
    {"key": "absence_tardiness", "labelAr": "الغياب والتأخر"},
    {"key": "behavior_attendance", "labelAr": "السلوك والمواظبة"},
    {"key": "academic_struggles", "labelAr": "التعثر الدراسي والخطط العلاجية"},
    {"key": "academic_career_guidance", "labelAr": "التوجيه التعليمي والمهني"},
    {"key": "parent_communication", "labelAr": "التواصل مع أولياء الأمور"},
    {"key": "meetings_minutes", "labelAr": "الاجتماعات والمحاضر"}
  ]', 8)
on conflict (key) do nothing;
