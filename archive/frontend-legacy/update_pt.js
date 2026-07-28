const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

const sb = createClient(url, key);

async function run() {
  const { data, error } = await sb.from("landing_config").select("data").eq("lang", "pt").single();
  if (error || !data) {
    console.error("Error fetching config:", error);
    return;
  }
  
  const cfg = data.data;

  // Change title / text mentioning BOGA AI -> BOGASTOCK
  if (cfg.hero) {
    cfg.hero.description = cfg.hero.description.replace(/BOGA AI/g, "BOGASTOCK");
    cfg.hero.description_bold = cfg.hero.description_bold.replace(/BOGA AI/g, "BOGASTOCK");
  }
  
  // Remove Top100 and add the new one
  if (cfg.features) {
    cfg.features = cfg.features.map(f => {
      if (f.title.includes("Top 100") || f.title.includes("Top100")) {
        return {
          icon: "bolt",
          title: "Foco Otimizado",
          desc: "Você tomará decisões mais fáceis com menos ações. Filtramos os ruídos para trazer apenas as melhores oportunidades."
        };
      }
      return f;
    });
  }

  // Update screenshots with the new uploaded image
  // The user attached one file containing all 4 screenshots or just one screenshot. 
  // We'll point the first screenshot to the new file, and we can keep others or remove them if it's a collage.
  // Actually, I'll point all to the same image for now or just have 1 screenshot.
  cfg.screenshots = [
    {
      src: "/screenshots/pt_new.png",
      label: "BOGASTOCK Dashboard",
      desc: "Análise e seleção avançada"
    }
  ];

  const { error: upsertError } = await sb.from("landing_config").upsert(
    { lang: "pt", data: cfg, updated_at: new Date().toISOString() },
    { onConflict: "lang" }
  );
  if (upsertError) console.error("Update error:", upsertError);
  else console.log("PT Config Updated successfully");
}

run();
