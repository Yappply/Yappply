/**
 * Server-side Gemini helpers. The API key never leaves Node.
 * Used by the Vite plugin (dev/preview) and by `server/prod.mjs`.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** Verified text models — fastest / cheapest first. */
export const TEXT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
]

/** Dedicated speech-to-text, then multimodal flash fallbacks. */
export const TRANSCRIBE_MODELS = [
  'gemini-3.5-transcribe',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
]

/** Verified TTS models — lite first for latency. */
export const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']

export const LUCY_VOICE = 'Aoede'

export const LUCY_SPEECH_STYLE =
  'Warm, clear English teacher for beginners: calm, friendly, patient, easy to understand. ' +
  'Speak clearly at a gentle pace. No slang, no trendy Gen Z tone, not robotic.'

export const VOICE_REPLY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    mode: { type: 'STRING', enum: ['chat', 'practice'] },
    correctedSentence: { type: 'STRING', nullable: true },
    hadCorrection: { type: 'BOOLEAN' },
  },
  required: ['reply', 'mode', 'hadCorrection'],
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err)
}

function isRetryable(err) {
  return /503|high demand|unavailable|429|quota|rate|try again|temporar/i.test(errorMessage(err))
}

function isMissingModel(err) {
  return /404|no longer available|not found/i.test(errorMessage(err))
}

export function resolveApiKey(env = process.env) {
  return (env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '').trim()
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

async function geminiGenerateContent(apiKey, model, body) {
  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error?.message || `Gemini HTTP ${res.status}`)
  }
  return json
}

function extractText(json) {
  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim()
}

export async function generateText(apiKey, { systemInstruction, prompt, generationConfig }) {
  let lastError
  const config = {
    temperature: 0.9,
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
    responseSchema: VOICE_REPLY_SCHEMA,
    ...generationConfig,
  }

  for (const model of TEXT_MODELS) {
    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
    }

    try {
      const json = await geminiGenerateContent(apiKey, model, body)
      const text = extractText(json)
      if (!text) throw new Error('Empty model response')
      return { text, model, usage: json?.usageMetadata || {} }
    } catch (err) {
      lastError = err
      if (isMissingModel(err)) continue
      if (!isRetryable(err)) throw err
      try {
        const json = await geminiGenerateContent(apiKey, model, body)
        const text = extractText(json)
        if (!text) throw new Error('Empty model response')
        return { text, model, usage: json?.usageMetadata || {} }
      } catch (err2) {
        lastError = err2
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini request failed')
}

export async function warmConnection(apiKey) {
  const model = TEXT_MODELS[0]
  try {
    const json = await geminiGenerateContent(apiKey, model, {
      contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
      generationConfig: { maxOutputTokens: 8 },
    })
    return { ok: true, model, usage: json?.usageMetadata || {} }
  } catch {
    return { ok: false, model, usage: {} }
  }
}

function normalizeAudioMime(mimeType = '') {
  const raw = String(mimeType || '').split(';')[0].trim().toLowerCase()
  if (!raw) return 'audio/webm'
  if (raw === 'audio/mp3') return 'audio/mpeg'
  return raw
}

function cleanTranscript(text) {
  return String(text || '')
    .replace(/^```(?:\w+)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^(transcript|transcription)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * High-accuracy speech-to-text via Gemini 3.5 Transcribe (VERBATIM keeps fillers).
 * Falls back to multimodal flash models if the dedicated ASR model is unavailable.
 */
export async function transcribeAudio(
  apiKey,
  { audioBase64, mimeType = 'audio/webm', languageCodes = ['en-US'] },
) {
  const data = String(audioBase64 || '').replace(/^data:[^;]+;base64,/, '').trim()
  if (!data) throw new Error('Missing audio')

  const mime = normalizeAudioMime(mimeType)
  const audioPart = { inlineData: { mimeType: mime, data } }
  let lastError

  for (const model of TRANSCRIBE_MODELS) {
    const isDedicated = model.includes('transcribe')
    const fullMinuteInstruction =
      'This recording is a full 60 seconds. Transcribe every word from the first second through the last second. ' +
      'Do not stop at pauses. Do not summarize. Do not leave out the ending. ' +
      'Keep filler words (um, uh, like, you know). Do not correct grammar. ' +
      'Return only the transcript text.'
    const body = isDedicated
      ? {
          contents: [
            {
              role: 'user',
              parts: [{ text: fullMinuteInstruction }, audioPart],
            },
          ],
          generationConfig: {
            maxOutputTokens: 8192,
            audioTranscriptionConfig: {
              languageCodes,
              mode: 'VERBATIM',
            },
          },
        }
      : {
          systemInstruction: {
            parts: [{ text: fullMinuteInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Transcribe this entire 60-second English recording verbatim, start to finish.',
                },
                audioPart,
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
          },
        }

    try {
      const json = await geminiGenerateContent(apiKey, model, body)
      const text = cleanTranscript(extractText(json))
      if (!text) throw new Error('Empty transcript')
      return { transcript: text, model, usage: json?.usageMetadata || {} }
    } catch (err) {
      lastError = err
      if (isMissingModel(err)) continue
      if (!isRetryable(err)) {
        if (isDedicated) continue
        throw err
      }
      try {
        const json = await geminiGenerateContent(apiKey, model, body)
        const text = cleanTranscript(extractText(json))
        if (!text) throw new Error('Empty transcript')
        return { transcript: text, model, usage: json?.usageMetadata || {} }
      } catch (err2) {
        lastError = err2
        if (isDedicated || isMissingModel(err2)) continue
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Transcription failed')
}

function isWav(bytes) {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
}

/** Wrap headerless 16-bit PCM as a playable WAV blob bytes. */
export function pcmToWavBytes(pcm, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
  const blockAlign = (numChannels * bitDepth) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.byteLength
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  new Uint8Array(buffer, 44).set(pcm)
  return new Uint8Array(buffer)
}

export function normalizeAudioBytes(bytes, mimeType = '') {
  if (isWav(bytes) || /wav/i.test(mimeType)) {
    return { bytes: isWav(bytes) ? bytes : bytes, mime: 'audio/wav' }
  }
  if (/L16|pcm/i.test(mimeType) || !isWav(bytes)) {
    return { bytes: pcmToWavBytes(bytes), mime: 'audio/wav' }
  }
  return { bytes, mime: mimeType || 'audio/wav' }
}

export async function synthesizeSpeech(apiKey, text) {
  const clean = text.trim()
  if (!clean) throw new Error('Nothing to speak')

  let lastError

  for (const model of TTS_MODELS) {
    try {
      const json = await geminiGenerateContent(apiKey, model, {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: clean,
                speech_metadata: { style: LUCY_SPEECH_STYLE },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { voice: LUCY_VOICE },
          },
        },
      })

      const part = json?.candidates?.[0]?.content?.parts?.[0]
      const b64 = part?.inlineData?.data ?? part?.inline_data?.data
      const mime =
        part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? 'audio/wav'
      if (!b64) throw new Error('TTS returned no audio')

      const raw = Buffer.from(b64, 'base64')
      const normalized = normalizeAudioBytes(new Uint8Array(raw), mime)
      return {
        bytes: Buffer.from(normalized.bytes),
        mime: normalized.mime,
        model,
        usage: json?.usageMetadata || {},
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('TTS failed')
}

/**
 * Connect /api/* handlers to a Connect-style middleware stack (Vite or Node http).
 * @param {() => string} getApiKey
 */
export function createGeminiMiddleware(getApiKey) {
  return async function geminiMiddleware(req, res, next) {
    const url = new URL(req.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) {
      if (typeof next === 'function') return next()
      res.statusCode = 404
      res.end('Not found')
      return
    }

    // CORS not needed for same-origin Vite app; keep simple.
    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }

      const apiKey = getApiKey()

      if (url.pathname === '/api/status' && req.method === 'GET') {
        sendJson(res, 200, { configured: Boolean(apiKey) })
        return
      }

      if (!apiKey) {
        sendJson(res, 503, {
          error: 'Missing Gemini API key. Add GEMINI_API_KEY to your .env file.',
        })
        return
      }

      if (url.pathname === '/api/warm' && req.method === 'POST') {
        await warmConnection(apiKey)
        sendJson(res, 200, { ok: true })
        return
      }

      if (url.pathname === '/api/generate' && req.method === 'POST') {
        const body = await readJsonBody(req)
        if (!body?.prompt || !body?.systemInstruction) {
          sendJson(res, 400, { error: 'prompt and systemInstruction are required' })
          return
        }
        const result = await generateText(apiKey, body)
        sendJson(res, 200, result)
        return
      }

      if (url.pathname === '/api/tts' && req.method === 'POST') {
        const body = await readJsonBody(req)
        const text = typeof body?.text === 'string' ? body.text : ''
        const result = await synthesizeSpeech(apiKey, text)
        res.statusCode = 200
        res.setHeader('Content-Type', result.mime)
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Speakora-TTS-Model', result.model)
        res.end(result.bytes)
        return
      }

      sendJson(res, 404, { error: 'Unknown API route' })
    } catch (err) {
      sendJson(res, 502, { error: errorMessage(err) || 'Gemini proxy error' })
    }
  }
}
