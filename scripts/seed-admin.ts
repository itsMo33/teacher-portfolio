/**
 * Creates the first manager account. Run once after applying supabase/schema.sql:
 *   npm run seed:admin -- --nationalId=1234567890 --password=ChangeMe123 --name="اسم المدير"
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

function getArg(name: string, fallback?: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  const value = found ? found.slice(prefix.length) : fallback;
  if (!value) {
    throw new Error(`Missing required argument --${name}`);
  }
  return value;
}

async function main() {
  const nationalId = getArg("nationalId");
  const password = getArg("password", nationalId);
  const name = getArg("name");
  const role = getArg("role", "manager");

  if (role !== "manager" && role !== "agent" && role !== "teacher") {
    throw new Error(`Invalid role: ${role}`);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert({ national_id: nationalId, password_hash, role, name })
    .select("id, national_id, role, name")
    .single();

  if (error) {
    throw error;
  }

  console.log("تم إنشاء الحساب بنجاح:", data);
}

main().catch((err) => {
  console.error("فشل إنشاء الحساب:", err);
  process.exit(1);
});
