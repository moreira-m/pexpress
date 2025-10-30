import {createClient} from '@sanity/client'
const client = createClient({
  projectId: '5gg7e1t8',
  dataset: 'production',
  apiVersion: '2025-07-01',
  useCdn: true,
})
client.fetch('*[_type=="product"][0...1]{_id}')
  .then(console.log)
  .catch(console.error)
