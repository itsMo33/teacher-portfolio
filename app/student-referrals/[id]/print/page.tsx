import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { AGENT_PROCEDURES, COUNSELOR_PROCEDURES, REFERRAL_REASONS, VIOLATIONS } from "@/lib/student-referral-constants";
import { canView, getReferral, getReferralActor, getReferralFiles, isAgentFiled, type ReferralFile } from "@/lib/student-referrals";

const COLUMNS = 5;

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center border border-slate-600 text-xs leading-none">
      {checked ? "✓" : ""}
    </span>
  );
}

interface ProcedureCell {
  n: number;
  text: string;
  checked: boolean;
  /** Free text shown inside the cell (the counselor's "خدمات إضافية" box) instead of a tick. */
  extra?: string;
}

/** The paper forms' procedure table: five (م | الإجراء) column pairs per row. The page is RTL, so
 *  the first cell of each row lands on the right, exactly like the paper original. */
function ProcedureTable({ cells }: { cells: ProcedureCell[] }) {
  const rows: ProcedureCell[][] = [];
  for (let i = 0; i < cells.length; i += COLUMNS) rows.push(cells.slice(i, i + COLUMNS));

  return (
    <table className="w-full border-collapse text-[10px] leading-tight">
      <thead>
        <tr>
          {Array.from({ length: COLUMNS }).map((_, i) => (
            <HeaderCells key={i} />
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="break-inside-avoid">
            {Array.from({ length: COLUMNS }).map((_, i) => {
              const cell = row[i];
              return cell ? (
                <ProcedureCells key={i} cell={cell} />
              ) : (
                <EmptyCells key={i} />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HeaderCells() {
  return (
    <>
      <th className="border border-slate-500 p-0.5 w-6">م</th>
      <th className="border border-slate-500 p-0.5">الإجراء</th>
    </>
  );
}

function EmptyCells() {
  return (
    <>
      <td className="border border-slate-500 p-0.5" />
      <td className="border border-slate-500 p-0.5" />
    </>
  );
}

function ProcedureCells({ cell }: { cell: ProcedureCell }) {
  return (
    <>
      <td className="border border-slate-500 p-0.5 text-center align-top font-bold">{cell.n}</td>
      <td className={`border border-slate-500 p-0.5 align-top ${cell.checked ? "bg-slate-200 font-bold" : ""}`}>
        <span className="flex items-start gap-1.5">
          {cell.extra === undefined && <CheckBox checked={cell.checked} />}
          <span>{cell.extra === undefined ? cell.text : `${cell.text}${cell.extra ? `: ${cell.extra}` : ""}`}</span>
        </span>
      </td>
    </>
  );
}

function Attachments({ files }: { files: ReferralFile[] }) {
  if (files.length === 0) return null;
  const images = files.filter((f) => f.mime_type.startsWith("image/"));
  return (
    <div className="mt-4 break-before-page">
      <p className="font-bold text-sm mb-1">المرفقات (الإجراءات):</p>
      <ul className="list-disc pr-5 text-xs mb-2">
        {files.map((f) => (
          <li key={f.id}>{f.file_name}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {images.map((f) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.id} src={f.signedUrl} alt={f.file_name} className="max-h-64 max-w-full border border-slate-300 object-contain break-inside-avoid" />
        ))}
      </div>
    </div>
  );
}

function FormHeader({ title }: { title: string }) {
  return (
    <div className="text-center mb-2">
      <p className="text-[10px] text-slate-500">{SCHOOL_NAME}</p>
      <h1 className="text-sm font-bold">{title}</h1>
    </div>
  );
}

export default async function StudentReferralPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const actor = getReferralActor(session.user);
  if (!actor) notFound();

  const referral = await getReferral(id);
  if (!referral || !canView(actor, session.user.id, referral)) notFound();

  // The teacher only ever prints their own form; the agent, counselor and manager print the whole
  // packet as far as it has travelled.
  const showAgent = actor !== "teacher" && referral.status !== "draft";
  const showCounselor = actor !== "teacher" && referral.status === "with_counselor";

  const files = showAgent ? await getReferralFiles(id) : [];

  const agentCells: ProcedureCell[] = AGENT_PROCEDURES.map((p) => ({
    ...p,
    checked: referral.agentProcedures.includes(p.n),
  }));
  const counselorCells: ProcedureCell[] = [
    ...COUNSELOR_PROCEDURES.map((p) => ({ ...p, checked: referral.counselorProcedures.includes(p.n) })),
    {
      n: COUNSELOR_PROCEDURES.length + 1,
      text: "خدمات إضافية من الموجه الطلابي",
      checked: false,
      extra: referral.counselorExtraServices ?? "",
    },
  ];

  const filedByAgent = isAgentFiled(referral);
  const agentFiles = files.filter((f) => f.stage === "agent");
  const counselorFiles = files.filter((f) => f.stage === "counselor");

  // All the forms share one A4 page (attachments, if any, follow on their own pages).
  return (
    <div className="max-w-3xl mx-auto bg-white text-slate-900 p-6 print:p-0 text-[11px] leading-snug">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <section>
        <FormHeader title={filedByAgent ? "نموذج مخالفة طالب" : "نموذج تحويل طالب لوكيل شؤون الطلاب"} />
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <p>
              <strong>اسم الطالب/</strong> {referral.studentName}
            </p>
            <p>
              <strong>الصف:</strong> {referral.className}
            </p>
            {!filedByAgent && (
              <p>
                <strong>المادة/</strong> {referral.subject}
              </p>
            )}
          </div>
          <div>
            <p className="font-bold mb-1">{filedByAgent ? "المخالفة:" : "سبب التحويل:"}</p>
            {filedByAgent ? (
              <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px]">
                {VIOLATIONS.map((v) => (
                  <span key={v} className="flex items-start gap-1">
                    <CheckBox checked={referral.reasons.includes(v)} />
                    {v}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {REFERRAL_REASONS.map((reason) => (
                  <span key={reason} className="flex items-center gap-1.5">
                    <CheckBox checked={referral.reasons.includes(reason)} />
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="font-bold mb-0.5">{filedByAgent ? "إيضاح:" : "إيضاح المشكلة:"}</p>
            <p className="min-h-[1.5rem] whitespace-pre-wrap border-b border-slate-400 pb-1">{referral.problemDescription || "--"}</p>
          </div>
          {!filedByAgent && (
            <p>
              <strong>اسم المعلم:</strong> {referral.teacherName}
            </p>
          )}
        </div>
      </section>

      {showAgent && (
        <section className="mt-3 border-t border-slate-400 pt-3 break-inside-avoid">
          <FormHeader title="إجراءات وكيل شؤون الطلاب" />
          <ProcedureTable cells={agentCells} />
          <p className="mt-1.5">
            <strong>ملاحظات وكيل الطلاب:</strong> <span className="whitespace-pre-wrap">{referral.agentNotes || "--"}</span>
          </p>
        </section>
      )}

      {showCounselor && (
        <section className="mt-3 border-t border-slate-400 pt-3 break-inside-avoid">
          <FormHeader title="إجراءات الموجه الطلابي" />
          <ProcedureTable cells={counselorCells} />
          <p className="mt-1.5">
            <strong>ملاحظات الموجه الطلابي:</strong> <span className="whitespace-pre-wrap">{referral.counselorNotes || "--"}</span>
          </p>
        </section>
      )}

      <Attachments files={agentFiles} />
      <Attachments files={counselorFiles} />
    </div>
  );
}
