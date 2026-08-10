const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('x_posts')
    .select('id, locale, status, posted_at, content_text')
    .order('posted_at', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
