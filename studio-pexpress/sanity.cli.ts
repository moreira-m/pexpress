import {config as loadEnvConfig} from 'dotenv'
import {defineCliConfig} from 'sanity/cli'

loadEnvConfig()

const projectId = process.env.SANITY_PROJECT_ID
const dataset = process.env.SANITY_DATASET

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
  }
})
