"use client";

import { useState, type FormEvent } from "react";

type RequestType = "worksheet" | "ppt-outline" | "lesson-prep";

interface Slide {
  title: string;
  bullets: string[];
}

const TYPE_LABELS: Record<RequestType, string> = {
  worksheet: "ورقة عمل",
  "ppt-outline": "مخطط بوربوينت",
  "lesson-prep": "تحضير درس",
};

export function AiRequestForm() {
  const [type, setType] = useState<RequestType>("worksheet");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textResult, setTextResult] = useState<string | null>(null);
  const [slides, setSlides] = useState<Slide[] | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTextResult(null);
    setSlides(null);

    const res = await fetch(`/api/ai/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, subject, gradeLevel }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "حدث خطأ أثناء التوليد");
      return;
    }

    const data = await res.json();
    if (type === "ppt-outline") {
      setSlides(data.slides);
    } else {
      setTextResult(data.content);
    }
  }

  function copyResult() {
    const text = textResult ?? JSON.stringify(slides, null, 2);
    navigator.clipboard.writeText(text ?? "");
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          {(Object.keys(TYPE_LABELS) as RequestType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                type === t
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <input
          required
          placeholder="الموضوع (مثال: الكسور العشرية)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <input
            placeholder="المادة"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
          <input
            placeholder="الصف/المرحلة"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5"
        >
          {loading ? "جارٍ التوليد..." : "توليد"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {(textResult || slides) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex justify-end mb-2">
            <button onClick={copyResult} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              نسخ
            </button>
          </div>

          {textResult && (
            <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100 font-sans">
              {textResult}
            </pre>
          )}

          {slides && (
            <div className="flex flex-col gap-3">
              {slides.map((slide, i) => (
                <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-50 mb-1">
                    {i + 1}. {slide.title}
                  </h4>
                  <ul className="list-disc pr-5 text-sm text-slate-600 dark:text-slate-300">
                    {slide.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
