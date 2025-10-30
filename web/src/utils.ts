export const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

export function encodeWhatsAppMessage(msg: string, phone?: string) {
  // se tiver número, use wa.me/<number>?text=
  const base = phone ? `https://wa.me/${phone}` : `https://wa.me/`
  const sep = phone ? "?" : "?"
  return `${base}${sep}text=${encodeURIComponent(msg)}`
}

// Gera o texto no padrão enviado
export function buildOrderMessage(order: Order) {
  const header = "——————————————\n *MODELO PEDIDO CADASTRO*\n"
  const nPedido = `\nNUMERO DO PEDIDO: ${order.orderNumber ?? ""}\n`
  const nome = `\nNOME DO CLIENTE: ${order.clientName}\n`
  const pedidoHeader = `\nPEDIDO:\n`

  // Agrupar por (productName, price, freight) para aparecer como seus blocos
  const groups = new Map<string, OrderLine[]>()
  order.lines.forEach(l => {
    const key = `${l.productName}|${l.price}|${l.freight ?? 0}`
    const bucket = groups.get(key) ?? []
    bucket.push(l)
    groups.set(key, bucket)
  })

  let corpo = ""
  for (const [key, lines] of groups.entries()) {
    const [productName, priceStr, freightStr] = key.split("|")
    const price = Number(priceStr)
    const freight = Number(freightStr)
    corpo += `*${productName.toLowerCase()}* ${fmtCurrency(price)}`
    if (freight > 0) corpo += ` + ${fmtCurrency(freight)} frete`
    corpo += `\n`
    for (const l of lines) {
      corpo += `${l.qty} ${l.flavor.toLowerCase()}\n`
    }
    corpo += `\n`
  }

  const footerClient = `*${order.clientName.toLowerCase()}*\n`
  const pagamento = `\nFORMA DE PAGAMENTO: ${order.paymentMethod}\n`

  // total = soma (qty * price) + fretes declarados por grupo
  let total = 0
  for (const [key, lines] of groups.entries()) {
    const [, priceStr, freightStr] = key.split("|")
    const price = Number(priceStr)
    const freight = Number(freightStr)
    const qtdGrupo = lines.reduce((s, l) => s + l.qty, 0)
    total += qtdGrupo * price + (freight > 0 ? freight : 0)
  }
  const totalStr = `\nVALOR TOTAL : ${fmtCurrency(total)}\n\n——————————————\n`

  return `${header}${nPedido}${nome}${pedidoHeader}${corpo}${footerClient}${pagamento}${totalStr}`
}
