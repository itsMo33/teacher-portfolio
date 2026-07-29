import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth/auth-options";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createUser } from "@/lib/account";

interface ParsedRow {
  name: string;
  nationalId: string;
}

function findColumnIndexes(headerRow: string[]): { nameIdx: number; idIdx: number } {
  const nameIdx = headerRow.findIndex((h) => /اسم|name/i.test(h));
  const idIdx = headerRow.findIndex((h) => /هوي|national|id/i.test(h));
  return {
    nameIdx: nameIdx >= 0 ? nameIdx : 0,
    idIdx: idIdx >= 0 ? idIdx : 1,
  };
}

async function parseXlsx(buffer: Buffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values = (row.values as unknown[]).slice(1).map((v) => (v == null ? "" : String(v).trim()));
    rows.push(values);
  });

  if (rows.length === 0) return [];

  const { nameIdx, idIdx } = findColumnIndexes(rows[0]);
  const isHeaderRow = /اسم|name|هوي|national|id/i.test(rows[0].join(" "));
  const dataRows = isHeaderRow ? rows.slice(1) : rows;

  return dataRows
    .map((r) => ({ name: r[nameIdx] ?? "", nationalId: r[idIdx] ?? "" }))
    .filter((r) => r.name && r.nationalId);
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const rows = lines.map((line) => line.split(",").map((c) => c.trim()));
  const { nameIdx, idIdx } = findColumnIndexes(rows[0]);
  const isHeaderRow = /اسم|name|هوي|national|id/i.test(rows[0].join(" "));
  const dataRows = isHeaderRow ? rows.slice(1) : rows;

  return dataRows
    .map((r) => ({ name: r[nameIdx] ?? "", nationalId: r[idIdx] ?? "" }))
    .filter((r) => r.name && r.nationalId);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  let rows: ParsedRow[];
  try {
    rows = isCsv ? parseCsv(buffer.toString("utf-8")) : await parseXlsx(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: `تعذّر قراءة الملف: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "لم يتم العثور على بيانات صالحة في الملف" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from("users").select("national_id");
  const existingIds = new Set((existing ?? []).map((u) => u.national_id));

  const created: ParsedRow[] = [];
  const skipped: { row: ParsedRow; reason: string }[] = [];

  for (const row of rows) {
    if (existingIds.has(row.nationalId)) {
      skipped.push({ row, reason: "رقم الهوية موجود مسبقًا" });
      continue;
    }
    try {
      await createUser({ nationalId: row.nationalId, name: row.name, role: "teacher" });
      existingIds.add(row.nationalId);
      created.push(row);
    } catch (err) {
      skipped.push({ row, reason: err instanceof Error ? err.message : "خطأ غير معروف" });
    }
  }

  return NextResponse.json({ created, skipped });
}
