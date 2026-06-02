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

    // Revalidate both /swing and /swing/ paths
    // @ts-ignore (next/cache is real at runtime)
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/swing', 'page');
    revalidatePath('/swing/', 'page');

    return new Response(
      JSON.stringify({
        revalidated: true,
        paths: ['/swing', '/swing/'],
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
