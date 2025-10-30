import {createClient} from '@sanity/client'

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID ?? '5gg7e1t8'
const dataset = import.meta.env.VITE_SANITY_DATASET ?? 'production'
const apiVersion = '2025-07-01' // data fixa é a prática recomendada
const token = import.meta.env.VITE_SANITY_API_TOKEN

const baseConfig = {
  projectId,
  dataset,
  apiVersion,
}

export const sanity = createClient({
  ...baseConfig,
  useCdn: import.meta.env.PROD,
})

export const sanityWrite = token
  ? createClient({
      ...baseConfig,
      token,
      useCdn: false,
    })
  : null

// opcional: facilita debugar no console do navegador
if (import.meta.env.DEV) {
  ;(window as any).sanity = sanity
  ;(window as any).sanityWrite = sanityWrite
}
