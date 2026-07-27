import { Metadata } from "next";
import { getTopInsiderBuyers } from "@/lib/insider-data";
import { copy, Locale } from "@/lib/i18n/copy";
import InsiderTransactionGrid from "@/components/public/InsiderTransactionGrid";

export const metadata: Metadata = {
  title: "İçeriden Kişi İşlemleri | BOGASTOCK",
  description: "SEC Form 4 dosyaları - İçeriden kişi işlemleri izleme.",
};

export const revalidate = 3600;

export default async function InsiderPage() {
  const locale: Locale = "tr";
  const t = copy[locale];
  const insiderT = t.insider || {};

  const topBuyers = await getTopInsiderBuyers(30, 50);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{insiderT.title || "İçeriden Kişi İşlemleri"}</h1>
          <p className="text-slate-400 text-lg">{insiderT.subtitle || "SEC Form 4 Dosyaları - Son 90 Gün"}</p>
          <p className="text-slate-500 text-sm mt-4">
            Yönetici ve içeriden kişi işlemlerini takip edin. Veriler günlük olarak SEC EDGAR'dan güncellenir.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {topBuyers.length === 0 ? (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-8 text-center">
            <p className="text-slate-400">{insiderT.noData || "İşlem bulunamadı"}</p>
          </div>
        ) : (
          <InsiderTransactionGrid data={topBuyers} locale={locale} />
        )}
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 border-t border-slate-800/50">
        <div className="space-y-2">
          <p>
            <strong>Veri Kaynağı:</strong> {insiderT.dataSource || "SEC EDGAR Form 4 Dosyaları"}
          </p>
          <p>
            <strong>Güncelleme Sıklığı:</strong> Günlük, pazar kapanışından sonra işlenir.
          </p>
          <p>
            <strong>Minimum Eşik:</strong> 1.000+ hisse ile işlemler gösterilir.
          </p>
          <p>
            <strong>Sorumluluk Reddi:</strong> Bu bilgiler yalnızca eğitim amaçlıdır. Yatırım tavsiyesi değildir.
          </p>
        </div>
      </div>
    </main>
  );
}
