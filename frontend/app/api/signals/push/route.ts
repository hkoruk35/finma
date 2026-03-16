/**
 * POST /api/signals/push
 * Bot sinyallerini kabul et.
 *
 * NOT: Ana güncelleme yöntemi artık push_to_finma.py → git push → Vercel deploy.
 * Bu endpoint artık sadece bilgi amaçlı — Vercel serverless read-only filesystem.
 * Bot doğrudan JSON dosyasını günceller ve git push yapar.
 */

const BOT_API_KEY = process.env.BOT_API_KEY || 'finma-bot-2026'

export async function POST(request: Request) {
  const apiKey = request.headers.get('X-Api-Key')
  if (apiKey !== BOT_API_KEY) {
    return Response.json({ error: 'Gecersiz API anahtari' }, { status: 401 })
  }

  try {
    const payload = await request.json()
    const count = (payload.candidates || []).length

    return Response.json({
      status: 'info',
      message: 'Push endpoint artik kullanilmiyor. Bot push_to_finma.py ile JSON dosyasini guncelleyip git push yapmali.',
      count,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
