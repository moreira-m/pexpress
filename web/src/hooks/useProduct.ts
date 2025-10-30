import {useEffect, useState} from 'react'
import {sanity} from '../sanityClient'
import {PRODUCTS_QUERY} from '../queries'
import type {Product} from '../types'

export function useProducts() {
  const [data, setData] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchOnce() {
    try {
      const res = await sanity.fetch<Product[]>(PRODUCTS_QUERY)
      setData(res)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOnce()

    // Atualização em tempo real (SSE). Requer dataset público p/ leitura + CORS.
    const sub = sanity.listen(PRODUCTS_QUERY).subscribe({
      next: () => fetchOnce(),
      error: (err) => {
        console.error('listen error', err)
        // fallback simples: polling
        const id = setInterval(fetchOnce, 15000)
        return () => clearInterval(id)
      },
    })
    return () => sub.unsubscribe()
  }, [])

  return {data, loading, error}
}
