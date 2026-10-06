import { TeacherPerformanceView } from "@/components/admin/TeacherPerformanceView";
import { isValidPerformanceCategory } from "@/lib/teacher-performance";

export default async function TeacherPerformancePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return <TeacherPerformanceView initialCategory={category && isValidPerformanceCategory(category) ? category : undefined} />;
}
