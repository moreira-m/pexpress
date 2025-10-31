import {config as loadEnvConfig} from 'dotenv'
import {defineCliConfig} from 'sanity/cli'

loadEnvConfig()

function readEnv(keys: string[], label: string) {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }
  throw new Error(
    `Missing ${label}. Defina uma das variáveis: ${keys.join(', ')} antes de executar os comandos do Sanity CLI.`,
  )
}

const projectId = readEnv(
  ['SANITY_STUDIO_PROJECT_ID', 'SANITY_PROJECT_ID'],
  'Sanity project ID',
)

const dataset = readEnv(
  ['SANITY_STUDIO_DATASET', 'SANITY_DATASET'],
  'Sanity dataset',
)

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/cli#auto-updates
     */
    autoUpdates: true,
    appId: 'qeiar02fprpe9iejyjeacpdq',
  }
})
