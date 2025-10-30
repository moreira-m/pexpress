// server/local-api.js
require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { createClient } = require("@sanity/client")

const app = express()
app.use(cors({ origin: "http://localhost:5173" }))
app.use(express.json())

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN, // write
  apiVersion: process.env.SANITY_API_VERSION || "2025-07-01",
  useCdn: false,
})

/**
 * Agrupa itens iguais (productId + rowKey) somando qty
 */
function coalesceItems(items) {
  const map = new Map()
  for (const it of items) {
    const qty = Math.max(1, Math.floor(Number(it.qty || 0)))
    const key = `${it.productId}__${it.rowKey}`
    map.set(key, {
      productId: it.productId,
      rowKey: it.rowKey,
      qty: (map.get(key)?.qty || 0) + qty,
    })
  }
  return [...map.values()]
}

// POST /reservar-lote  { items: [{productId, rowKey, qty}] }
app.post("/reservar-lote", async (req, res) => {
  try {
    let { items } = req.body || {}
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "no items" })
    }

    // Normaliza e agrupa
    items = coalesceItems(items)

    // Carregar documentos (estoque e _rev atuais)
    const ids = [...new Set(items.map(i => i.productId))]
    const docs = await Promise.all(ids.map(id => client.getDocument(id)))
    const byId = new Map(docs.filter(Boolean).map(d => [d._id, d]))

    // Validar disponibilidade com fallback para 0
    for (const it of items) {
      const doc = byId.get(it.productId)
      const row = doc?.rows?.find(r => r._key === it.rowKey)
      const available = Number(row?.stock ?? 0)
      if (!doc || !row) {
        return res.status(404).json({ error: "not found", item: it })
      }
      if (it.qty > available) {
        return res.status(409).json({
          error: "insufficient",
          available,
          item: it,
        })
      }
    }

    // Transação com patches condicionais (lock otimista por _rev)
    let tx = client.transaction()
    for (const it of items) {
      const doc = byId.get(it.productId)
      const row = doc.rows.find(r => r._key === it.rowKey)
      const current = Number(row?.stock ?? 0)
      const newStock = Math.max(0, current - it.qty)

      // Log útil para debug
      console.log(
        `Atualizando ${doc.name} / ${row.flavor}: ${current} -> ${newStock}`
      )

      tx = tx.patch(it.productId, p =>
        p.ifRevisionId(doc._rev)
         .set({ [`rows[_key=="${it.rowKey}"].stock`]: newStock })
      )
    }

    await tx.commit()
    return res.json({ ok: true })
  } catch (e) {
    // Detecta conflito de revisão (concorrência) e retorna 409
    const msg = String(e && e.message || e)
    if (msg.includes("revision") || msg.includes("mismatch") || msg.includes("409")) {
      return res.status(409).json({ error: "concurrent_update", detail: msg })
    }
    console.error("reservar-lote error:", e)
    return res.status(500).json({ error: "internal", detail: msg })
  }
})

const port = process.env.PORT || 8787
app.listen(port, () => console.log(`Local API on http://localhost:${port}`))
