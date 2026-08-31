const MESSAGES = [
  "يلا ارفعه! 💪",
  "خطوة وتخلص! ✨",
  "جهّزه الآن 📎",
  "نتحمس لك! 🌟",
  "سجّله وكن مثال 🚀",
  "قسم ينتظرك 🙌",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Picks a short encouraging message, stable per seed (e.g. a section/subsection key) so it doesn't flicker between renders. */
export function getEncouragingMessage(seed: string): string {
  return MESSAGES[hashString(seed) % MESSAGES.length];
}

export const TROPHY_BADGE = "🏆 مكتمل";
