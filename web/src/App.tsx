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
      console.error('submitOrder error', err)
    } finally {
      setSubmitting(false)
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
      <header>
        <h1>Controle de estoque</h1>
        <p>Selecione um produto, escolha o sabor e informe a quantidade retirada.</p>
      </header>

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
          disabled={
            !selectedRow || currentStock === 0 || quantity <= 0 || quantity > currentStock || submitting
          }
        >
          {submitting ? 'Enviando…' : 'Registrar pedido'}
        </button>
      </form>

      {feedback.status !== 'idle' && feedback.message && (
        <p className={`feedback ${feedback.status}`}>{feedback.message}</p>
      )}

      <section className="inventory">
        <h2>Visão geral do estoque</h2>
        {products.map((product) => (
          <article key={product._id} className="inventory-card">
            <h3>{product.name}</h3>
            <ul>
              {product.rows?.map((row) => (
                <li key={row._key}>
                  <span>{row.flavor}</span>
                  <strong>{row.stock ?? 0}</strong>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  )
}
