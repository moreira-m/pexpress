import {sanity, sanityWrite} from '../sanityClient'
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

function escapeQuotes(key: string) {
  return key.replace(/"/g, '\\"')
}

export async function submitOrder({productId, rowKey, quantity}: OrderInput) {
  if (!sanityWrite) throw new Error('Token de escrita do Sanity ausente')
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
  if (quantity > current) {
    throw new Error(
      `Estoque insuficiente. Disponível: ${current}, solicitado: ${quantity}`
    )
  }

  const newStock = current - quantity
  const escaped = escapeQuotes(rowKey)

  await sanityWrite
    .patch(productId)
    .set({[`rows[_key=="${escaped}"].stock`]: newStock})
    .commit({autoGenerateArrayKeys: false})

  return {newStock}
}
