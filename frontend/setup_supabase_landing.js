const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Create public bucket for landing uploads
  const { data: bucket, error: bucketErr } = await sb.storage.createBucket('landing', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'],
    fileSizeLimit: 10485760 // 10MB
  });
  if (bucketErr && !bucketErr.message.includes('already exists')) {
    console.error('Bucket create error:', bucketErr);
  } else {
    console.log('Bucket ready:', bucket?.name ?? 'landing (already exists)');
  }

  // Create landing_config table if not exists
  const { error: tableErr } = await sb.rpc('exec_sql', {
    sql: `
      create table if not exists public.landing_config (
        lang text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
      alter table public.landing_config enable row level security;
    `
  }).catch(() => ({ error: null }));

  // Try direct query as fallback check
  const { data: existing, error: fetchErr } = await sb.from('landing_config').select('lang');
  if (fetchErr) {
    console.log('Table may not exist yet. Will need manual creation.');
    console.log('Run this SQL in Supabase dashboard:');
    console.log(`
create table if not exists public.landing_config (
  lang text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.landing_config enable row level security;
    `);
  } else {
    console.log('landing_config table exists. Existing langs:', existing.map(r => r.lang));
  }
}
run();
