import { useCallback, useEffect, useRef, useState } from 'react'
import { synthesizeLucySpeech } from '../lib/lucyVoice'

function pickBrowserVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  const pool = english.length ? english : voices
  return (
    pool.find((v) => /Microsoft (Aria|Jenny|Zira)/i.test(v.name) && !/Online/i.test(v.name)) ??
    pool.find((v) => /Google US English/i.test(v.name)) ??
    pool.find((v) => /en-US/i.test(v.lang)) ??
    pool[0]
  )
}

/**
 * Gemini TTS (Aoede) for warm, clear Lucy.
 * Browser voice only as emergency fallback.
 */
export function useLucyVoice() {
  const [speaking, setSpeaking] = useState(false)
  const [supported] = useState(typeof window !== 'undefined')
  const generationRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const browserVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const cleanupHtmlAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const closeAudioCtx = useCallback(() => {
    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (!ctx || ctx.state === 'closed') return
    try {
      void ctx.close()
    } catch {
      /* already closed */
    }
  }, [])

  useEffect(() => {
    if (window.speechSynthesis) {
      const load = () => {
        browserVoiceRef.current = pickBrowserVoice(window.speechSynthesis.getVoices())
      }
      load()
      window.speechSynthesis.addEventListener('voiceschanged', load)
      return () => {
        generationRef.current += 1
        cleanupHtmlAudio()
        window.speechSynthesis.cancel()
        window.speechSynthesis.removeEventListener('voiceschanged', load)
        closeAudioCtx()
      }
    }
    return () => {
      generationRef.current += 1
      cleanupHtmlAudio()
      closeAudioCtx()
    }
  }, [cleanupHtmlAudio, closeAudioCtx])

  const cancel = useCallback(() => {
    generationRef.current += 1
    cleanupHtmlAudio()
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [cleanupHtmlAudio])

  const unlock = useCallback(async () => {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctx) {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new Ctx()
      }
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume()
      const ctx = audioCtxRef.current
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
    }
    if (window.speechSynthesis) {
      browserVoiceRef.current = pickBrowserVoice(window.speechSynthesis.getVoices())
    }
  }, [])

  const speakBrowser = useCallback((text: string, generation: number) => {
    return new Promise<void>((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('No browser voice'))
        return
      }
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      // Slightly slower for beginners
      utter.rate = 0.95
      utter.pitch = 1.05
      utter.volume = 1
      utter.lang = browserVoiceRef.current?.lang || 'en-US'
      if (browserVoiceRef.current) utter.voice = browserVoiceRef.current

      let started = false
      const t = window.setTimeout(() => {
        if (!started) {
          window.speechSynthesis.cancel()
          reject(new Error('Browser voice timeout'))
        }
      }, 3000)

      utter.onstart = () => {
        started = true
        window.clearTimeout(t)
        if (generationRef.current === generation) setSpeaking(true)
      }
      utter.onend = () => {
        window.clearTimeout(t)
        if (generationRef.current === generation) setSpeaking(false)
        if (started) resolve()
        else reject(new Error('Browser voice silent'))
      }
      utter.onerror = () => {
        window.clearTimeout(t)
        if (generationRef.current === generation) setSpeaking(false)
        reject(new Error('Browser voice error'))
      }
      window.speechSynthesis.speak(utter)
    })
  }, [])

  const speak = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean) return

      generationRef.current += 1
      const generation = generationRef.current
      cleanupHtmlAudio()
      window.speechSynthesis?.cancel()
      setSpeaking(true)

      try {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume()
        }

        const blob = await synthesizeLucySpeech(clean)
        if (generationRef.current !== generation) return

        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        const audio = new Audio(url)
        audio.playbackRate = 1
        audio.preload = 'auto'
        audioRef.current = audio

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve()
          audio.onerror = () => reject(new Error('Audio playback failed'))
          void audio.play().catch(reject)
        })
      } catch (err) {
        console.warn('Gemini TTS failed, using browser voice', err)
        if (generationRef.current !== generation) return
        await speakBrowser(clean, generation)
      } finally {
        if (generationRef.current === generation) {
          cleanupHtmlAudio()
          setSpeaking(false)
        }
      }
    },
    [cleanupHtmlAudio, speakBrowser],
  )

  return { supported, speaking, speak, cancel, unlock }
}
