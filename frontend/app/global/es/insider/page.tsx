import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Actividad de Operaciones de Iniciados | BOGASTOCK",
  description: "Presentaciones del Formulario 4 de la SEC - Seguimiento de operaciones de iniciados.",
};

export default function InsiderPage() {
  const topBuyers = [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{insiderT.title || "Actividad de Operaciones de Iniciados"}</h1>
          <p className="text-slate-400 text-lg">{insiderT.subtitle || "Presentaciones del Formulario 4 de la SEC - Últimos 90 Días"}</p>
          <p className="text-slate-500 text-sm mt-4">
            Sigue las transacciones de ejecutivos e iniciados. Los datos se actualizan diariamente desde SEC EDGAR.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {topBuyers.length === 0 ? (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-8 text-center">
            <p className="text-slate-400">{insiderT.noData || "No hay operaciones de iniciados"}</p>
          </div>
        ) : (
          <InsiderTransactionGrid data={topBuyers} locale={locale} />
        )}
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 border-t border-slate-800/50">
        <div className="space-y-2">
          <p>
            <strong>Fuente de Datos:</strong> {insiderT.dataSource || "Presentaciones del Formulario 4 de la SEC EDGAR"}
          </p>
          <p>
            <strong>Frecuencia de Actualización:</strong> Diaria, procesada después del cierre del mercado.
          </p>
          <p>
            <strong>Umbral Mínimo:</strong> Se muestran operaciones con 1.000+ acciones.
          </p>
          <p>
            <strong>Descargo de Responsabilidad:</strong> Esta información es solo para fines educativos. No es asesoramiento de inversión.
          </p>
        </div>
      </div>
    </main>
  );
}
