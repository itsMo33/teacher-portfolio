import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-options";
import { getInquiryRole, listInquiries } from "@/lib/inquiries";
import { displayText, type InquiryKind } from "@/lib/inquiry-logic";
import { InquiryUploader } from "@/components/inquiries/InquiryUploader";
import { InquiryReviewList } from "@/components/inquiries/InquiryReviewList";
import { OfficerSentList } from "@/components/inquiries/OfficerSentList";
import { countInquiryFiles } from "@/lib/inquiry-files";
import { WeeklyPrintButton } from "@/components/inquiries/WeeklyPrintButton";

type Tab = "all" | "delay" | "absence" | "other";

const TITLES: Record<Tab, string> = {
  all: "الكل",
  delay: "مسائلات تأخير (حضوري)",
  absence: "مسائلات الغياب",
  other: "المسائلات الأخرى",
};

/** Every kind of مسائلة in one place, chosen with ?kind=: all of them together, the late-arrival ones, the absence
 *  ones, the other ones, and the older uploaded-file ones. The uploading account (محمد الخميس) sends the PDF kinds
 *  out, follows what he sent and decides inquiries together with رائد and the manager, who also upload. */
export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ kind?: string; filter?: string }> }) {
  const session = await auth();
  const role = session ? getInquiryRole(session.user) : null;
  if (role !== "officer" && role !== "reviewer") redirect("/admin");

  const { kind: kindParam, filter: filterParam } = await searchParams;
  const tabs: Tab[] = role === "reviewer" ? ["all", "delay", "absence", "other"] : ["delay", "absence", "other"];
  const tab: Tab = tabs.includes(kindParam as Tab) ? (kindParam as Tab) : tabs[0];
  const sendKinds: InquiryKind[] = tab === "delay" || tab === "absence" || tab === "other" ? [tab] : tab === "all" ? ["delay", "absence", "other"] : [];

  const [inquiries, fileCounts] = await Promise.all([listInquiries(), countInquiryFiles()]);
  const ofTab = tab === "all" ? inquiries : inquiries.filter((i) => i.kind === tab);
  // the older file inquiries brought over (already decided) have their own place in the list (the archive)
  const isLegacy = (i: { extractedText: string }) => i.extractedText.startsWith("مسائلة مرفوعة كملف");
  const shown = ofTab.filter((i) => !isLegacy(i));

  // what the uploading account sent itself, grouped by upload (for its delete buttons)
  const sentBatches = (() => {
    if (role !== "officer") return [];
    const map = new Map<string, { batchId: string; createdAt: string; items: { id: string; teacherName: string }[] }>();
    for (const i of shown.filter((x) => x.uploadedBy === session!.user.id)) {
      const batch = map.get(i.batchId) ?? { batchId: i.batchId, createdAt: i.createdAt, items: [] };
      batch.items.push({ id: i.id, teacherName: i.teacherName });
      map.set(i.batchId, batch);
    }
    return [...map.values()];
  })();

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
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

      {/* the work tools stay folded away, so the inquiries themselves are what the page shows */}
      <div className="flex flex-col gap-2">
        {!session!.user.demoViewOnly && (
          <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">رفع مسائلات جديدة (ملف PDF)</summary>
            <div className="mt-3 flex flex-col gap-3">
              {sendKinds.map((k) => (
                <InquiryUploader key={k} kind={k} />
              ))}
            </div>
          </details>
        )}
        <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">طباعة مسائلات الأسبوع (مع المرفقات)</summary>
          <div className="mt-3">
            <WeeklyPrintButton kind={tab} />
          </div>
        </details>
        {role === "officer" && (
          <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">اللي أرسلته (للحذف)</summary>
            <div className="mt-3">
              <OfficerSentList batches={sentBatches} />
            </div>
          </details>
        )}
        {role === "reviewer" && (
          <Link href="/admin/statistics?tab=inquiries" className="self-start text-xs text-[var(--brand-primary)] hover:underline">
            إحصائيات المسائلات (الأعداد والتفاصيل لكل معلم) ←
          </Link>
        )}
      </div>

      <InquiryReviewList
        key={`${tab}-${filterParam ?? ""}`}
        initialFilter={filterParam}
        kind={tab === "all" ? "all" : tab}
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
          decision: i.decision,
          decisionOption: i.decisionOption,
          decisionNote: i.decisionNote,
          fileCount: fileCounts.get(i.id) ?? 0,
          legacy: isLegacy(i),
        }))}
      />
    </div>
  );
}
