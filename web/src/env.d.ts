/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SANITY_PROJECT_ID?: string
  readonly VITE_SANITY_DATASET?: string
  readonly VITE_SANITY_API_VERSION?: string
  readonly VITE_FUNCTIONS_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
