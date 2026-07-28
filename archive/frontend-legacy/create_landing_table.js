const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];

function request(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Execute SQL via Management API
  const sql = `
    create table if not exists public.landing_config (
      lang text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );
    alter table public.landing_config enable row level security;
  `;

  console.log('Creating landing_config table via management API...');
  const createRes = await request('POST', 
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    { query: sql }
  );
  console.log('Create table response:', createRes.status, JSON.stringify(createRes.body).slice(0, 200));

  // Now migrate config
  const configPath = path.join(__dirname, 'landing-config.json');
  const localConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  for (const [lang, cfg] of Object.entries(localConfig)) {
    const upsertRes = await request('POST',
      `${SUPABASE_URL}/rest/v1/landing_config`,
      { lang, data: cfg, updated_at: new Date().toISOString() }
    );
    
    if (upsertRes.status >= 400) {
      // Try upsert
      const upsertRes2 = await request('POST',
        `${SUPABASE_URL}/rest/v1/landing_config`,
        { lang, data: cfg, updated_at: new Date().toISOString() }
      );
      console.log(`Lang ${lang}:`, upsertRes2.status);
    } else {
      console.log(`Inserted lang: ${lang} (status ${upsertRes.status})`);
    }
  }
}
run().catch(console.error);
