import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SCHOOL_NAME } from "@/lib/school";
import { PrintButton } from "@/components/admin/PrintButton";
import { getInquiry, getInquiryRole } from "@/lib/inquiries";
import { displayText, extractPeriod, INQUIRY_KIND_LABEL } from "@/lib/inquiry-logic";

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center border border-slate-700 text-xs leading-none">{checked ? "✓" : ""}</span>
  );
}

function when(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
}

/** The inquiry as a finished form -- the school's مساءلة with the teacher's answer and the decision filled in
 *  electronically, so it can be printed (or saved as a PDF) and attached instead of being signed by hand. The
 *  reviewers print any of them; a teacher prints their own once it has been decided. */
export default async function InquiryPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const role = getInquiryRole(session.user);
  const inquiry = role ? await getInquiry(id) : null;
  if (!role || !inquiry) notFound();
  if (role === "teacher" && (inquiry.teacherId !== session.user.id || !inquiry.decidedAt)) notFound();

  const { data: decider } = inquiry.decidedBy
    ? await supabaseAdmin.from("users").select("name").eq("id", inquiry.decidedBy).maybeSingle()
    : { data: null };

  const shown = displayText(inquiry.extractedText);
  const period = extractPeriod(shown.text);
  const decided = inquiry.decision !== null && inquiry.decidedAt !== null;

  return (
    <div className="max-w-3xl mx-auto bg-white text-slate-900 p-6 print:p-0 text-[13px] leading-relaxed">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <header className="text-center mb-4">
        <p className="text-xs">المملكة العربية السعودية -- وزارة التعليم</p>
        <p className="text-xs">{SCHOOL_NAME}</p>
        <h1 className="mt-2 text-xl font-bold">{inquiry.kind === "delay" ? "مساءلة عن تأخر" : inquiry.kind === "absence" ? "مساءلة غياب" : "مساءلة"}</h1>
      </header>

      <table className="w-full border-collapse mb-4">
        <tbody>
          <tr>
            <th className="w-32 border border-slate-700 bg-slate-100 p-2 text-right">الاسم</th>
            <td className="border border-slate-700 p-2">{inquiry.teacherName}</td>
          </tr>
          <tr>
            <th className="border border-slate-700 bg-slate-100 p-2 text-right">نوع المساءلة</th>
            <td className="border border-slate-700 p-2">{INQUIRY_KIND_LABEL[inquiry.kind]}</td>
          </tr>
          {period && (
            <tr>
              <th className="border border-slate-700 bg-slate-100 p-2 text-right">الفترة</th>
              <td className="border border-slate-700 p-2">
                من {period.from} إلى {period.to}
              </td>
            </tr>
          )}
          {inquiry.kind === "delay" && inquiry.delayMinutes !== null && (
            <tr>
              <th className="border border-slate-700 bg-slate-100 p-2 text-right">إجمالي دقائق التأخر</th>
              <td className="border border-slate-700 p-2">{inquiry.delayMinutes} دقيقة</td>
            </tr>
          )}
          <tr>
            <th className="border border-slate-700 bg-slate-100 p-2 text-right">تاريخ الإرسال</th>
            <td className="border border-slate-700 p-2">{when(inquiry.createdAt)}</td>
          </tr>
        </tbody>
      </table>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold mb-1">إفادة المعلم (أسباب ذلك)</h2>
        <div className="min-h-24 whitespace-pre-wrap border border-slate-700 p-3">{inquiry.justification ?? "لم يقدّم المعلم إفادة."}</div>
        {inquiry.justifiedAt && (
          <p className="mt-1 text-xs text-slate-600">
            أقرّ المعلم {inquiry.teacherName} إلكترونياً بصحة ما ورد في إفادته، عبر حسابه في منصة أثر، بتاريخ {when(inquiry.justifiedAt)}.
          </p>
        )}
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold mb-1">رأي المسؤول</h2>
        <div className="flex flex-col gap-1 border border-slate-700 p-3">
          <p className="flex items-center gap-2">
            <CheckBox checked={decided && inquiry.decision === "accepted"} /> عذره مقبول
          </p>
          <p className="flex items-center gap-2">
            <CheckBox checked={decided && inquiry.decision === "rejected"} /> عذره غير مقبول ويعامل بما تقتضيه اللوائح
          </p>
          {inquiry.decisionNote && <p className="mt-1 text-xs">ملاحظة: {inquiry.decisionNote}</p>}
          {decided ? (
            <p className="mt-1 text-xs text-slate-600">
              اعتمده إلكترونياً: {decider?.name ?? "الإدارة"} -- {when(inquiry.decidedAt)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">لم يُبتّ فيها بعد.</p>
          )}
        </div>
      </section>

      <footer className="mt-6 border-t border-slate-300 pt-2 text-[11px] text-slate-500">
        نموذج صادر إلكترونياً من منصة أثر، وقرار الاعتماد مسجّل بحساب المسؤول وتاريخه -- رقم المساءلة: {inquiry.id.slice(0, 8)}
      </footer>
    </div>
  );
}
