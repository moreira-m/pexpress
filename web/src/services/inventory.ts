import {sanity} from '../sanityClient'
import type {Product, Row} from '../types'

type OrderInput = {
  productId: Product['_id']
  rowKey: Row['_key']
  quantity: number
}

const SINGLE_ROW_QUERY = `*[_type=="product" && _id==$productId][0]{
  _id,
  name,
  'row': rows[_key==$rowKey][0]{
    _key,
    flavor,
    stock
  }
}`

const DEFAULT_FUNCTION_BASE = 'https://pexpress-netlify.netlify.app'
const FUNCTION_BASE =
  (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  DEFAULT_FUNCTION_BASE
const UPDATE_STOCK_ENDPOINT = `${FUNCTION_BASE}/.netlify/functions/update-stock`

export async function submitOrder({productId, rowKey, quantity}: OrderInput) {
  if (quantity <= 0) throw new Error('Informe uma quantidade maior que zero')

  type RowDocument = Pick<Row, '_key' | 'flavor'> & {stock?: number | null}

  const product = await sanity.fetch<{
    _id: string
    name: string
    row?: RowDocument | null
  } | null>(SINGLE_ROW_QUERY, {productId, rowKey})

  const row = product?.row ?? null
  if (!product || !row) throw new Error('Produto ou sabor não encontrado')

  const current = typeof row.stock === 'number' ? row.stock : 0
  if (!Number.isFinite(current)) throw new Error('Estoque inválido recebido do servidor')
  if (quantity > current) {
    throw new Error(
      `Estoque insuficiente. Disponível: ${current}, solicitado: ${quantity}`
    )
  }

  const response = await fetch(UPDATE_STOCK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      rowKey,
      quantity,
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const payload = await response.json()
      detail = payload?.error ?? ''
    } catch {
      // ignore JSON parsing failure, keep generic message
    }
    const reason = detail || `status ${response.status}`
    throw new Error(`Falha ao atualizar estoque (${reason}).`)
  }

  const payload = (await response.json()) as {newStock: number}
  if (typeof payload?.newStock !== 'number') {
    throw new Error('Resposta inesperada do servidor')
  }

  return {newStock: payload.newStock}
}
