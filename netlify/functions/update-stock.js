'use strict'

const PROJECT_ID = process.env.SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID
const DATASET = process.env.SANITY_DATASET || process.env.SANITY_STUDIO_DATASET || 'production'
const API_VERSION = process.env.SANITY_API_VERSION || '2024-03-01'
const TOKEN = process.env.SANITY_WRITE_TOKEN
const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*'

const BASE_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
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

function escapeQuotes(key) {
  return key.replace(/"/g, '\\"')
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: BASE_HEADERS,
    body: JSON.stringify(body),
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: BASE_HEADERS,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, {error: 'Method not allowed'})
  }

  if (!PROJECT_ID || !DATASET || !TOKEN) {
    return jsonResponse(500, {error: 'Missing Sanity configuration on the server'})
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch (error) {
    return jsonResponse(400, {error: 'Invalid JSON payload'})
  }

  const {productId, rowKey, quantity} = payload || {}

  if (typeof productId !== 'string' || typeof rowKey !== 'string') {
    return jsonResponse(400, {error: 'productId e rowKey são obrigatórios'})
  }

  const parsedQuantity = Number(quantity)
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return jsonResponse(400, {error: 'quantity deve ser um número maior que zero'})
  }

  try {
    const queryResult = await fetch(
      `https://${PROJECT_ID}.apicdn.sanity.io/v${API_VERSION}/data/query/${DATASET}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
          query: SINGLE_ROW_QUERY,
          params: {
            productId,
            rowKey,
          },
        }),
      },
    )

    const queryJson = await queryResult.json()

    if (!queryResult.ok) {
      const reason =
        queryJson?.error?.description ||
        queryJson?.error?.message ||
        queryJson?.message ||
        'Erro ao consultar produto'
      throw new Error(reason)
    }

    const product = queryJson?.result || null
    const row = product?.row || null

    if (!product || !row) {
      return jsonResponse(404, {error: 'Produto ou sabor não encontrado'})
    }

    const currentStock =
      typeof row.stock === 'number' && Number.isFinite(row.stock) ? row.stock : 0

    if (parsedQuantity > currentStock) {
      return jsonResponse(400, {
        error: `Estoque insuficiente. Disponível: ${currentStock}, solicitado: ${parsedQuantity}`,
      })
    }

    const nextStock = currentStock - parsedQuantity
    const escapedKey = escapeQuotes(rowKey)

    const mutationResult = await fetch(
      `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
          mutations: [
            {
              patch: {
                id: productId,
                set: {
                  [`rows[_key=="${escapedKey}"].stock`]: nextStock,
                },
              },
            },
          ],
        }),
      },
    )

    const mutationJson = await mutationResult.json()

    if (!mutationResult.ok) {
      const reason =
        mutationJson?.error?.description ||
        mutationJson?.error?.message ||
        mutationJson?.message ||
        'Erro ao atualizar estoque'
      throw new Error(reason)
    }

    return jsonResponse(200, {newStock: nextStock})
  } catch (error) {
    console.error('[update-stock]', error)
    return jsonResponse(500, {error: error.message || 'Erro desconhecido'})
  }
}
