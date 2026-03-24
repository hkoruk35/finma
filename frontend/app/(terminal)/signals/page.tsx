'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Eski /signals sayfası — /finma514'e yönlendirildi */
export default function SignalsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/finma514') }, [router])
  return (
    <div className="flex items-center justify-center h-48">
      <p className="text-sm text-finma-text-dim">Yönlendiriliyor...</p>
    </div>
  )
}
