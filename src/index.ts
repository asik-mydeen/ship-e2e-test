import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const app = express()
const PORT = parseInt(process.env.PORT || '3000')

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ status: 'ok', name: 'ship-e2e-test', timestamp: new Date().toISOString() })
})

app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ship-e2e-test running on port ${PORT}`)
})
