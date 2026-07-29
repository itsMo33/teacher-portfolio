export type Role = "teacher" | "agent" | "manager";

export interface AppUser {
  id: string;
  national_id: string;
  role: Role;
  name: string;
  subject: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  teacher_id: string;
  category: string;
  subcategory: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface Schedule {
  id: string;
  teacher_id: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
  uploaded_by: string;
}
