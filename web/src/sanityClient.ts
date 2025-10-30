import {createClient} from '@sanity/client'

export const sanity = createClient({
  projectId: '5gg7e1t8',
  dataset: 'production',
  apiVersion: '2025-07-01', // data fixa é a prática recomendada
  useCdn: true,
})

// opcional: facilita debugar no console do navegador
if (import.meta.env.DEV) (window as any).sanity = sanity
