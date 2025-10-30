import {createClient} from '@sanity/client'

export const sanity = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID,
  dataset:   import.meta.env.VITE_SANITY_DATASET,
  apiVersion: import.meta.env.VITE_SANITY_API_VERSION,
  useCdn: true,
})
// opcional: facilita debugar no console do navegador
if (import.meta.env.DEV) (window as any).sanity = sanity
