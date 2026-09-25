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
