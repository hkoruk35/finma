import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * `next build` sirasinda mi calisiyoruz?
 *
 * Next.js build'i baslatirken process.env.NEXT_PHASE'i PHASE_PRODUCTION_BUILD
 * olarak set eder (node_modules/next/dist/build/index.js).
 *
 * Neden gerekli: veri cekme hatalarinda BILEREK throw eden yerler var
 * (bkz. 1fe9fb2a) — calisma aninda firlatmak dogru, cunku ISR o sayfanin
 * onceki basarili render'ini korur ve ziyaretci bos sayfa gormez. Ama AYNI
 * throw build sirasinda olumcul: geri donulecek bir onceki render yok,
 * "Export encountered an error" ile tum deploy patlar. 2026-08-10'daki
 * Supabase kesintisinde tam olarak bu oldu.
 *
 * Bu yuzden: build'de bos veriye duserek deploy'un tamamlanmasina izin ver,
 * calisma aninda firlatarak ISR cache'ini koru.
 */
export function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
}
