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

function resolveUpdateStockEndpoint() {
  const envValue = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined)?.trim()
  if (envValue && envValue.length > 0) {
    const sanitized = envValue.replace(/\/$/, '')
    if (sanitized.endsWith('/update-stock')) return sanitized
    if (sanitized.endsWith('/.netlify/functions')) {
      return `${sanitized}/update-stock`
    }
    if (sanitized.includes('/.netlify/functions/')) {
      return sanitized
    }
    return `${sanitized}/.netlify/functions/update-stock`
  }

  if (typeof window !== 'undefined') {
    try {
      const currentUrl = new URL(window.location.href)
      const origin = currentUrl.origin.replace(/\/$/, '')
      const host = currentUrl.hostname

      const isLocalhost = host === 'localhost' || host.startsWith('127.')
      const isNetlifyDomain =
        host.endsWith('.netlify.app') || host.endsWith('.netlify.com') || host.endsWith('.netlify.dev')

      if (origin && (isLocalhost || isNetlifyDomain)) {
        return `${origin}/.netlify/functions/update-stock`
      }
    } catch {
      // ignore URL parsing errors and keep the default base
    }
  }

  return `${DEFAULT_FUNCTION_BASE}/.netlify/functions/update-stock`
}

const UPDATE_STOCK_ENDPOINT = resolveUpdateStockEndpoint()

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

  let payload: any = null
  if (!response.ok) {
    let detail = ''
    try {
      payload = await response.json()
      detail = payload?.error ?? ''
    } catch {
      payload = null
    }
    const reason = detail || `status ${response.status}`
    const error = new Error(`Falha ao atualizar estoque (${reason}).`)
    ;(error as any).status = response.status
    ;(error as any).details = payload ?? {}
    throw error
  }

  payload = (await response.json()) as {newStock: number}
  if (typeof payload?.newStock !== 'number') {
    throw new Error('Resposta inesperada do servidor')
  }

  return {newStock: payload.newStock}
}
