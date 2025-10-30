import groq from 'groq'

export const PRODUCTS_QUERY = groq`
*[_type=="product"]{
  _id, name, rows[]{ _key, flavor, stock }
} | order(name asc)
`
