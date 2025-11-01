import {useEffect, useMemo, useState} from 'react'
import type {ChangeEvent, FormEvent} from 'react'
import './App.css'
import {useProducts} from './hooks/useProduct'
import {submitOrder} from './services/inventory'
import type {Product, Row} from './types'

type FeedbackState =
  | {status: 'idle'; message: null}
  | {status: 'success' | 'error'; message: string}

export default function App() {
  const {data: products, loading, error, refetch} = useProducts()
  const [productId, setProductId] = useState('')
  const [rowKey, setRowKey] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>({status: 'idle', message: null})
  const [refreshing, setRefreshing] = useState(false)

  const selectedProduct = useMemo<Product | undefined>(
    () => products.find((p) => p._id === productId),
    [products, productId],
  )

  const availableRows = selectedProduct?.rows ?? []

  const selectedRow = useMemo<Row | undefined>(
    () => availableRows.find((row) => row._key === rowKey),
    [availableRows, rowKey],
  )

  const currentStock = selectedRow?.stock ?? 0

  const totalFlavors = useMemo(
    () => products.reduce((count, product) => count + (product.rows?.length ?? 0), 0),
    [products],
  )

  const totalUnits = useMemo(
    () =>
      products.reduce(
        (count, product) =>
          count +
          (product.rows?.reduce(
            (accumulator, row) => accumulator + (typeof row.stock === 'number' ? row.stock : 0),
            0,
          ) ?? 0),
        0,
      ),
    [products],
  )

  const highlightRow = useMemo(() => {
    let best:
      | {
          product: Product
          row: Row
          stock: number
        }
      | null = null

    for (const product of products) {
      for (const row of product.rows ?? []) {
        const stock = typeof row.stock === 'number' ? row.stock : 0
        if (!best || stock > best.stock) {
          best = {product, row, stock}
        }
      }
    }

    return best
  }, [products])

  const projectedStock = selectedRow ? Math.max(currentStock - quantity, 0) : null
  const projectedPercentage =
    selectedRow && currentStock > 0
      ? Math.max(
          0,
          Math.min(100, Math.round(((projectedStock ?? 0) / currentStock) * 100)),
        )
      : 0

  useEffect(() => {
    if (!selectedProduct) {
      setRowKey('')
      return
    }

    const stillExists = availableRows.some((row) => row._key === rowKey)
    if (!stillExists) {
      setRowKey(availableRows[0]?._key ?? '')
    }
  }, [availableRows, rowKey, selectedProduct])

  useEffect(() => {
    setQuantity(1)
  }, [rowKey])

  useEffect(() => {
    if (feedback.status !== 'idle') {
      const timer = setTimeout(() => setFeedback({status: 'idle', message: null}), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedProduct || !selectedRow) {
      setFeedback({status: 'error', message: 'Selecione o produto e o sabor antes de enviar.'})
      return
    }

    if (quantity <= 0) {
      setFeedback({status: 'error', message: 'Informe uma quantidade maior que zero.'})
      return
    }

    if (quantity > currentStock) {
      setFeedback({
        status: 'error',
        message: `Quantidade solicitada maior que o estoque disponível (${currentStock}).`,
      })
      return
    }

    setSubmitting(true)
    try {
      const {newStock} = await submitOrder({
        productId: selectedProduct._id,
        rowKey: selectedRow._key,
        quantity,
      })
      setQuantity(1)
      setFeedback({
        status: 'success',
        message: `Pedido registrado! Estoque atualizado para ${newStock} unidade(s).`,
      })
      await refetch({silent: true})
    } catch (err: any) {
      const message =
        typeof err?.message === 'string'
          ? err.message
          : 'Falha ao registrar o pedido. Tente novamente.'
      setFeedback({status: 'error', message})

      const latestStockFromServer = Number(err?.details?.currentStock)
      if (Number.isFinite(latestStockFromServer)) {
        try {
          await refetch({silent: true})
          setQuantity((prev) => {
            const safeStock = Math.max(0, latestStockFromServer)
            if (safeStock <= 0) return 1
            return Math.min(prev, safeStock)
          })
        } catch (refreshError) {
          console.error('refetch after error failed', refreshError)
        }
      }

      console.error('submitOrder error', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleManualRefresh = async () => {
    if (refreshing) return

    setRefreshing(true)
    try {
      const result = await refetch({silent: true})
      if (result?.ok) {
        setFeedback({status: 'success', message: 'Estoque sincronizado com sucesso.'})
      } else {
        const message =
          result?.error ?? 'Não foi possível sincronizar com o Sanity agora.'
        setFeedback({status: 'error', message})
      }
    } catch (err: any) {
      const message =
        typeof err?.message === 'string'
          ? err.message
          : 'Não foi possível sincronizar com o Sanity agora.'
      setFeedback({status: 'error', message})
    } finally {
      setRefreshing(false)
    }
  }

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (Number.isFinite(value)) {
      const next = Math.max(0, Math.floor(value))
      setQuantity(next)
    }
  }

  if (loading) return <p className="status">Carregando…</p>
  if (error) return <p className="status error">Erro: {error}</p>

  return (
    <main className="app">
      <header className="hero">
        <span className="hero__badge">PEXpress</span>
        <h1>Controle inteligente de estoque</h1>
        <p>
          Tenha uma visão em tempo real dos sabores disponíveis e registre saídas sem complicação.
        </p>

        <div className="hero__metrics">
          <article className="metric-card">
            <span className="metric-card__label">Produtos ativos</span>
            <strong className="metric-card__value">{products.length}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Sabores monitorados</span>
            <strong className="metric-card__value">{totalFlavors}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Unidades em estoque</span>
            <strong className="metric-card__value">{totalUnits.toLocaleString('pt-BR')}</strong>
          </article>
        </div>

        {highlightRow && (
          <div className="hero__highlight">
            <div>
              <span className="hero__highlight-label">Maior disponibilidade</span>
              <strong>{highlightRow.row.flavor}</strong>
              <span>
                {highlightRow.stock.toLocaleString('pt-BR')} unidade(s) · {highlightRow.product.name}
              </span>
            </div>
          </div>
        )}
      </header>

      <section className="panel-grid">
        <form className="order-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Produto</span>
            <select
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value)
                setFeedback({status: 'idle', message: null})
              }}
              required
            >
              <option value="">Selecione…</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Sabor</span>
            <select
              value={rowKey}
              onChange={(event) => {
                setRowKey(event.target.value)
                setFeedback({status: 'idle', message: null})
              }}
              disabled={!selectedProduct}
              required
            >
              <option value="">Selecione…</option>
              {availableRows.map((row) => (
                <option key={row._key} value={row._key}>
                  {row.flavor}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Quantidade</span>
            <input
              type="number"
              min={1}
              max={currentStock}
              step={1}
              inputMode="numeric"
              value={quantity}
              onChange={handleQuantityChange}
              disabled={!selectedRow || currentStock === 0 || submitting}
            />
          </label>

          <p className="stock-indicator">
            Estoque disponível:{' '}
            <strong>{selectedRow ? `${currentStock} unidade(s)` : 'Selecione um sabor'}</strong>
          </p>

          <button
            type="submit"
            className="primary-button"
            disabled={
              !selectedRow ||
              currentStock === 0 ||
              quantity <= 0 ||
              quantity > currentStock ||
              submitting
            }
          >
            {submitting ? 'Enviando…' : 'Registrar pedido'}
          </button>

          {feedback.status !== 'idle' && feedback.message && (
            <p className={`feedback ${feedback.status}`}>{feedback.message}</p>
          )}
        </form>

        <aside className="insight-card">
          <h2>Resumo rápido</h2>
          <p>Confirme se a retirada faz sentido antes de atualizar o Sanity.</p>

          <ul className="insight-list">
            <li>
              <span>Produto</span>
              <strong>{selectedProduct ? selectedProduct.name : 'Selecione um produto'}</strong>
            </li>
            <li>
              <span>Sabor</span>
              <strong>{selectedRow ? selectedRow.flavor : 'Selecione um sabor'}</strong>
            </li>
            <li>
              <span>Quantidade</span>
              <strong>{selectedRow ? `${quantity} unidade(s)` : '—'}</strong>
            </li>
          </ul>

          <div className="insight-progress">
            <div className="insight-progress__info">
              <span>Estoque projetado</span>
              <strong>
                {selectedRow ? `${projectedStock ?? 0} unidade(s)` : 'Aguardando seleção'}
              </strong>
            </div>
            <div className="insight-progress__track">
              <span
                className="insight-progress__fill"
                style={{width: `${projectedPercentage}%`}}
                aria-hidden
              />
            </div>
            {selectedRow && (
              <small className="insight-progress__caption">
                Antes: {currentStock} unidade(s) · Depois do pedido: {projectedStock ?? 0}
              </small>
            )}
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={handleManualRefresh}
            disabled={refreshing || submitting}
          >
            {refreshing ? 'Sincronizando…' : 'Atualizar dados agora'}
          </button>
        </aside>
      </section>

      <section className="inventory">
        <div className="inventory__header">
          <div>
            <h2>Visão geral do estoque</h2>
            <p>Acompanhe as unidades disponíveis por produto e sabor em tempo real.</p>
          </div>
          <button
            type="button"
            className="inventory__refresh"
            onClick={handleManualRefresh}
            disabled={refreshing || submitting}
          >
            {refreshing ? 'Atualizando…' : 'Sincronizar estoque'}
          </button>
        </div>

        {products.length === 0 ? (
          <p className="inventory-empty">Nenhum produto cadastrado no momento.</p>
        ) : (
          <div className="inventory-grid">
            {products.map((product) => {
              const productTotal =
                product.rows?.reduce(
                  (sum, row) => sum + (typeof row.stock === 'number' ? row.stock : 0),
                  0,
                ) ?? 0

              return (
                <article key={product._id} className="inventory-card">
                  <header className="inventory-card__header">
                    <h3>{product.name}</h3>
                    <span>{productTotal.toLocaleString('pt-BR')} unid</span>
                  </header>
                  <ul>
                    {product.rows?.map((row) => (
                      <li key={row._key}>
                        <span>{row.flavor}</span>
                        <strong>{(row.stock ?? 0).toLocaleString('pt-BR')}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
