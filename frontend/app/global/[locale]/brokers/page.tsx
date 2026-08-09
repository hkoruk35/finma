import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Locale } from "@/lib/i18n/copy";
import { INDEX_LOCALES } from "@/lib/indices";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  return INDEX_LOCALES.map((locale) => ({ locale }));
}

interface Broker {
  id: string;
  category: "stock" | "fx" | "crypto";
  name: string;
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
}

async function getBrokers(): Promise<Broker[]> {
  const { data } = await supabaseAdmin
    .from("broker_directory")
    .select("id, category, name, website_url, logo_url, description")
    .eq("enabled", true)
    .order("category")
    .order("sort_order");
  return data ?? [];
}

const T: Record<Locale, { title: string; subtitle: string; sections: Record<string, string>; riskTitle: string; risk: string; noLogo: string }> = {
  tr: {
    title: "Brokers",
    subtitle: "Hisse, döviz ve kripto işlemleri için tanınmış aracı kurumlara genel bakış.",
    sections: { stock: "Stock Brokers", fx: "FX Brokers", crypto: "Kripto Brokers" },
    riskTitle: "Risk Uyarısı",
    risk:
      "Bu sayfa yalnızca bilgilendirme amaçlıdır ve yatırım tavsiyesi niteliği taşımaz. Kaldıraçlı ürünler (CFD, forex, opsiyon vb.) dahil finansal işlemler, yatırdığınız sermayenin tamamını veya bir kısmını kaybetme riski içerir. Fiyatlar oynak olabilir ve geçmiş performans gelecekteki sonuçların garantisi değildir. Herhangi bir aracı kurumla hesap açmadan önce kendi araştırmanızı yapın, ücret/komisyon yapısını, düzenleyici lisanslarını ve kullanıcı sözleşmelerini dikkatlice inceleyin. BogaStock, listelenen aracı kurumların hiçbiriyle bağlı değildir ve onların hizmetlerinden sorumlu tutulamaz.",
    noLogo: "Logo eklenmedi",
  },
  en: {
    title: "Brokers",
    subtitle: "An overview of well-known brokers for stock, forex and crypto trading.",
    sections: { stock: "Stock Brokers", fx: "FX Brokers", crypto: "Crypto Brokers" },
    riskTitle: "Risk Warning",
    risk:
      "This page is for informational purposes only and does not constitute investment advice. Financial trading — including leveraged products such as CFDs, forex and options — carries a risk of losing some or all of your invested capital. Prices can be volatile and past performance is not a guarantee of future results. Before opening an account with any broker, do your own research and carefully review their fee structure, regulatory licenses, and user agreements. BogaStock is not affiliated with any of the listed brokers and is not responsible for their services.",
    noLogo: "No logo yet",
  },
  es: {
    title: "Brokers",
    subtitle: "Un resumen de brokers reconocidos para operar acciones, divisas y criptomonedas.",
    sections: { stock: "Brokers de Acciones", fx: "Brokers de Divisas", crypto: "Brokers de Cripto" },
    riskTitle: "Advertencia de Riesgo",
    risk:
      "Esta página es solo informativa y no constituye asesoramiento de inversión. Las operaciones financieras, incluidos productos apalancados como CFDs, forex y opciones, conllevan el riesgo de perder parte o la totalidad de tu capital invertido. Los precios pueden ser volátiles y el rendimiento pasado no garantiza resultados futuros. Antes de abrir una cuenta con cualquier broker, investiga por tu cuenta y revisa cuidadosamente su estructura de comisiones, licencias regulatorias y acuerdos de usuario. BogaStock no está afiliado con ninguno de los brokers listados y no es responsable de sus servicios.",
    noLogo: "Sin logo",
  },
  fr: {
    title: "Brokers",
    subtitle: "Un aperçu des courtiers reconnus pour le trading d'actions, de devises et de cryptomonnaies.",
    sections: { stock: "Courtiers Actions", fx: "Courtiers Forex", crypto: "Courtiers Crypto" },
    riskTitle: "Avertissement sur les Risques",
    risk:
      "Cette page est fournie à titre informatif uniquement et ne constitue pas un conseil en investissement. Le trading financier, y compris les produits à effet de levier comme les CFD, le forex et les options, comporte un risque de perte partielle ou totale du capital investi. Les prix peuvent être volatils et les performances passées ne garantissent pas les résultats futurs. Avant d'ouvrir un compte chez un courtier, faites vos propres recherches et examinez attentivement sa structure de frais, ses licences réglementaires et ses conditions d'utilisation. BogaStock n'est affilié à aucun des courtiers listés et n'est pas responsable de leurs services.",
    noLogo: "Pas encore de logo",
  },
  pt: {
    title: "Brokers",
    subtitle: "Uma visão geral de corretoras conhecidas para negociação de ações, câmbio e cripto.",
    sections: { stock: "Corretoras de Ações", fx: "Corretoras de Câmbio", crypto: "Corretoras de Cripto" },
    riskTitle: "Aviso de Risco",
    risk:
      "Esta página é apenas para fins informativos e não constitui aconselhamento de investimento. A negociação financeira, incluindo produtos alavancados como CFDs, forex e opções, envolve risco de perda parcial ou total do capital investido. Os preços podem ser voláteis e o desempenho passado não garante resultados futuros. Antes de abrir uma conta em qualquer corretora, faça sua própria pesquisa e revise cuidadosamente sua estrutura de taxas, licenças regulatórias e termos de uso. A BogaStock não é afiliada a nenhuma das corretoras listadas e não é responsável por seus serviços.",
    noLogo: "Sem logo ainda",
  },
};

export default async function BrokersPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = T[locale];
  const brokers = await getBrokers();

  const groups: { key: "stock" | "fx" | "crypto" }[] = [{ key: "stock" }, { key: "fx" }, { key: "crypto" }];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-6xl mx-auto w-full py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-slate-400">{t.subtitle}</p>
        </div>

        <div className="mb-10 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <h2 className="text-sm font-bold text-amber-400 mb-1.5">⚠️ {t.riskTitle}</h2>
          <p className="text-xs text-amber-200/80 leading-relaxed">{t.risk}</p>
        </div>

        {groups.map((g) => {
          const items = brokers.filter((b) => b.category === g.key);
          if (items.length === 0) return null;
          return (
            <section key={g.key} id={g.key} className="mb-10 scroll-mt-24">
              <h2 className="text-lg font-semibold text-white mb-4">{t.sections[g.key]}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((b) => (
                  <a
                    key={b.id}
                    href={b.website_url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="block p-5 rounded-xl border border-[#1e2a3a] bg-[#0f172a] hover:border-[#3b82f6]/60 hover:bg-[#131c2e] transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {b.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo_url} alt={b.name} className="w-8 h-8 rounded object-contain bg-white/5" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#1e2a3a] flex items-center justify-center text-[10px] text-slate-500 font-bold">
                          {b.name.charAt(0)}
                        </div>
                      )}
                      <h3 className="text-sm font-semibold text-white">{b.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400">{b.description}</p>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <Footer locale={locale} />
    </div>
  );
}
