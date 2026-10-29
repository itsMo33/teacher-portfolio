import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getInquiryRole, listInquiries } from "@/lib/inquiries";
import { displayText } from "@/lib/inquiry-logic";
import { InquiryUploader } from "@/components/inquiries/InquiryUploader";
import { InquiryReviewList } from "@/components/inquiries/InquiryReviewList";

const TITLES = { delay: "مسائلات تأخير (حضوري)", other: "المسائلات الأخرى" } as const;

/** One page for both kinds, chosen with ?kind=. The uploading account (محمد الخميس) sends PDFs out and sees what
 *  he sent; رائد and the manager follow every inquiry and decide them. */
export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const session = await auth();
  const role = session ? getInquiryRole(session.user) : null;
  if (role !== "officer" && role !== "reviewer") redirect("/admin");

  const { kind: kindParam } = await searchParams;
  const kind = kindParam === "other" ? "other" : "delay";
  const inquiries = await listInquiries();
  const ofKind = inquiries.filter((i) => i.kind === kind);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{TITLES[kind]}</h2>
        <div className="flex gap-2 text-sm">
          {(["delay", "other"] as const).map((k) => (
            <Link
              key={k}
              href={`/admin/inquiries?kind=${k}`}
              className={`rounded-lg border px-3 py-1.5 transition-colors ${
                k === kind
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {TITLES[k]}
            </Link>
          ))}
        </div>
      </div>

      {!session!.user.demoViewOnly && <InquiryUploader kind={kind} />}

      {role === "officer" ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
          أُرسل من هذا النوع: {ofKind.length} مسائلة. المتابعة والقرار عند رائد.
        </div>
      ) : (
        <InquiryReviewList
          kind={kind}
          inquiries={inquiries.map((i) => ({
            id: i.id,
            kind: i.kind,
            teacherName: i.teacherName,
            createdAt: i.createdAt,
            delayMinutes: i.delayMinutes,
            extractedText: displayText(i.extractedText).text,
            textReadable: displayText(i.extractedText).readable,
            teacherOpenedAt: i.teacherOpenedAt,
            justification: i.justification,
            systemDecision: i.systemDecision,
            systemNote: i.systemNote,
            decision: i.decision,
            decisionNote: i.decisionNote,
          }))}
        />
      )}
    </div>
  );
}
