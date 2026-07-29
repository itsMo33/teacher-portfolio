import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-options";
import { callGroq } from "@/lib/groq";

interface Slide {
  title: string;
  bullets: string[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, gradeLevel, subject, slideCount } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  const count = slideCount ?? 8;

  const raw = await callGroq(
    [
      {
        role: "system",
        content: `أنت مساعد تربوي يبني مخطط عرض بوربوينت باللغة العربية. أعد الرد بصيغة JSON فقط بالشكل التالي، بدون أي نص إضافي: {"slides": [{"title": "...", "bullets": ["...", "..."]}]}. اجعل عدد الشرائح حوالي ${count}.`,
      },
      {
        role: "user",
        content: `الموضوع: ${topic}\nالمادة: ${subject ?? "غير محدد"}\nالمرحلة/الصف: ${gradeLevel ?? "غير محدد"}`,
      },
    ],
    true
  );

  let slides: Slide[];
  try {
    const parsed = JSON.parse(raw);
    slides = parsed.slides ?? [];
  } catch {
    slides = [{ title: topic, bullets: [raw] }];
  }

  return NextResponse.json({ slides });
}
