'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type RecordedAudio = {
  blob: Blob
  mimeType: string
  base64: string
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x2000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function useMicRecorder() {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const mimeRef = useRef('')
  const stopResolveRef = useRef<((audio: RecordedAudio | null) => void) | null>(null)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined',
    )
    return () => {
      try {
        recorderRef.current?.stop()
      } catch {
        /* ignore */
      }
      releaseStream()
    }
  }, [releaseStream])

  const start = useCallback(async () => {
    setError(null)
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser. Try Chrome or Edge.')
      return false
    }

    try {
      const previous = recorderRef.current
      recorderRef.current = null
      stopResolveRef.current = null
      if (previous && previous.state !== 'inactive') {
        previous.ondataavailable = null
        previous.onstop = null
        try {
          previous.stop()
        } catch {
          /* ignore */
        }
      }
      releaseStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = pickMimeType()
      mimeRef.current = mimeType
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      recorder.onerror = () => {
        setError('Microphone recording failed. Check mic permissions and try again.')
        setRecording(false)
        const resolve = stopResolveRef.current
        stopResolveRef.current = null
        resolve?.(null)
        releaseStream()
      }

      recorder.onstop = () => {
        const resolve = stopResolveRef.current
        stopResolveRef.current = null
        setRecording(false)
        const type = mimeRef.current.split(';')[0] || recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        releaseStream()

        if (!resolve) return
        if (!blob.size) {
          resolve(null)
          return
        }
        void blobToBase64(blob)
          .then((base64) => resolve({ blob, mimeType: type, base64 }))
          .catch(() => resolve(null))
      }

      // One file for the whole take. A timeslice splits the WebM so the transcriber
      // often only reads the first few seconds.
      recorder.start()
      setRecording(true)
      return true
    } catch {
      setError('Microphone permission blocked. Allow mic access and try again.')
      setRecording(false)
      releaseStream()
      return false
    }
  }, [releaseStream])

  const stop = useCallback((): Promise<RecordedAudio | null> => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      releaseStream()
      setRecording(false)
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      stopResolveRef.current = resolve
      try {
        if (recorder.state === 'recording') {
          try {
            recorder.requestData()
          } catch {
            /* flush is optional; stop still returns the full file */
          }
        }
        recorder.stop()
      } catch {
        stopResolveRef.current = null
        releaseStream()
        setRecording(false)
        resolve(null)
      }
    })
  }, [releaseStream])

  const abort = useCallback(() => {
    stopResolveRef.current = null
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
    } catch {
      /* ignore */
    }
    recorderRef.current = null
    chunksRef.current = []
    releaseStream()
    setRecording(false)
  }, [releaseStream])

  return { supported, recording, error, start, stop, abort }
}
