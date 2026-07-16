require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const sb = createClient(url, key);

const raw = fs.readFileSync('landing-config.json', 'utf-8');
const config = JSON.parse(raw);

async function sync() {
  for (const lang of Object.keys(config)) {
    const { error } = await sb.from("landing_config").upsert(
      { lang, data: config[lang], updated_at: new Date().toISOString() },
      { onConflict: "lang" }
    );
    if (error) {
      console.error(`Error syncing ${lang}:`, error);
    } else {
      console.log(`Successfully synced ${lang}`);
    }
  }
}
sync();
