import { authHeaders } from './api'
import { getPracticeContext } from './practiceContext'

/**
 * Lucy TTS via the local `/api/tts` proxy (Gemini key stays on the server).
 * Server returns playable WAV bytes (PCM is normalized server-side).
 */
export async function synthesizeLucySpeech(text: string): Promise<Blob> {
  const clean = text.trim()
  if (!clean) throw new Error('Nothing to speak')

  const practice = getPracticeContext()
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      text: clean,
      sessionId: practice.sessionId,
      lessonId: practice.lessonId,
      turnIndex: practice.turnIndex,
    }),
  })

  if (!res.ok) {
    let detail = `TTS HTTP ${res.status}`
    try {
      const json = (await res.json()) as { error?: string }
      if (json.error) detail = json.error
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }

  const mime = res.headers.get('Content-Type') || 'audio/wav'
  const buffer = await res.arrayBuffer()
  if (!buffer.byteLength) throw new Error('TTS returned no audio')
  return new Blob([buffer], { type: mime })
}
