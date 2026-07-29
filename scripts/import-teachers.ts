import { config } from "dotenv";
config({ path: ".env.local" });

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const ROLE_MAP: Record<string, "teacher" | "agent" | "manager"> = {
  "معلم": "teacher",
  "وكيل": "agent",
  "مدير": "manager",
};

interface Row {
  rowNumber: number;
  name: string;
  nationalId: string;
  role: "teacher" | "agent" | "manager";
  subject: string | null;
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: tsx scripts/import-teachers.ts <path-to-xlsx>");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];

  const rows: Row[] = [];
  const problems: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const values = row.values as unknown[];
    const name = values[1] ? String(values[1]).trim() : "";
    const nationalIdRaw = values[2];
    const roleRaw = values[3] ? String(values[3]).trim() : "";
    const subject = values[4] ? String(values[4]).trim() : null;

    if (!name && !nationalIdRaw) return; // fully blank row

    if (!name || !nationalIdRaw || !roleRaw) {
      problems.push(`صف ${rowNumber}: بيانات ناقصة (${JSON.stringify(values)})`);
      return;
    }

    const role = ROLE_MAP[roleRaw];
    if (!role) {
      problems.push(`صف ${rowNumber}: قيمة عمل غير معروفة "${roleRaw}"`);
      return;
    }

    rows.push({ rowNumber, name, nationalId: String(nationalIdRaw).trim(), role, subject });
  });

  // detect duplicate national IDs within the file itself
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (seen.has(r.nationalId)) {
      problems.push(
        `صف ${r.rowNumber}: رقم الهوية ${r.nationalId} مكرر مع صف ${seen.get(r.nationalId)} (${r.name})`
      );
    } else {
      seen.set(r.nationalId, r.rowNumber);
    }
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: existing } = await supabase.from("users").select("national_id");
  const existingIds = new Set((existing ?? []).map((u) => u.national_id));

  const created: Row[] = [];
  const skipped: { row: Row; reason: string }[] = [];

  for (const row of rows) {
    if (existingIds.has(row.nationalId)) {
      skipped.push({ row, reason: "رقم الهوية موجود مسبقًا في قاعدة البيانات" });
      continue;
    }
    const password_hash = await bcrypt.hash(row.nationalId, 10);
    const { error } = await supabase.from("users").insert({
      national_id: row.nationalId,
      name: row.name,
      role: row.role,
      subject: row.subject,
      password_hash,
    });
    if (error) {
      skipped.push({ row, reason: error.message });
      continue;
    }
    existingIds.add(row.nationalId);
    created.push(row);
  }

  console.log(`\n=== تم إنشاء ${created.length} حساب ===`);
  for (const r of created) {
    console.log(`✓ ${r.name} | ${r.nationalId} | ${r.role} | ${r.subject ?? "-"}`);
  }

  if (skipped.length > 0) {
    console.log(`\n=== تم تجاوز ${skipped.length} صف ===`);
    for (const s of skipped) {
      console.log(`✗ صف ${s.row.rowNumber} (${s.row.name}, ${s.row.nationalId}): ${s.reason}`);
    }
  }

  if (problems.length > 0) {
    console.log(`\n=== مشاكل بالملف تحتاج مراجعة (${problems.length}) ===`);
    for (const p of problems) console.log(`! ${p}`);
  }
}

main().catch((err) => {
  console.error("فشل الاستيراد:", err);
  process.exit(1);
});
