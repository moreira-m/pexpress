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
  _rev,
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

async function fetchProductRow({productId, rowKey}) {
  const queryResult = await fetch(
    `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`,
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
    const error = new Error(reason)
    error.statusCode = queryResult.status || 500
    throw error
  }

  return queryJson?.result || null
}

async function mutateStock({productId, rowKey, quantity, revision}) {
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
              ifRevisionID: revision,
              dec: {
                [`rows[_key=="${escapedKey}"].stock`]: quantity,
              },
            },
          },
        ],
      }),
    },
  )

  if (mutationResult.ok) {
    return {ok: true}
  }

  const mutationJson = await mutationResult.json().catch(() => ({}))
  const error = new Error(
    mutationJson?.error?.description ||
      mutationJson?.error?.message ||
      mutationJson?.message ||
      'Erro ao atualizar estoque',
  )
  error.statusCode = mutationResult.status || 500
  error.payload = mutationJson
  throw error
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
    const MAX_ATTEMPTS = 3
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const product = await fetchProductRow({productId, rowKey})
      const row = product?.row || null

      if (!product || !row) {
        return jsonResponse(404, {error: 'Produto ou sabor não encontrado'})
      }

      const currentStock =
        typeof row.stock === 'number' && Number.isFinite(row.stock) ? row.stock : 0

      if (parsedQuantity > currentStock) {
        return jsonResponse(400, {
          error: `Estoque insuficiente. Disponível: ${currentStock}, solicitado: ${parsedQuantity}`,
          currentStock,
        })
      }

      try {
        await mutateStock({
          productId,
          rowKey,
          quantity: parsedQuantity,
          revision: product._rev,
        })

        const nextStock = currentStock - parsedQuantity
        return jsonResponse(200, {newStock: nextStock})
      } catch (mutationError) {
        const statusCode = mutationError?.statusCode || 500

        const isConcurrencyError = statusCode === 409 || statusCode === 412
        if (isConcurrencyError && attempt < MAX_ATTEMPTS - 1) {
          // Repetir o fluxo com os dados mais recentes
          continue
        }

        if (isConcurrencyError) {
          const latest = await fetchProductRow({productId, rowKey}).catch(() => null)
          const latestStock =
            typeof latest?.row?.stock === 'number' && Number.isFinite(latest?.row?.stock)
              ? latest.row.stock
              : 0
          return jsonResponse(409, {
            error: `Não foi possível registrar o pedido. Estoque atualizado: ${latestStock} unidade(s) disponíveis.`,
            currentStock: latestStock,
          })
        }

        throw mutationError
      }
    }

    throw new Error('Não foi possível registrar o pedido depois de várias tentativas.')
  } catch (error) {
    console.error('[update-stock]', error)
    return jsonResponse(500, {error: error.message || 'Erro desconhecido'})
  }
}
