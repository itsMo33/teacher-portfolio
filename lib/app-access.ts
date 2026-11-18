/** The accounts that get the "install as an app" features (the install prompt, the manifest and notifications).
 *  Everyone else uses the plain website. To give another account the app, add its national id here. */
const APP_NATIONAL_IDS = new Set<string>([
  "1014752230", // مؤيد القريني
]);

export function canUseApp(user: { nationalId?: string | null } | null | undefined): boolean {
  return !!user?.nationalId && APP_NATIONAL_IDS.has(user.nationalId);
}
