/**
 * ISR On-Demand Revalidation for Swing page
 * Called by Python script after updating swing_all_picks.json
 * Triggers Next.js to regenerate the /swing page cache
 */

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-revalidate-secret');

    // Simple secret check (should match Python script)
    if (secret !== process.env.REVALIDATE_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    // v3.1: candidate_pool.json / watchlist_picks.json / swing_all_picks.json
    // artık home, swing, watchlist ve performance sayfalarını besliyor —
    // hepsi her bot run'ında tazelenmeli, sadece /swing değil.
    // @ts-ignore (next/cache is real at runtime)
    const { revalidatePath } = await import('next/cache');
    const locales = ['tr', 'en', 'es', 'fr', 'pt'];
    const paths = ['/swing', '/swing/'];
    for (const locale of locales) {
      paths.push(
        `/global/${locale}/swing`,
        `/global/${locale}/watchlist`,
        `/global/${locale}/home`,
        `/global/${locale}/performance`,
        `/global/${locale}/swingperformance`
      );
    }
    for (const p of paths) {
      revalidatePath(p, 'page');
    }

    return new Response(
      JSON.stringify({
        revalidated: true,
        paths,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        revalidated: false,
        error: String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
