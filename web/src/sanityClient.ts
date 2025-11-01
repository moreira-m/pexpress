import {createClient} from '@sanity/client'

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID ?? '5gg7e1t8'
const dataset = import.meta.env.VITE_SANITY_DATASET ?? 'production'
const apiVersion = import.meta.env.VITE_SANITY_API_VERSION ?? '2024-03-01'

const shouldUseCdn =
  import.meta.env.PROD &&
  (import.meta.env.VITE_SANITY_USE_CDN ?? '').toLowerCase() === 'true'

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: shouldUseCdn,
})

// opcional: facilita debugar no console do navegador
if (import.meta.env.DEV) {
  ;(window as any).sanity = sanity
}
