import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly [index: number]: { transcript: string; confidence: number }
  readonly length: number
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface SpeechResult {
  transcript: string
  confidence: number
}

export interface StartListeningOptions {
  onActivity?: () => void
}

export function useSpeechRecognition() {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [liveFinal, setLiveFinal] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const resolveRef = useRef<((r: SpeechResult | null) => void) | null>(null)
  const settledRef = useRef(false)
  const finalTextRef = useRef('')
  const confidenceRef = useRef(0)
  const confCountRef = useRef(0)
  const confSumRef = useRef(0)
  const wantListenRef = useRef(false)
  const onActivityRef = useRef<(() => void) | null>(null)
  const restartTimerRef = useRef<number | null>(null)
  const stopFallbackRef = useRef<number | null>(null)

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()))
    return () => {
      wantListenRef.current = false
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
      if (stopFallbackRef.current) window.clearTimeout(stopFallbackRef.current)
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const clearRestart = () => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }

  const settle = useCallback((result: SpeechResult | null) => {
    if (settledRef.current) return
    settledRef.current = true
    clearRestart()
    if (stopFallbackRef.current) {
      window.clearTimeout(stopFallbackRef.current)
      stopFallbackRef.current = null
    }
    wantListenRef.current = false
    setListening(false)
    setInterim('')
    const resolver = resolveRef.current
    resolveRef.current = null
    resolver?.(result)
  }, [])

  const snapshot = () => {
    const text = finalTextRef.current.trim()
    const conf =
      confCountRef.current > 0 ? confSumRef.current / confCountRef.current : confidenceRef.current
    return text ? { transcript: text, confidence: conf || 0.7 } : null
  }

  const stop = useCallback(() => {
    clearRestart()
    wantListenRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    if (stopFallbackRef.current) window.clearTimeout(stopFallbackRef.current)
    stopFallbackRef.current = window.setTimeout(() => {
      settle(snapshot())
    }, 500)
  }, [settle])

  const abort = useCallback(() => {
    clearRestart()
    wantListenRef.current = false
    try {
      recognitionRef.current?.abort()
    } catch {
      /* ignore */
    }
    setListening(false)
    setInterim('')
    settle(null)
  }, [settle])

  const attachHandlers = useCallback(
    (recognition: SpeechRecognitionLike) => {
      recognition.onresult = (event) => {
        let interimText = ''
        let gotSpeech = false

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const piece = result[0]
          if (!piece?.transcript) continue
          gotSpeech = true
          if (result.isFinal) {
            finalTextRef.current += piece.transcript
            if (typeof piece.confidence === 'number' && piece.confidence > 0) {
              confSumRef.current += piece.confidence
              confCountRef.current += 1
              confidenceRef.current = confSumRef.current / confCountRef.current
            }
          } else {
            interimText += piece.transcript
          }
        }

        if (gotSpeech) onActivityRef.current?.()
        setLiveFinal(finalTextRef.current)
        setInterim(interimText)
      }

      recognition.onerror = (ev) => {
        if (ev.error === 'aborted' || ev.error === 'no-speech') return
        setError(
          ev.error === 'not-allowed'
            ? 'Microphone permission blocked. Allow mic access and try again.'
            : `Mic error: ${ev.error}`,
        )
        if (ev.error === 'not-allowed') settle(null)
      }

      recognition.onend = () => {
        if (wantListenRef.current) {
          clearRestart()
          restartTimerRef.current = window.setTimeout(() => {
            if (!wantListenRef.current || !recognitionRef.current) return
            try {
              recognitionRef.current.start()
              setListening(true)
            } catch {
              /* already started */
            }
          }, 180)
          return
        }
        settle(snapshot())
      }
    },
    [settle],
  )

  const start = useCallback(
    (options?: StartListeningOptions): Promise<SpeechResult | null> => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) {
        setError('Speech recognition is not supported in this browser. Try Chrome or Edge.')
        return Promise.resolve(null)
      }

      clearRestart()
      if (stopFallbackRef.current) {
        window.clearTimeout(stopFallbackRef.current)
        stopFallbackRef.current = null
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          /* ignore */
        }
      }

      return new Promise((resolve) => {
        resolveRef.current = resolve
        settledRef.current = false
        finalTextRef.current = ''
        confidenceRef.current = 0
        confSumRef.current = 0
        confCountRef.current = 0
        onActivityRef.current = options?.onActivity ?? null
        wantListenRef.current = true
        setError(null)
        setInterim('')
        setLiveFinal('')

        const recognition = new Ctor()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognitionRef.current = recognition
        attachHandlers(recognition)

        try {
          recognition.start()
          setListening(true)
        } catch {
          setError('Could not start the microphone. Refresh and try again.')
          wantListenRef.current = false
          resolveRef.current = null
          settledRef.current = true
          resolve(null)
        }
      })
    },
    [attachHandlers],
  )

  return {
    supported,
    listening,
    interim,
    liveFinal,
    error,
    start,
    stop,
    abort,
  }
}
