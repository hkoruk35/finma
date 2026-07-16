require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrAlterRegion() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE members ADD COLUMN IF NOT EXISTS region text;"
  });

  if (error) {
    console.error("RPC failed, trying raw insert to test:");
    const { error: err2 } = await supabase.from('members').insert({
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test_region@example.com',
      region: 'US'
    }).select();
    
    if (err2 && err2.code === 'PGRST204') {
      console.log("Column 'region' does NOT exist.");
    } else {
      console.log("Column 'region' might exist or error:", err2);
      // clean up
      await supabase.from('members').delete().eq('id', '00000000-0000-0000-0000-000000000000');
    }
  } else {
    console.log("Successfully added column via RPC (or it existed).");
  }
}

checkOrAlterRegion();
