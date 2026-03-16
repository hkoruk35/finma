/**
 * GET /api/signals/latest
 * Bot sinyallerini statik JSON dosyasından oku.
 * Bot her çalıştığında JSON güncellenir → git push → Vercel deploy → yeni veri.
 * Supabase RLS sorunu bypass edildi — veritabanı bağımlılığı yok.
 */

import signalsData from '@/data/signals-latest.json'

export async function GET() {
  return Response.json(signalsData, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
