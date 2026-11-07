import { app, ensureReady, resolveGeminiNote, startBackgroundJobs } from './app.mjs'

const port = Number(process.env.PORT || 3001)
const webPort = Number(process.env.WEB_PORT || 5173)

async function start() {
  try {
    await ensureReady()
  } catch (err) {
    console.error('MongoDB connection failed:', err instanceof Error ? err.message : err)
    console.error(
      'Fix: edit .env → set MONGODB_URI to your real Atlas URI (Atlas → Connect → Drivers). ' +
        'Also allow your IP under Atlas → Network Access.',
    )
    process.exit(1)
  }

  startBackgroundJobs()

  app.listen(port, () => {
    console.log(`Yappply API on http://localhost:${port}`)
    console.log(`Open the app at http://localhost:${webPort}`)
    console.log(resolveGeminiNote())
  })
}

start()
