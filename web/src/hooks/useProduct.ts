import {useEffect, useState} from 'react'
import {sanity} from '../sanityClient'
import {PRODUCTS_QUERY} from '../queries'
import type {Product} from '../types'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  async function fetchOnce() {
    try {
      const res = await sanity.fetch<Product[]>(PRODUCTS_QUERY)
      setProducts(res)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOnce()
    const sub = sanity.listen(PRODUCTS_QUERY).subscribe({
      next: () => fetchOnce(),
      error: (err) => console.error('listen error', err),
    })
    return () => sub.unsubscribe()
  }, [])

  return {products, loading, error}
}
