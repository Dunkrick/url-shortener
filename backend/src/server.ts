import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { getDb } from './db.js'

const port = Number(process.env.PORT || 8080)

async function start() {
  await getDb()
  console.log('Database Connected!')

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server listening on http://localhost:${info.port}`)
    },
  )
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
