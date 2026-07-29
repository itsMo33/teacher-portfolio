import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const names = new Set((buckets ?? []).map((b) => b.name));

  if (!names.has("portfolio-files")) {
    const { error: e1 } = await supabase.storage.createBucket("portfolio-files", { public: false });
    if (e1) throw e1;
    console.log("Created bucket: portfolio-files");
  } else {
    console.log("Bucket already exists: portfolio-files");
  }

  if (!names.has("schedules")) {
    const { error: e2 } = await supabase.storage.createBucket("schedules", { public: false });
    if (e2) throw e2;
    console.log("Created bucket: schedules");
  } else {
    console.log("Bucket already exists: schedules");
  }
}

main().catch((err) => {
  console.error("Failed to ensure buckets:", err);
  process.exit(1);
});
