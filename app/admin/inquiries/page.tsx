import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { countInquiries, getInquiryRole, listInquiries } from "@/lib/inquiries";
import { InquirySummary } from "@/components/inquiries/InquirySummary";
import { displayText } from "@/lib/inquiry-logic";
import { InquiryUploader } from "@/components/inquiries/InquiryUploader";
import { InquiryReviewList } from "@/components/inquiries/InquiryReviewList";
import { AccountabilityFiles } from "@/components/admin/AccountabilityFiles";

type Tab = "all" | "delay" | "other" | "files";

const TITLES: Record<Tab, string> = {
  all: "الكل",
  delay: "مسائلات تأخير (حضوري)",
  other: "المسائلات الأخرى",
  files: "ملفات المسائلات",
};

/** Every kind of مسائلة in one place, chosen with ?kind=: all of them together, the late-arrival ones, the other
 *  ones, and the older uploaded-file ones. The uploading account (محمد الخميس) only sends the two PDF kinds out and
 *  sees what he sent; رائد and the manager follow every inquiry, decide them and can upload too. */
export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const session = await auth();
  const role = session ? getInquiryRole(session.user) : null;
  if (role !== "officer" && role !== "reviewer") redirect("/admin");

  const { kind: kindParam } = await searchParams;
  const tabs: Tab[] = role === "reviewer" ? ["all", "delay", "other", "files"] : ["delay", "other"];
  const tab: Tab = tabs.includes(kindParam as Tab) ? (kindParam as Tab) : tabs[0];
  const sendKinds: ("delay" | "other")[] = tab === "delay" || tab === "other" ? [tab] : tab === "all" ? ["delay", "other"] : [];

  const inquiries = tab === "files" ? [] : await listInquiries();
  const shown = tab === "all" ? inquiries : inquiries.filter((i) => i.kind === tab);

  // per teacher: how many inquiries, how many accepted / rejected / still waiting (for the reviewers)
  const byTeacher = new Map<string, { name: string; list: typeof inquiries }>();
  for (const i of shown) {
    const entry = byTeacher.get(i.teacherId) ?? { name: i.teacherName, list: [] };
    entry.list.push(i);
    byTeacher.set(i.teacherId, entry);
  }
  const teacherRows = [...byTeacher.values()]
    .map((e) => ({ name: e.name, counts: countInquiries(e.list) }))
    .sort((a, b) => b.counts.rejected - a.counts.rejected || b.counts.total - a.counts.total || a.name.localeCompare(b.name, "ar"));

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">المسائلات{tab !== "all" ? ` -- ${TITLES[tab]}` : ""}</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {tabs.map((k) => (
            <Link
              key={k}
              href={`/admin/inquiries?kind=${k}`}
              className={`rounded-lg border px-3 py-1.5 transition-colors ${
                k === tab
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {TITLES[k]}
            </Link>
          ))}
        </div>
      </div>

      {tab === "files" ? (
        <AccountabilityFiles />
      ) : (
        <>
          {!session!.user.demoViewOnly &&
            (sendKinds.length === 1 ? (
              <InquiryUploader kind={sendKinds[0]} />
            ) : (
              <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">رفع مسائلات جديدة (ملف PDF)</summary>
                <div className="mt-3 flex flex-col gap-3">
                  {sendKinds.map((k) => (
                    <InquiryUploader key={k} kind={k} />
                  ))}
                </div>
              </details>
            ))}

          {role === "officer" ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
              أُرسل من هذا النوع: {shown.length} مسائلة. المتابعة والقرار عند رائد.
            </div>
          ) : (
            <>
              <InquirySummary counts={countInquiries(shown)} />
              {teacherRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                        <th className="p-2 text-right">المعلم</th>
                        <th className="p-2 text-right">الكل</th>
                        <th className="p-2 text-right">مقبولة</th>
                        <th className="p-2 text-right">مرفوضة</th>
                        <th className="p-2 text-right">بانتظار القرار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherRows.map((r) => (
                        <tr key={r.name} className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="p-2 font-medium text-slate-900 dark:text-slate-50">{r.name}</td>
                          <td className="p-2 tabular-nums">{r.counts.total}</td>
                          <td className="p-2 tabular-nums text-green-700 dark:text-green-400">{r.counts.accepted}</td>
                          <td className="p-2 tabular-nums text-red-700 dark:text-red-400">{r.counts.rejected}</td>
                          <td className="p-2 tabular-nums text-amber-700 dark:text-amber-400">{r.counts.pending}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <InquiryReviewList
                kind={tab === "all" ? "all" : tab === "delay" ? "delay" : "other"}
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
            </>
          )}
        </>
      )}
    </div>
  );
}
