import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { callGroq } from "@/lib/groq";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, gradeLevel, subject } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  const content = await callGroq([
    {
      role: "system",
      content:
        "أنت مساعد تربوي يكتب أوراق عمل مدرسية باللغة العربية الفصحى. أنشئ ورقة عمل قابلة للطباعة تتضمن: عنوانًا، تعليمات واضحة، من 8 إلى 10 أسئلة متنوعة (اختيار من متعدد، إجابة قصيرة، إكمال فراغ)، ثم نموذج إجابة في نهاية الورقة تحت عنوان 'نموذج الإجابة'.",
    },
    {
      role: "user",
      content: `الموضوع: ${topic}\nالمادة: ${subject ?? "غير محدد"}\nالمرحلة/الصف: ${gradeLevel ?? "غير محدد"}`,
    },
  ]);

  return NextResponse.json({ content });
}
