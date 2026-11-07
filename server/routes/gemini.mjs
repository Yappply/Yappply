import { Router } from 'express'
import {
  generateText,
  resolveApiKey,
  synthesizeSpeech,
  warmConnection,
} from '../geminiApi.mjs'
import { requireAuth, optionalAuth, clientMeta } from '../middleware/auth.mjs'
import { logUsageEvent } from '../lib/logUsageEvent.mjs'
import { checkPracticeAllowed } from '../lib/limits.mjs'
import { resolveRequestTimeZone } from '../lib/timeZones.mjs'

const router = Router()

router.get('/status', (_req, res) => {
  res.json({ configured: Boolean(resolveApiKey(process.env)) })
})

router.post('/warm', optionalAuth, async (req, res) => {
  const apiKey = resolveApiKey(process.env)
  if (!apiKey) {
    res.status(503).json({ error: 'Missing Gemini API key' })
    return
  }
  const started = Date.now()
  const result = await warmConnection(apiKey)
  if (req.user && result.ok) {
    const meta = clientMeta(req)
    void logUsageEvent({
      userId: req.user._id,
      callType: 'warm',
      model: result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
      status: 'ok',
      ...meta,
    })
  }
  res.json({ ok: true })
})

router.post('/generate', requireAuth, async (req, res) => {
  const meta = clientMeta(req)
  const sessionId = req.body?.sessionId || null
  const lessonId = String(req.body?.lessonId || '')
  const turnIndex = Number(req.body?.turnIndex) || 0
  const callType = ['conversation', 'correction', 'scoring', 'greeting', 'other'].includes(
    req.body?.callType,
  )
    ? req.body.callType
    : 'conversation'
  const userText = typeof req.body?.userText === 'string' ? req.body.userText : ''
  const modelHint = 'gemini-3.5-flash-lite'

  const denied = await checkPracticeAllowed(req.user, {
    sessionId,
    userText,
    kind: 'generate',
    timeZone: resolveRequestTimeZone(req),
  })
  if (denied) {
    void logUsageEvent({
      userId: req.user._id,
      sessionId,
      lessonId,
      turnIndex,
      callType,
      model: modelHint,
      usage: {},
      status: denied.code === 'rate_limited' ? 'rate_limited' : 'blocked',
      errorCode: denied.code,
      userTextChars: userText.length,
      ...meta,
    })
    res.status(denied.statusCode).json({ error: denied.error, code: denied.code })
    return
  }

  const started = Date.now()
  try {
    const apiKey = resolveApiKey(process.env)
    if (!apiKey) {
      res.status(503).json({
        error: 'Missing Gemini API key. Add GEMINI_API_KEY to your .env file.',
      })
      return
    }
    if (!req.body?.prompt || !req.body?.systemInstruction) {
      res.status(400).json({ error: 'prompt and systemInstruction are required' })
      return
    }
    const result = await generateText(apiKey, req.body)
    void logUsageEvent({
      userId: req.user._id,
      sessionId,
      lessonId,
      turnIndex,
      callType,
      model: result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
      status: 'ok',
      userTextChars: userText.length,
      ...meta,
    })
    res.json({ text: result.text, model: result.model })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generate failed'
    const rateLimited = /429|rate|quota/i.test(message)
    void logUsageEvent({
      userId: req.user._id,
      sessionId,
      lessonId,
      turnIndex,
      callType,
      model: modelHint,
      usage: {},
      latencyMs: Date.now() - started,
      status: rateLimited ? 'rate_limited' : 'error',
      errorCode: rateLimited ? 'gemini_429' : 'gemini_error',
      userTextChars: userText.length,
      ...meta,
    })
    res.status(502).json({ error: message })
  }
})

router.post('/tts', requireAuth, async (req, res) => {
  const meta = clientMeta(req)
  const sessionId = req.body?.sessionId || null
  const lessonId = String(req.body?.lessonId || '')
  const turnIndex = Number(req.body?.turnIndex) || 0
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  const modelHint = 'gemini-3.8-flash-lite-tts'

  const denied = await checkPracticeAllowed(req.user, {
    sessionId,
    userText: '',
    kind: 'tts',
    timeZone: resolveRequestTimeZone(req),
  })
  if (denied) {
    void logUsageEvent({
      userId: req.user._id,
      sessionId,
      lessonId,
      turnIndex,
      callType: 'tts',
      model: modelHint,
      usage: {},
      status: denied.code === 'rate_limited' ? 'rate_limited' : 'blocked',
      errorCode: denied.code,
      userTextChars: text.length,
      ...meta,
    })
    res.status(denied.statusCode).json({ error: denied.error, code: denied.code })
    return
  }

  const started = Date.now()
  try {
    const apiKey = resolveApiKey(process.env)
    if (!apiKey) {
      res.status(503).json({ error: 'Missing Gemini API key' })
      return
    }
    const result = await synthesizeSpeech(apiKey, text)
    void logUsageEvent({
      userId: req.user._id,
      sessionId,
      lessonId,
      turnIndex,
      callType: 'tts',
      model: result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
      status: 'ok',
      userTextChars: text.length,
      ...meta,
    })
    res.setHeader('Content-Type', result.mime)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Speakora-TTS-Model', result.model)
    res.end(result.bytes)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    void logUsageEvent({
      userId: req.user._id,
      sessionId,
      lessonId,
      turnIndex,
      callType: 'tts',
      model: modelHint,
      usage: {},
      latencyMs: Date.now() - started,
      status: 'error',
      errorCode: 'tts_error',
      userTextChars: text.length,
      ...meta,
    })
    res.status(502).json({ error: message })
  }
})

export default router
