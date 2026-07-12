const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: bucket, error: bucketErr } = await sb.storage.createBucket('x-posts', {
    public: true,
    allowedMimeTypes: ['image/png'],
    fileSizeLimit: 5242880, // 5MB
  });
  if (bucketErr && !bucketErr.message.includes('already exists')) {
    console.error('Bucket create error:', bucketErr);
    process.exit(1);
  } else {
    console.log('Bucket ready:', bucket?.name ?? 'x-posts (already exists)');
  }
}
run();
