const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: trData } = await supabase.from('x_posts').select('id, status, posted_at, content_text').eq('locale', 'tr').eq('status', 'posted').order('posted_at', { ascending: false }).limit(5);
  
  console.log("TR Posted Data:", JSON.stringify(trData, null, 2));
}
run();
