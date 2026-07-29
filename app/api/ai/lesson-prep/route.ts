import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { callGroq } from "@/lib/groq";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, gradeLevel, subject, duration } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  const content = await callGroq([
    {
      role: "system",
      content:
        "أنت مساعد تربوي يكتب تحضير دروس بالعربية وفق النموذج الشائع في المدارس السعودية، ويتضمن: الأهداف السلوكية، التمهيد، إجراءات الدرس مع التوقيت التقريبي لكل خطوة، أسلوب التقويم، والواجب المنزلي.",
    },
    {
      role: "user",
      content: `الموضوع: ${topic}\nالمادة: ${subject ?? "غير محدد"}\nالمرحلة/الصف: ${gradeLevel ?? "غير محدد"}\nمدة الحصة: ${duration ?? "45 دقيقة"}`,
    },
  ]);

  return NextResponse.json({ content });
}
