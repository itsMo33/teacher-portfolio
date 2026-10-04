import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSignedUrl, PORTFOLIO_BUCKET } from "@/lib/supabase/storage";
import type { ReferralFileStage, ReferralStatus } from "./student-referral-constants";

export type ReferralActor = "teacher" | "agent" | "counselor" | "viewer";

/** Which part of the referral workflow an account plays. The وكيل شؤون الطلاب and الموجه الطلابي
 *  accounts already exist as agent-role accounts scoped to their إدارة المدرسة category, so that
 *  scope is what identifies them -- no extra flag needed. */
export function getReferralActor(user: { role: string; restrictedCategory?: string | null }): ReferralActor | null {
  if (user.role === "teacher") return "teacher";
  if (user.role === "agent" && user.restrictedCategory === "student_affairs_agent") return "agent";
  if (user.role === "agent" && user.restrictedCategory === "student_guidance") return "counselor";
  // The manager and رائد (an agent with no category scope) follow every referral, read-only for رائد.
  if ((user.role === "manager" || user.role === "agent") && !user.restrictedCategory) return "viewer";
  return null;
}

export interface StudentReferral {
  id: string;
  teacherId: string;
  teacherName: string;
  /** The وكيل شؤون الطلاب this referral was routed to (by class) when the teacher sent it. */
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  /** The الموجه الطلابي the agent chose when forwarding it. */
  assignedCounselorId: string | null;
  assignedCounselorName: string | null;
  studentName: string;
  className: string;
  subject: string;
  reasons: string[];
  problemDescription: string | null;
  status: ReferralStatus;
  sentToAgentAt: string | null;
  agentProcedures: number[];
  agentNotes: string | null;
  sentToCounselorAt: string | null;
  counselorProcedures: number[];
  counselorExtraServices: string | null;
  counselorNotes: string | null;
  createdAt: string;
}

/** A referral the وكيل شؤون الطلاب filed himself (a student violation) rather than one a teacher
 *  sent: he is both its creator and its assigned agent, so no extra column is needed. */
export function isAgentFiled(r: Pick<StudentReferral, "teacherId" | "assignedAgentId">): boolean {
  return r.assignedAgentId !== null && r.teacherId === r.assignedAgentId;
}

export interface ReferralFile {
  id: string;
  stage: ReferralFileStage;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
  signedUrl: string;
}

const REFERRAL_SELECT =
  "id, teacher_id, student_name, class_name, subject, reasons, problem_description, status, sent_to_agent_at, agent_procedures, agent_notes, sent_to_counselor_at, counselor_procedures, counselor_extra_services, counselor_notes, created_at, assigned_agent_id, assigned_counselor_id, teacher:users!student_referrals_teacher_id_fkey(name), agent:users!student_referrals_assigned_agent_id_fkey(name), counselor:users!student_referrals_assigned_counselor_id_fkey(name)";

interface ReferralRow {
  id: string;
  teacher_id: string;
  student_name: string;
  class_name: string;
  subject: string;
  reasons: string[] | null;
  problem_description: string | null;
  status: ReferralStatus;
  sent_to_agent_at: string | null;
  agent_procedures: number[] | null;
  agent_notes: string | null;
  sent_to_counselor_at: string | null;
  counselor_procedures: number[] | null;
  counselor_extra_services: string | null;
  counselor_notes: string | null;
  created_at: string;
  assigned_agent_id: string | null;
  assigned_counselor_id: string | null;
  teacher: NamedRelation;
  agent: NamedRelation;
  counselor: NamedRelation;
}

type NamedRelation = { name: string } | { name: string }[] | null;

const relationName = (r: NamedRelation): string | null => (Array.isArray(r) ? r[0]?.name : r?.name) ?? null;

function toReferral(row: ReferralRow): StudentReferral {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: relationName(row.teacher) ?? "",
    assignedAgentId: row.assigned_agent_id,
    assignedAgentName: relationName(row.agent),
    assignedCounselorId: row.assigned_counselor_id,
    assignedCounselorName: relationName(row.counselor),
    studentName: row.student_name,
    className: row.class_name,
    subject: row.subject,
    reasons: row.reasons ?? [],
    problemDescription: row.problem_description,
    status: row.status,
    sentToAgentAt: row.sent_to_agent_at,
    agentProcedures: row.agent_procedures ?? [],
    agentNotes: row.agent_notes,
    sentToCounselorAt: row.sent_to_counselor_at,
    counselorProcedures: row.counselor_procedures ?? [],
    counselorExtraServices: row.counselor_extra_services,
    counselorNotes: row.counselor_notes,
    createdAt: row.created_at,
  };
}

export async function getReferral(id: string): Promise<StudentReferral | null> {
  const { data } = await supabaseAdmin.from("student_referrals").select(REFERRAL_SELECT).eq("id", id).maybeSingle();
  return data ? toReferral(data as unknown as ReferralRow) : null;
}

/** The referrals an account is allowed to see, newest first: a teacher sees their own, an agent the
 *  ones routed to them by class (including what they already forwarded), a counselor only what an
 *  agent forwarded to them personally, and a manager everything that was sent on from a draft. */
export async function listReferralsFor(actor: ReferralActor, userId: string): Promise<StudentReferral[]> {
  let query = supabaseAdmin.from("student_referrals").select(REFERRAL_SELECT).order("created_at", { ascending: false });
  if (actor === "teacher") query = query.eq("teacher_id", userId);
  else if (actor === "agent") query = query.eq("assigned_agent_id", userId).in("status", ["with_agent", "with_counselor"]);
  else if (actor === "counselor") query = query.eq("assigned_counselor_id", userId).eq("status", "with_counselor");
  else query = query.neq("status", "draft");

  const { data } = await query;
  return (data ?? []).map((row) => toReferral(row as unknown as ReferralRow));
}

export async function getReferralFiles(referralId: string): Promise<ReferralFile[]> {
  const { data } = await supabaseAdmin
    .from("student_referral_files")
    .select("id, stage, file_path, file_name, mime_type, uploaded_at")
    .eq("referral_id", referralId)
    .order("uploaded_at", { ascending: true });

  return Promise.all(
    (data ?? []).map(async (f) => ({
      id: f.id,
      stage: f.stage as ReferralFileStage,
      file_name: f.file_name,
      mime_type: f.mime_type,
      uploaded_at: f.uploaded_at,
      signedUrl: await getSignedUrl(PORTFOLIO_BUCKET, f.file_path),
    }))
  );
}

/** A stage's form and attachments are editable only by its own role, and only while the referral
 *  is sitting with that role -- once forwarded, it becomes read-only for the sender. */
export function canEditStage(
  actor: ReferralActor,
  userId: string,
  referral: StudentReferral,
  stage: ReferralFileStage
): boolean {
  if (stage === "agent") return actor === "agent" && referral.status === "with_agent" && referral.assignedAgentId === userId;
  return actor === "counselor" && referral.status === "with_counselor" && referral.assignedCounselorId === userId;
}

/** Whether this account may view a given referral at all (mirrors listReferralsFor). */
export function canView(actor: ReferralActor, userId: string, referral: StudentReferral): boolean {
  if (actor === "teacher") return referral.teacherId === userId;
  if (actor === "agent") {
    return referral.assignedAgentId === userId && (referral.status === "with_agent" || referral.status === "with_counselor");
  }
  if (actor === "counselor") return referral.assignedCounselorId === userId && referral.status === "with_counselor";
  return referral.status !== "draft";
}

/** The وكيل شؤون الطلاب who handles a class, from the routing table (null if the class isn't routed). */
export async function getAgentForClass(className: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("student_referral_routing").select("agent_id").eq("class_name", className).maybeSingle();
  return (data?.agent_id as string | undefined) ?? null;
}

/** The classes a teacher can pick when filing a referral -- every class that has an agent. */
export async function getRoutedClasses(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("student_referral_routing").select("class_name").order("class_name");
  return (data ?? []).map((r) => r.class_name as string);
}

export interface Counselor {
  id: string;
  name: string;
}

/** The student counselors an agent can forward a referral to. */
export async function getCounselors(): Promise<Counselor[]> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("role", "agent")
    .eq("restricted_category", "student_guidance")
    .is("deleted_at", null)
    .order("name");
  return (data ?? []) as Counselor[];
}
