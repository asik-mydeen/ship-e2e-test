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

// ── Root ──
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'ship-e2e-test',
    endpoints: ['GET /', 'GET /health', 'GET /supabase-check', 'GET /notes', 'POST /notes'],
    timestamp: new Date().toISOString(),
  })
})

// ── Health: basic ──
app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// ── Supabase connectivity check ──
app.get('/supabase-check', async (_req, res) => {
  try {
    // Test 1: Auth health
    const authRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY! },
    })
    const authHealth = authRes.ok ? 'healthy' : `error (${authRes.status})`

    // Test 2: Database — ensure e2e_notes table exists, create it if not
    const { error: tableCheckError } = await supabase.from('e2e_notes').select('id').limit(1)
    let dbStatus = 'connected'
    if (tableCheckError?.code === '42P01') {
      // Table doesn't exist — create it via raw SQL
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS e2e_notes (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT now()
        );`
      })
      dbStatus = createError ? `table_create_failed: ${createError.message}` : 'table_created'
    } else if (tableCheckError) {
      dbStatus = `error: ${tableCheckError.message}`
    }

    // Test 3: Storage — list buckets
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets()
    const storageStatus = storageError ? `error: ${storageError.message}` : `ok (${buckets?.length ?? 0} buckets)`

    res.json({
      status: 'ok',
      supabase: {
        url: process.env.SUPABASE_URL,
        auth: authHealth,
        database: dbStatus,
        storage: storageStatus,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message })
  }
})

// ── CRUD: Notes (backed by Supabase) ──
app.get('/notes', async (_req, res) => {
  const { data, error } = await supabase
    .from('e2e_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ notes: data })
})

app.post('/notes', async (req, res) => {
  const { title, body } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })

  const { data, error } = await supabase
    .from('e2e_notes')
    .insert({ title, body: body || '' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ note: data })
})

app.delete('/notes/:id', async (req, res) => {
  const { error } = await supabase
    .from('e2e_notes')
    .delete()
    .eq('id', parseInt(req.params.id))

  if (error) return res.status(500).json({ error: error.message })
  res.json({ deleted: true })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ship-e2e-test running on port ${PORT}`)
})
