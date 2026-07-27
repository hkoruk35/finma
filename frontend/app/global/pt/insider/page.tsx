import { Metadata } from "next";
import { getTopInsiderBuyers } from "@/lib/insider-data";
import { copy, Locale } from "@/lib/i18n/copy";
import InsiderTransactionGrid from "@/components/public/InsiderTransactionGrid";

export const metadata: Metadata = {
  title: "Atividade de Transações de Insiders | BOGASTOCK",
  description: "Apresentações do Formulário 4 da SEC - Rastreamento de transações de insiders.",
};

export const revalidate = 3600;

export default async function InsiderPage() {
  const locale: Locale = "pt";
  const t = copy[locale];
  const insiderT = t.insider || {};

  const topBuyers = await getTopInsiderBuyers(30, 50);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{insiderT.title || "Atividade de Transações de Insiders"}</h1>
          <p className="text-slate-400 text-lg">{insiderT.subtitle || "Apresentações do Formulário 4 da SEC - Últimos 90 Dias"}</p>
          <p className="text-slate-500 text-sm mt-4">
            Acompanhe as transações de executivos e insiders. Os dados são atualizados diariamente a partir da SEC EDGAR.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {topBuyers.length === 0 ? (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-8 text-center">
            <p className="text-slate-400">{insiderT.noData || "Nenhuma transação encontrada"}</p>
          </div>
        ) : (
          <InsiderTransactionGrid data={topBuyers} locale={locale} />
        )}
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 border-t border-slate-800/50">
        <div className="space-y-2">
          <p>
            <strong>Fonte de Dados:</strong> {insiderT.dataSource || "Apresentações do Formulário 4 da SEC EDGAR"}
          </p>
          <p>
            <strong>Frequência de Atualização:</strong> Diária, processada após o fechamento do mercado.
          </p>
          <p>
            <strong>Limite Mínimo:</strong> Apenas transações com 1.000+ ações são exibidas.
          </p>
          <p>
            <strong>Isenção de Responsabilidade:</strong> Esta informação é fornecida apenas para fins educacionais. Não é uma recomendação de investimento.
          </p>
        </div>
      </div>
    </main>
  );
}
