import type {OrderData} from "../types"

export const brMoney = (v:number)=>
  (typeof v==="number" ? v.toFixed(2).replace(".", ",") : "0,00")

export function computeTotal(order: OrderData) {
  let total = 0
  for (const g of order.groups) {
    const q = g.lines.reduce((s,l)=>s+(l.qty||0), 0)
    total += q * (g.unitPrice || 0)
    total += g.freight ? g.freight : 0
  }
  return total
}

export function buildWhatsappMessage(order: OrderData) {
  const lines: string[] = []
  const sep = "——————————————"
  lines.push(sep)
  lines.push(" *MODELO PEDIDO CADASTRO*")
  lines.push("")
  lines.push(`NUMERO DO PEDIDO: ${order.orderNumber ?? ""}`)
  lines.push("")
  lines.push(`NOME DO CLIENTE: ${order.customerName}`)
  lines.push("")
  lines.push("PEDIDO:")

  // agrupar por (productName, unitPrice, freight) para o layout desejado
  const groups = new Map<string, typeof order.groups[number]["lines"]>()
  for (const g of order.groups) {
    const key = `${g.productName}|${g.unitPrice}|${g.freight ?? 0}`
    const bucket = groups.get(key) ?? []
    bucket.push(...g.lines)
    groups.set(key, bucket)
  }

  for (const [key, linesInGroup] of groups.entries()) {
    const [productName, priceStr, freightStr] = key.split("|")
    const price = Number(priceStr)
    const freight = Number(freightStr)
    const header = `*${productName}* ${brMoney(price)}${freight > 0 ? ` + ${brMoney(freight)} frete` : ""}`
    lines.push(header)
    for (const l of linesInGroup) lines.push(`${l.qty} ${l.flavor}`)
    lines.push("") // linha em branco
  }

  lines.push(`FORMA DE PAGAMENTO: ${order.paymentMethod}`)
  lines.push("")
  lines.push(`VALOR TOTAL : ${brMoney(computeTotal(order))}`)
  lines.push("")
  lines.push(sep)
  return lines.join("\n")
}
