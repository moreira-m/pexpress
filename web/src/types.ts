export type FlavorRow = { _key: string; flavor: string; stock: number }
export type Product   = { _id: string; name: string; rows: FlavorRow[] }

export type OrderGroup = {
  productId: string
  productName: string
  unitPrice: number
  freight?: number
  lines: Array<{ rowKey: string; flavor: string; qty: number }>
}

export type OrderData = {
  orderNumber?: string
  customerName: string
  paymentMethod: string
  groups: OrderGroup[]
}
