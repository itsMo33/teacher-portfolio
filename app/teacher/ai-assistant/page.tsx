import { AiRequestForm } from "@/components/ai/AiRequestForm";

export default function AiAssistantPage() {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4">المساعد الذكي</h2>
      <p className="text-sm text-slate-500 mb-4">
        اطلب ورقة عمل، مخطط عرض بوربوينت، أو تحضير درس، ثم راجع الناتج وانسخه أو نزّله وارفعه في القسم المناسب من ملف الإنجاز.
      </p>
      <AiRequestForm />
    </div>
  );
}
