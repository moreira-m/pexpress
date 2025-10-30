export type Row = { _key: string; flavor: string; stock?: number | null }
export type Product = { _id: string; name: string; rows: Row[] }
