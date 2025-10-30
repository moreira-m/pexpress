import {useProducts} from './hooks/useProduct'
import type {Product} from './types'

export default function App() {
  const {data, loading, error} = useProducts()
  if (loading) return <p>Carregando…</p>
  if (error)   return <p>Erro: {error}</p>

  return (
    <main style={{padding: 16}}>
      <h1>Estoque</h1>
      {data.map((p: Product) => (
        <section key={p._id} style={{marginBottom: 24}}>
          <h2>{p.name}</h2>
          <ul>
            {p.rows?.map(r => (
              <li key={r._key}>{r.flavor} — {r.stock ?? 0}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
