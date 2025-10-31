import {useCallback, useEffect, useState} from 'react'
import {sanity} from '../sanityClient'
import {PRODUCTS_QUERY} from '../queries'
import type {Product} from '../types'

export function useProducts() {
  const [data, setData] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOnce = useCallback(
    async ({silent = false}: {silent?: boolean} = {}) => {
      if (!silent) setLoading(true)
      try {
        const res = await sanity.fetch<Product[]>(PRODUCTS_QUERY)
        setData(res)
        setError(null)
        return {ok: true as const}
      } catch (e: any) {
        const message = e?.message ?? 'Erro ao carregar'
        setError(message)
        return {ok: false as const, error: message}
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchOnce()

    // Atualização em tempo real (SSE). Requer dataset público p/ leitura + CORS.
    const sub = sanity.listen(PRODUCTS_QUERY).subscribe({
      next: () => fetchOnce({silent: true}),
      error: (err) => {
        console.error('listen error', err)
        // fallback simples: polling
        const id = setInterval(() => fetchOnce({silent: true}), 15000)
        return () => clearInterval(id)
      },
    })
    return () => sub.unsubscribe()
  }, [fetchOnce])

  return {
    data,
    loading,
    error,
    refetch: (options?: {silent?: boolean}) => fetchOnce(options ?? {silent: false}),
  }
}
