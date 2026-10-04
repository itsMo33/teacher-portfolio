-- Schema for the teacher portfolio system.
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
--
-- NOTE ON ROW LEVEL SECURITY: this app never talks to Supabase from the
-- browser. Every request goes through Next.js server code using the
-- SERVICE ROLE key, which bypasses RLS by design. Authorization is enforced
-- in middleware.ts and inside each API route handler instead -- so every
-- table here should still have RLS *enabled* (with zero policies). That is
-- not dead code: Supabase's PostgREST layer exposes every public-schema
-- table over its REST API to anyone holding the anon key whenever RLS is
-- off, regardless of whether this app's own code ever uses that key. With
-- RLS enabled and no policies, only the service role (which bypasses RLS)
-- can read/write these tables -- exactly what this app needs, and nothing
-- more. Every `create table` below must be paired with an `enable row level
-- security` statement for this reason.

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

-- Some teachers are exempt from the "الرخصة المهنية" requirement per school/MOE policy -- when
-- set, they're treated as having satisfied that one subsection in every completion percentage and
-- statistics view, without needing to actually upload anything there.
alter table users add column if not exists professional_license_exempt boolean not null default false;

-- متابعة أداء المعلمين: daily attendance/compliance marks, admin-only (never surfaced to the
-- teacher's own account). One row per (teacher, category, date); its absence has a
-- category-specific default meaning enforced in application code, not here:
--   - morning_lineup / class_time_commitment: no row = present (✓) by default; a row only ever
--     records an exception ('absent') -- the admin is unchecking someone out of an assumed-present
--     roster, not building the roster up from nothing.
--   - supervision / duty / waiting_period_activation: no row = not applicable that day (blank);
--     a row explicitly records 'present' or 'absent' only for a teacher who actually had that duty.
create table if not exists teacher_performance_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  category text not null check (category in ('morning_lineup', 'supervision', 'duty', 'waiting_period_activation', 'class_time_commitment')),
  record_date date not null,
  status text not null check (status in ('present', 'absent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, category, record_date)
);
create index if not exists idx_teacher_performance_records_date on teacher_performance_records(record_date);

-- الالتزام بزمن الحصة needs a third status (متأخر) plus which class period the violation happened
-- in -- a teacher can be late for one period and absent from another on the same day, so the old
-- one-row-per-(teacher,category,date) uniqueness has to widen to include period. period is '' (not
-- null) for every other category, keeping a plain unique constraint instead of a functional index.
alter table teacher_performance_records add column if not exists period text not null default '';
alter table teacher_performance_records drop constraint if exists teacher_performance_records_status_check;
alter table teacher_performance_records add constraint teacher_performance_records_status_check check (status in ('present', 'absent', 'late'));
alter table teacher_performance_records drop constraint if exists teacher_performance_records_teacher_id_category_record_date_key;
alter table teacher_performance_records add constraint teacher_performance_records_teacher_id_category_record_date_period_key unique (teacher_id, category, record_date, period);

-- Demo/presentation accounts: can browse both /teacher and /admin regardless of role, but every
-- mutating request is blocked at the middleware level (see middleware.ts) -- for showing the whole
-- system to an outside audience without any risk of real data being changed.
alter table users add column if not exists demo_view_only boolean not null default false;

-- جدول مدرسي builder: مؤيد (or any account granted this) builds the real weekly timetable from
-- scratch -- which teacher+subject covers which شعبة (section) at each (day, period). Two unique
-- constraints give hard conflict prevention: a section can't have two classes in the same slot,
-- and a teacher can't teach two sections in the same slot.
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists teacher_subjects (
  teacher_id uuid not null references users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  primary key (teacher_id, subject_id)
);

create table if not exists class_sections (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists schedule_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  subject_id uuid not null references subjects(id),
  section_id uuid not null references class_sections(id) on delete cascade,
  day text not null check (day in ('احد', 'اثنين', 'ثلاثاء', 'اربعاء', 'خميس')),
  period text not null check (period in ('1', '2', '3', '4', '5', '6', '7')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, day, period),
  unique (teacher_id, day, period)
);
create index if not exists idx_schedule_slots_teacher on schedule_slots(teacher_id);
create index if not exists idx_schedule_slots_section on schedule_slots(section_id);

-- Grants access to the /admin/schedule-builder tool -- additive like restricted_category, so a
-- teacher-role account (e.g. مؤيد) can carry this alongside their normal teacher access.
alter table users add column if not exists can_build_schedule boolean not null default false;

-- Auto-generator support for جدول مدرسي: a teacher can be marked unavailable for a whole day, a
-- whole period across every day, or one exact (day, period) slot -- the generator treats all
-- three as hard constraints it must never violate.
create table if not exists teacher_unavailability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  day text check (day in ('احد', 'اثنين', 'ثلاثاء', 'اربعاء', 'خميس')),
  period text check (period in ('1', '2', '3', '4', '5', '6', '7')),
  created_at timestamptz not null default now(),
  constraint teacher_unavailability_has_scope check (day is not null or period is not null)
);
create index if not exists idx_teacher_unavailability_teacher on teacher_unavailability(teacher_id);

-- The "curriculum": how many periods/week a given teacher teaches a given subject to a given
-- section. The generator reads these as its targets and tries to place exactly this many slots
-- per requirement without violating any teacher_unavailability row or double-booking.
create table if not exists schedule_requirements (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references class_sections(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  periods_per_week integer not null check (periods_per_week between 1 and 35),
  created_at timestamptz not null default now(),
  unique (section_id, subject_id)
);
create index if not exists idx_schedule_requirements_section on schedule_requirements(section_id);
create index if not exists idx_schedule_requirements_teacher on schedule_requirements(teacher_id);

-- Replaces the plain file-upload flow for نواتج التعلم > قياس الأثر: instead of scanning and
-- uploading the paper form, the teacher fills it in directly, one row per student's remedial-plan
-- outcome. max_score is per-entry (not a fixed /10) since different assessments grade out of
-- different totals. recommendations is a checkbox set, so a teacher can pick more than one.
create table if not exists impact_measurements (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  subject text not null,
  student_name text not null,
  class_name text not null,
  max_score integer not null default 10 check (max_score > 0),
  score_before integer not null check (score_before >= 0),
  score_after integer not null check (score_after >= 0),
  improvement_level text not null check (improvement_level in ('كبير', 'متوسط', 'بسيط', 'لم يتحسن')),
  teacher_notes text,
  recommendations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_impact_measurements_teacher on impact_measurements(teacher_id);

-- These 7 tables were created without RLS enabled, so Supabase's Advisor flagged them (their
-- public-schema tables are otherwise reachable over PostgREST via the anon key). The service role
-- this app uses bypasses RLS regardless, so enabling it with zero policies changes nothing for the
-- app and just closes that public REST exposure.
alter table subjects enable row level security;
alter table teacher_subjects enable row level security;
alter table class_sections enable row level security;
alter table schedule_slots enable row level security;
alter table teacher_unavailability enable row level security;
alter table schedule_requirements enable row level security;
alter table impact_measurements enable row level security;

-- نموذج تحويل الطالب: المعلم -> وكيل شؤون الطلاب -> الموجه الطلابي. One row per referral; each
-- stage's own fields live on the same row (the paper forms are one packet that travels along).
-- agent_procedures / counselor_procedures hold the ticked procedure numbers (see
-- lib/student-referral-constants.ts). status moves draft -> with_agent -> with_counselor.
create table if not exists student_referrals (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  student_name text not null,
  class_name text not null,
  subject text not null,
  reasons text[] not null default '{}',
  problem_description text,
  status text not null default 'draft' check (status in ('draft', 'with_agent', 'with_counselor')),
  sent_to_agent_at timestamptz,
  agent_procedures integer[] not null default '{}',
  agent_notes text,
  sent_to_counselor_at timestamptz,
  counselor_procedures integer[] not null default '{}',
  counselor_extra_services text,
  counselor_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_student_referrals_teacher on student_referrals(teacher_id);
create index if not exists idx_student_referrals_status on student_referrals(status);

-- "الإجراءات" attachments (files/images) added by the agent or the counselor on a referral.
create table if not exists student_referral_files (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references student_referrals(id) on delete cascade,
  stage text not null check (stage in ('agent', 'counselor')),
  file_path text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_student_referral_files_referral on student_referral_files(referral_id);

alter table student_referrals enable row level security;
alter table student_referral_files enable row level security;

-- مراجعة الأسبوع: the reviewer's per-file verdict on a teacher's upload (accepted, or sent back
-- for changes with a note the teacher sees next to the file), plus a per-teacher "reviewed up to
-- here" mark so each weekly review only shows what's new since the reviewer's last pass.
alter table attachments add column if not exists review_status text;
alter table attachments add column if not exists review_note text;
alter table attachments add column if not exists reviewed_at timestamptz;
do $$ begin
  alter table attachments add constraint attachments_review_status_check
    check (review_status in ('accepted', 'needs_revision'));
exception
  when duplicate_object then null;
end $$;

create table if not exists weekly_review_marks (
  teacher_id uuid not null references users(id) on delete cascade,
  reviewer_id uuid not null references users(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  primary key (teacher_id, reviewer_id)
);
alter table weekly_review_marks enable row level security;

-- تحضير مدرستي in متابعة أداء المعلمين: one mark per teacher per school week (week_start = that
-- week's Sunday). No row = green (default); 'yellow' / 'red' are the two exceptions.
create table if not exists madrasati_prep_weeks (
  teacher_id uuid not null references users(id) on delete cascade,
  week_start date not null,
  status text not null check (status in ('yellow', 'red')),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, week_start)
);
alter table madrasati_prep_weeks enable row level security;

-- Referral routing: a teacher's class decides which وكيل شؤون الطلاب receives the referral
-- (student_referral_routing: one row per class), and the agent then picks the الموجه الطلابي.
-- assigned_* record who each referral is currently routed to, so every agent/counselor only sees
-- their own.
alter table student_referrals add column if not exists assigned_agent_id uuid references users(id);
alter table student_referrals add column if not exists assigned_counselor_id uuid references users(id);
create index if not exists idx_student_referrals_assigned_agent on student_referrals(assigned_agent_id);
create index if not exists idx_student_referrals_assigned_counselor on student_referrals(assigned_counselor_id);

create table if not exists student_referral_routing (
  class_name text primary key,
  agent_id uuid not null references users(id) on delete cascade
);
alter table student_referral_routing enable row level security;

-- الالتزام بزمن الحصة: how many minutes a teacher was late (set only on 'late' rows), and a per-account
-- grant to use just that one tracking section (for وكلاء الطلاب and the teachers who help with it).
alter table teacher_performance_records add column if not exists late_minutes integer;
alter table users add column if not exists can_track_class_time boolean not null default false;
