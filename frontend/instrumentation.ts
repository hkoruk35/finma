/** Üretim sunucusu açılışı: SPY gamma gözlem kaydını başlatır. Yerel geliştirme ve build bu kayda yazmaz. */
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs"
    || process.env.NODE_ENV !== "production"
    || process.platform !== "linux"
    || process.env.NEXT_PHASE === "phase-production-build"
  ) return;
  const { startGexScheduler } = await import("./lib/spyengine/gexScheduler");
  startGexScheduler();
}
