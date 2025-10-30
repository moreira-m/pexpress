import { useMemo, useState } from "react"
import { useProducts } from "./hooks/useProduct"        // ✅ nome certo
import type { FlavorRow, OrderData, OrderGroup } from "./types"  // ✅ tipos centrais
import { computeTotal, buildWhatsappMessage } from "./lib/orderHelpers"

type BtnKind = "copyOnly" | "copyAndOpen"

export default function App() {
  const { products, loading } = useProducts()
  const [order, setOrder] = useState<OrderData>({
    orderNumber: "",
    customerName: "",
    paymentMethod: "pix",
    groups: []
  })

  const total = useMemo(() => computeTotal(order), [order])

  function addGroup() {
    if (!products.length) return
    const p = products[0]
    setOrder(o => ({
      ...o,
      groups: [...o.groups, {
        productId: p._id,
        productName: p.name,
        unitPrice: 0,
        freight: 0,
        lines: []
      }]
    }))
  }

  function updateGroup(idx: number, patch: Partial<OrderGroup>) {
    setOrder(o => {
      const groups = o.groups.slice()
      groups[idx] = { ...groups[idx], ...patch }
      return { ...o, groups }
    })
  }

  function removeGroup(idx: number) {
    setOrder(o => {
      const groups = o.groups.slice()
      groups.splice(idx, 1)
      return { ...o, groups }
    })
  }

  function addLine(gidx: number) {
    setOrder(o => {
      const groups = o.groups.slice()
      groups[gidx].lines.push({ rowKey: "", flavor: "", qty: 1 })
      return { ...o, groups }
    })
  }

  function updateLine(gidx: number, lidx: number, patch: Partial<{ rowKey: string; flavor: string; qty: number }>) {
    setOrder(o => {
      const groups = o.groups.slice()
      const lines = groups[gidx].lines.slice()
      lines[lidx] = { ...lines[lidx], ...patch }
      groups[gidx].lines = lines
      return { ...o, groups }
    })
  }

  // Estoque disponível para um sabor
  function getStock(productId: string, rowKey: string) {
    const p = products.find(p => p._id === productId)
    const r = p?.rows?.find(r => r._key === rowKey)
    return r?.stock ?? 0
  }

  async function handleAction(kind: BtnKind) {
    // validações simples
    if (!order.customerName.trim()) { alert("Informe o nome do cliente"); return }
    if (!order.groups.length) { alert("Adicione ao menos um produto"); return }
    for (const g of order.groups) {
      if (!g.productId) return alert("Selecione um produto")
      if (!g.unitPrice || g.unitPrice <= 0) return alert("Informe o preço unitário do grupo")
      if (!g.lines.length) return alert("Adicione ao menos um sabor nesse grupo")
      for (const l of g.lines) {
        if (!l.rowKey) return alert("Selecione o sabor")
        if (!l.qty || l.qty <= 0) return alert("Quantidade inválida em algum item")
        if (l.qty > getStock(g.productId, l.rowKey)) {
          return alert(`Qtd maior que o estoque disponível para ${g.productName} / ${l.flavor}`)
        }
      }
    }

    // Confirmação antes de debitar
    const msg = buildWhatsappMessage(order)
    const ok = window.confirm(
      "Confirmar e debitar do estoque?\n\nPrévia da mensagem:\n\n" + msg.substring(0, 400) + (msg.length > 400 ? "..." : "")
    )
    if (!ok) return

    // Chama sua Netlify Function (reserva em lote via transação)
    try {
      const items = order.groups.flatMap(g =>
        g.lines.map(l => ({
          productId: g.productId,
          rowKey: l.rowKey,
          qty: l.qty
        }))
      )
      const resp = await fetch("http://localhost:8787/reservar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body?.error || "Falha ao reservar")
      }

      // Sucesso: copia e/ou abre WhatsApp
      await navigator.clipboard.writeText(msg)
      if (kind === "copyOnly") {
        alert("Mensagem copiada e estoque debitado com sucesso.")
      } else {
        // sem número específico: apenas abre com texto
        const url = "https://wa.me/?text=" + encodeURIComponent(msg)
        window.open(url, "_blank")
      }
    } catch (e: any) {
      alert(e.message || String(e))
    }
  }

  if (loading) return <p style={{ padding: 20 }}>Carregando…</p>

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <h1>Cadastro de Pedido</h1>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label> Nº do Pedido
          <input value={order.orderNumber ?? ""} onChange={e => setOrder(o => ({ ...o, orderNumber: e.target.value }))}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>

        <label> Nome do Cliente
          <input value={order.customerName} onChange={e => setOrder(o => ({ ...o, customerName: e.target.value }))}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>

        <label> Forma de Pagamento
          <select value={order.paymentMethod} onChange={e => setOrder(o => ({ ...o, paymentMethod: e.target.value }))}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
            <option value="pix">pix</option>
            <option value="dinheiro">dinheiro</option>
            <option value="cartão">cartão</option>
          </select>
        </label>
      </section>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2>Produtos</h2>
        <button onClick={addGroup}>+ Adicionar produto</button>
      </div>

      {order.groups.map((g, gidx) => {
        const product = products.find(p => p._id === g.productId) || products[0]
        return (
          <section key={gidx} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <label> Produto
                <select
                  value={g.productId}
                  onChange={e => {
                    const p = products.find(p => p._id === e.target.value)!
                    updateGroup(gidx, { productId: p._id, productName: p.name, lines: [] })
                  }}
                  style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </label>

              <label> Preço unitário
                <input type="number" step="0.01" value={g.unitPrice}
                  onChange={e => updateGroup(gidx, { unitPrice: Number(e.target.value) })}
                  style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
              </label>

              <label> Frete (opcional)
                <input type="number" step="0.01" value={g.freight ?? 0}
                  onChange={e => updateGroup(gidx, { freight: Number(e.target.value) })}
                  style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
              </label>

              <button onClick={() => removeGroup(gidx)} style={{ height: 36 }}>Remover</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Sabores</strong>
                <button onClick={() => addLine(gidx)}>+ Adicionar sabor</button>
              </div>

              {g.lines.map((l, lidx) => (
                <div key={lidx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginTop: 8 }}>
                  <label> Sabor
                    <select
                      value={l.rowKey}
                      onChange={e => {
                        const rk = e.target.value
                        const fr = product.rows.find(r => r._key === rk)!
                        updateLine(gidx, lidx, { rowKey: rk, flavor: fr.flavor })
                      }}
                      style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
                      <option value="">Selecione…</option>
                      {product.rows.map((r: FlavorRow) => (
                        <option key={r._key} value={r._key}>
                          {r.flavor} (estoque: {r.stock ?? 0})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label> Qtd
                    <input type="number" min={1} value={l.qty}
                      onChange={e => updateLine(gidx, lidx, { qty: Number(e.target.value) })}
                      style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
                  </label>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <small>Disponível: {l.rowKey ? getStock(g.productId, l.rowKey) : "-"}</small>
                  </div>

                  <button onClick={() => {
                    // remover linha
                    const lines = order.groups[gidx].lines.filter((_, i) => i !== lidx)
                    updateGroup(gidx, { lines })
                  }}>Remover</button>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <strong>Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleAction("copyOnly")}>Copiar (com débito)</button>
          <button onClick={() => handleAction("copyAndOpen")}>Copiar + WhatsApp (com débito)</button>
        </div>
      </div>
    </main>
  )
}
