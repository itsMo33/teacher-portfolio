export const SCHEDULE_DAYS = ["احد", "اثنين", "ثلاثاء", "اربعاء", "خميس"] as const;
export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

export const SCHEDULE_PERIODS = ["1", "2", "3", "4", "5", "6", "7"] as const;
export type SchedulePeriod = (typeof SCHEDULE_PERIODS)[number];

export interface Subject {
  id: string;
  nameAr: string;
}

export interface ClassSection {
  id: string;
  nameAr: string;
  sortOrder: number;
}

export interface ScheduleSlot {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  sectionId: string;
  day: ScheduleDay;
  period: SchedulePeriod;
}

/** null day = applies to every day; null period = applies to the whole day. Never both null. */
export interface TeacherUnavailability {
  id: string;
  teacherId: string;
  day: ScheduleDay | null;
  period: SchedulePeriod | null;
}

export interface ScheduleRequirement {
  id: string;
  sectionId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  periodsPerWeek: number;
}

export const SLOT_SELECT = "id, teacher_id, subject_id, section_id, day, period, users(name), subjects(name_ar)";

interface SlotRow {
  id: string;
  teacher_id: string;
  subject_id: string;
  section_id: string;
  day: string;
  period: string;
  users: { name: string } | { name: string }[] | null;
  subjects: { name_ar: string } | { name_ar: string }[] | null;
}

export function toSlot(row: SlotRow): ScheduleSlot {
  const teacher = Array.isArray(row.users) ? row.users[0] : row.users;
  const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: teacher?.name ?? "",
    subjectId: row.subject_id,
    subjectName: subject?.name_ar ?? "",
    sectionId: row.section_id,
    day: row.day as ScheduleDay,
    period: row.period as SchedulePeriod,
  };
}
