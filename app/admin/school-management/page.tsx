import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth-options";
import { getSchoolManagementCategories, getSchoolFiles, getOwnedCategoryKeys } from "@/lib/school-files";
import { FileUploadDropzone } from "@/components/portfolio/FileUploadDropzone";
import { SchoolFileList } from "@/components/admin/SchoolFileList";

export default async function SchoolManagementPage() {
  const session = await auth();
  if (!session || session.user.role === "teacher") redirect("/admin");

  const [ownedKeys, categories] = await Promise.all([getOwnedCategoryKeys(), getSchoolManagementCategories()]);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">إدارة المدرسة</h2>
          <p className="text-sm text-slate-500">ملفات خاصة بإدارة المدرسة، لا يطّلع عليها المعلمون</p>
        </div>
        <Link
          href="/admin/school-management/manage"
          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          إدارة الأقسام
        </Link>
      </div>

      {await Promise.all(
        categories.map(async (cat) => {
          const isOwned = ownedKeys.has(cat.key);
          const subsections = cat.subsections ?? [{ key: "", labelAr: "" }];

          return (
            <div key={cat.key} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.accentColor }}
                />
                {cat.labelAr}
                {isOwned && (
                  <span className="text-xs font-normal text-slate-400">(للاطلاع فقط -- مسؤول مخصص يرفع الملفات)</span>
                )}
              </h3>

              {await Promise.all(
                subsections.map(async (sub) => {
                  const files = await getSchoolFiles(cat.key, sub.key || null);
                  return (
                    <div key={sub.key} className="flex flex-col gap-2 pr-3">
                      {sub.labelAr && (
                        <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">{sub.labelAr}</h4>
                      )}
                      {!isOwned && (
                        <FileUploadDropzone
                          uploadUrl="/api/school-files/upload"
                          extraFields={{ category: cat.key, subcategory: sub.key }}
                        />
                      )}
                      <SchoolFileList files={files} canDelete={!isOwned} />
                    </div>
                  );
                })
              )}

              {cat.subsections &&
                (await (async () => {
                  // A general bucket for files that don't fit any one subsection above
                  // (subcategory null) -- also where pre-subsection uploads still live.
                  const generalFiles = await getSchoolFiles(cat.key, null);
                  return (
                    <div className="flex flex-col gap-2 pr-3">
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300">ملفات عامة</h4>
                      {!isOwned && (
                        <FileUploadDropzone
                          uploadUrl="/api/school-files/upload"
                          extraFields={{ category: cat.key, subcategory: "" }}
                        />
                      )}
                      <SchoolFileList files={generalFiles} canDelete={!isOwned} />
                    </div>
                  );
                })())}
            </div>
          );
        })
      )}
    </div>
  );
}
