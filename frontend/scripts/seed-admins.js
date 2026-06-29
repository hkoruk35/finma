/**
 * Tek seferlik admin ekleme/güncelleme script'i.
 * Kullanım (frontend/ klasöründen):
 *   node scripts/seed-admins.js <email> <password> [admin|readonly]
 *
 * .env.local içindeki NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_KEY kullanılır.
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  loadEnvLocal();

  const [, , email, password, roleArg] = process.argv;
  if (!email || !password) {
    console.error("Kullanım: node scripts/seed-admins.js <email> <password> [admin|readonly]");
    process.exit(1);
  }
  const role = roleArg === "readonly" ? "readonly" : "admin";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY .env.local içinde bulunamadı.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await supabase
    .from("admins")
    .upsert({ email: email.toLowerCase(), password_hash, role, created_by: "seed-script" }, { onConflict: "email" });

  if (error) {
    console.error("Hata:", error.message);
    process.exit(1);
  }
  console.log(`Tamamlandı: ${email} (${role}) admins tablosuna eklendi/güncellendi.`);
}

main();
