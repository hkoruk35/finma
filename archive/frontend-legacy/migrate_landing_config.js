const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Check if landing_config table exists by trying to select
  const { data, error } = await sb.from('landing_config').select('lang').limit(1);
  if (error) {
    console.log('Table does not exist. Please create it in Supabase SQL editor:');
    console.log(`
-- Run this in Supabase SQL Editor:
create table if not exists public.landing_config (
  lang text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.landing_config enable row level security;
-- Admin service-role has full access; no anon policy needed
    `);
    return;
  }
  
  console.log('Table exists! Current rows:', data);

  // Migrate existing landing-config.json to DB
  const configPath = path.join(__dirname, 'landing-config.json');
  let localConfig = {};
  try {
    localConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    console.log('Could not read landing-config.json');
    return;
  }

  for (const [lang, cfg] of Object.entries(localConfig)) {
    const { error: upsertErr } = await sb.from('landing_config').upsert({ lang, data: cfg, updated_at: new Date().toISOString() }, { onConflict: 'lang' });
    if (upsertErr) {
      console.error(`Error upserting ${lang}:`, upsertErr);
    } else {
      console.log(`Migrated lang: ${lang}`);
    }
  }
  console.log('Migration complete!');
}
run();
