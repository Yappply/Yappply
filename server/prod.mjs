/**
 * Serve the production build + Gemini API proxy (key stays on the server).
 * Usage: npm run build && npm start
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGeminiMiddleware, resolveApiKey } from './geminiApi.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const port = Number(process.env.PORT || 4173)

// Load .env manually (no Vite in prod)
try {
  const envPath = path.join(root, '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  }
} catch {
  /* ignore */
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const api = createGeminiMiddleware(() => resolveApiKey(process.env))

function sendFile(res, filePath) {
  const ext = path.extname(filePath)
  res.statusCode = 200
  res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`)

  if (url.pathname.startsWith('/api/')) {
    void api(req, res)
    return
  }

  if (!fs.existsSync(dist)) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain')
    res.end('dist/ missing — run npm run build first')
    return
  }

  let rel = decodeURIComponent(url.pathname)
  if (rel === '/') rel = '/index.html'
  const filePath = path.normalize(path.join(dist, rel))
  if (!filePath.startsWith(dist)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath)
    return
  }

  // SPA fallback
  sendFile(res, path.join(dist, 'index.html'))
})

server.listen(port, () => {
  const configured = Boolean(resolveApiKey(process.env))
  console.log(`Speakora listening on http://localhost:${port}`)
  console.log(configured ? 'Gemini API key loaded from env' : 'WARNING: GEMINI_API_KEY not set')
})
