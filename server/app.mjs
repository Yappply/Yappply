import express from 'express'
import cors from 'cors'
import { loadEnvFile } from './loadEnv.mjs'
import { connectDb } from './db.mjs'
import authRoutes from './routes/auth.mjs'
import progressRoutes from './routes/progress.mjs'
import geminiRoutes from './routes/gemini.mjs'
import adminRoutes from './routes/admin.mjs'
import freeTestRoutes from './routes/freeTest.mjs'
import { ensureAdminUser } from './lib/ensureAdmin.mjs'
import { seedModelPricing } from './lib/pricing.mjs'
import { scanAbuseFlags } from './lib/flagScanner.mjs'
import { LimitsConfig } from './models/LimitsConfig.mjs'
import { invalidateLimitsCache } from './lib/limits.mjs'

loadEnvFile()

export const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '15mb' }))

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }
  next(err)
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'yappply' })
})

app.use('/api/auth', authRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/free-test', freeTestRoutes)
app.use('/api', geminiRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Something went wrong' })
})

const FLAG_SCAN_INTERVAL_MS = 15 * 60 * 1000
let ready = null

/** Connect to MongoDB and seed required records. Safe to call on every request. */
export function ensureReady() {
  if (!ready) {
    ready = prepare().catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}

async function prepare() {
  await connectDb(process.env.MONGODB_URI || '')

  try {
    await seedModelPricing()
  } catch (err) {
    console.error('Could not seed model pricing:', err instanceof Error ? err.message : err)
  }

  try {
    await LimitsConfig.findOneAndUpdate(
      { key: 'default' },
      {
        $set: {
          sessionsPerDay: 1,
          speakingMinutesPerDay: 30,
          sessionLengthMin: 30,
        },
        $setOnInsert: { key: 'default' },
      },
      { upsert: true },
    )
    invalidateLimitsCache()
  } catch (err) {
    console.error('Could not sync practice limits:', err instanceof Error ? err.message : err)
  }

  try {
    const admin = await ensureAdminUser()
    if (admin?.created) {
      console.log(`Admin user created: ${admin.email}`)
    } else if (admin?.email) {
      console.log(`Admin user ready: ${admin.email}`)
    }
  } catch (err) {
    console.error('Could not ensure admin user:', err instanceof Error ? err.message : err)
  }
}

export function startBackgroundJobs() {
  const runFlagScan = async () => {
    try {
      await scanAbuseFlags()
    } catch (err) {
      console.error('Abuse flag scan failed:', err instanceof Error ? err.message : err)
    }
  }
  setInterval(runFlagScan, FLAG_SCAN_INTERVAL_MS).unref()
}

export function resolveGeminiNote() {
  const key = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim()
  return key ? 'Gemini API key loaded' : 'WARNING: GEMINI_API_KEY not set'
}
