import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { AGENT_PROCEDURES, COUNSELOR_PROCEDURES, REFERRAL_REASONS } from "@/lib/student-referral-constants";
import { canView, getReferral, getReferralActor, getReferralFiles, type ReferralFile } from "@/lib/student-referrals";

const COLUMNS = 5;

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center border border-slate-600 text-xs leading-none">
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
    <table className="w-full border-collapse text-xs">
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
      <th className="border border-slate-500 p-1.5 w-8">م</th>
      <th className="border border-slate-500 p-1.5">الإجراء</th>
    </>
  );
}

function EmptyCells() {
  return (
    <>
      <td className="border border-slate-500 p-1.5" />
      <td className="border border-slate-500 p-1.5" />
    </>
  );
}

function ProcedureCells({ cell }: { cell: ProcedureCell }) {
  return (
    <>
      <td className="border border-slate-500 p-1.5 text-center align-top font-bold">{cell.n}</td>
      <td className={`border border-slate-500 p-1.5 align-top ${cell.checked ? "bg-slate-200 font-bold" : ""}`}>
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
    <div className="mt-4">
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
    <div className="text-center mb-5">
      <p className="text-sm text-slate-500">{SCHOOL_NAME}</p>
      <h1 className="text-xl font-bold">{title}</h1>
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

  return (
    <div className="max-w-3xl mx-auto bg-white text-slate-900 p-6 print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <section>
        <FormHeader title="نموذج تحويل طالب لوكيل شؤون الطلاب" />
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <p>
              <strong>اسم الطالب/</strong> {referral.studentName}
            </p>
            <p>
              <strong>الصف:</strong> {referral.className}
            </p>
            <p>
              <strong>المادة/</strong> {referral.subject}
            </p>
          </div>
          <div>
            <p className="font-bold mb-1.5">سبب التحويل:</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {REFERRAL_REASONS.map((reason) => (
                <span key={reason} className="flex items-center gap-1.5">
                  <CheckBox checked={referral.reasons.includes(reason)} />
                  {reason}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-bold mb-1.5">إيضاح المشكلة:</p>
            <p className="min-h-[5rem] whitespace-pre-wrap border-b border-slate-400 pb-2">
              {referral.problemDescription || "--"}
            </p>
          </div>
          <p>
            <strong>اسم المعلم:</strong> {referral.teacherName}
          </p>
        </div>
      </section>

      {showAgent && (
        <section className="mt-10 print:mt-0 print:break-before-page">
          <FormHeader title="إجراءات وكيل شؤون الطلاب" />
          <p className="text-sm mb-3">
            <strong>الطالب:</strong> {referral.studentName} -- {referral.className}
          </p>
          <ProcedureTable cells={agentCells} />
          <div className="mt-4">
            <p className="font-bold text-sm mb-1">ملاحظات وكيل الطلاب:</p>
            <p className="text-sm min-h-[3rem] whitespace-pre-wrap border-b border-slate-400 pb-2">
              {referral.agentNotes || "--"}
            </p>
          </div>
          <Attachments files={files.filter((f) => f.stage === "agent")} />
        </section>
      )}

      {showCounselor && (
        <section className="mt-10 print:mt-0 print:break-before-page">
          <FormHeader title="إجراءات الموجه الطلابي" />
          <p className="text-sm mb-3">
            <strong>الطالب:</strong> {referral.studentName} -- {referral.className}
          </p>
          <ProcedureTable cells={counselorCells} />
          <div className="mt-4">
            <p className="font-bold text-sm mb-1">ملاحظات الموجه الطلابي:</p>
            <p className="text-sm min-h-[3rem] whitespace-pre-wrap border-b border-slate-400 pb-2">
              {referral.counselorNotes || "--"}
            </p>
          </div>
          <Attachments files={files.filter((f) => f.stage === "counselor")} />
        </section>
      )}
    </div>
  );
}
