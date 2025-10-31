import {createClient} from '@sanity/client'

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID ?? '5gg7e1t8'
const dataset = import.meta.env.VITE_SANITY_DATASET ?? 'production'
const apiVersion = import.meta.env.VITE_SANITY_API_VERSION ?? '2024-03-01'

const baseConfig = {
  projectId,
  dataset,
  apiVersion,
}

export const sanity = createClient({
  ...baseConfig,
  useCdn: import.meta.env.PROD,
})

// opcional: facilita debugar no console do navegador
if (import.meta.env.DEV) {
  ;(window as any).sanity = sanity
}
