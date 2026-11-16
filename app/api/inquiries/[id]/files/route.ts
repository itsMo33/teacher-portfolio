import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { getInquiry, getInquiryRole, isRecipientOf } from "@/lib/inquiries";
import { addInquiryFile, deleteInquiryFile, listInquiryFiles, listInquiryFilesWithUrls, MAX_INQUIRY_FILES } from "@/lib/inquiry-files";

/** Who may see the attached files: the recipient (their own) and the reviewers / uploader (all). */
async function load(id: string) {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const inquiry = await getInquiry(id);
  if (!inquiry) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const role = getInquiryRole(session.user);
  const recipient = isRecipientOf(session.user.id, inquiry);
  if (!recipient && role !== "reviewer" && role !== "officer") return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return { session, inquiry, recipient, reviewer: role === "reviewer" || role === "officer" } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await load(id);
  if ("error" in ctx) return ctx.error;
  try {
    return NextResponse.json({ files: await listInquiryFilesWithUrls(id), canEdit: ctx.recipient && !ctx.inquiry.decidedAt });
  } catch {
    return NextResponse.json({ files: [], canEdit: false });
  }
}

/** The recipient records a file they uploaded straight to storage (see ./upload-url). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await load(id);
  if ("error" in ctx) return ctx.error;
  if (!ctx.recipient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (ctx.inquiry.decidedAt) return NextResponse.json({ error: "تم البت في المسائلة ولا يمكن إضافة مرفقات" }, { status: 409 });

  const { filePath, fileName, mimeType } = await req.json();
  if (typeof filePath !== "string" || !filePath.startsWith(`inquiries/files/${id}/`) || filePath.includes("..") || typeof fileName !== "string") {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  if ((await listInquiryFiles(id)).length >= MAX_INQUIRY_FILES) {
    return NextResponse.json({ error: `الحد الأقصى ${MAX_INQUIRY_FILES} ملفات` }, { status: 400 });
  }
  const error = await addInquiryFile({ inquiryId: id, filePath, fileName, mimeType: String(mimeType ?? ""), uploadedBy: ctx.session.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** The recipient takes back one of their files while the inquiry is undecided; the reviewers can remove any. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await load(id);
  if ("error" in ctx) return ctx.error;
  if (ctx.recipient && !ctx.reviewer && ctx.inquiry.decidedAt) return NextResponse.json({ error: "تم البت في المسائلة" }, { status: 409 });

  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  const ok = await deleteInquiryFile(id, fileId);
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
