import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {presentationTool} from 'sanity/presentation'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'PExpress',
  projectId: import.meta.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: import.meta.env.SANITY_STUDIO_DATASET!,
  plugins: [
    structureTool(),
    visionTool(),
    presentationTool({
      previewUrl: {
        origin:
          import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ??
          (import.meta.env.DEV ? 'http://localhost:8000' : 'https://your-production-domain'),
      },
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
