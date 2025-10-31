import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {presentationTool} from 'sanity/presentation'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'
import deckStructure from './deckStructure'

type EnvRecord = Record<string, string | boolean | undefined>

const metaEnv: EnvRecord =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) || {}

const processEnv: EnvRecord =
  typeof process !== 'undefined' && process.env ? (process.env as EnvRecord) : {}

const env: EnvRecord = {...processEnv, ...metaEnv}

const getEnv = (keys: string[], label: string) => {
  for (const key of keys) {
    const value = env[key]
    if (typeof value === 'string' && value) return value
  }
  throw new Error(`Missing ${label}. Defina uma das variáveis: ${keys.join(', ')}`)
}

const toBool = (value: string | boolean | undefined, fallback: boolean) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return fallback
}

const projectId = getEnv(
  ['SANITY_STUDIO_PROJECT_ID', 'SANITY_PROJECT_ID'],
  'Sanity project ID',
)
const dataset = getEnv(
  ['SANITY_STUDIO_DATASET', 'SANITY_DATASET'],
  'Sanity dataset',
)

const studioHost = env.SANITY_STUDIO_HOST as string | undefined

const isDev = toBool(env.DEV, String(env.NODE_ENV ?? '').toLowerCase() !== 'production')

const previewOrigin =
  (env.SANITY_STUDIO_PREVIEW_ORIGIN as string | undefined) ??
  (isDev ? 'http://localhost:8000' : 'https://your-production-domain')

export default defineConfig({
  name: 'default',
  title: 'PExpress',
  projectId,
  dataset,
  studioHost,
  plugins: [
    structureTool({
      structure: deckStructure,
    }),
    visionTool(),
    presentationTool({
      previewUrl: {origin: previewOrigin},
      resolve: {
        document: {
          home: (doc) => {
            const slug = doc?.slug?.current
            if (!slug) {
              return undefined
            }

            return {
              slug,
              path: `/${slug}`,
            }
          },
        },
      },
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
