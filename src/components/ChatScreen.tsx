'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, Topic } from '../types'
import { converseTurn, friendlyApiError, warmGemini } from '../lib/gemini'
import { getPracticeContext } from '../lib/practiceContext'
import type { ResumeLecture } from '../lib/progress'
import type { Level } from '../lib/storage'
import type { RawSessionStats, TrackedMistake } from '../lib/scoring'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useLucyVoice } from '../hooks/useLucyVoice'

/** Max times the learner is asked to repeat one corrected sentence. */
const MAX_PRACTICE_TRIES = 3

export type CallSessionStats = RawSessionStats & {
  sessionId?: string | null
  transcript?: Array<{
    role: 'user' | 'coach'
    text: string
    turnIndex?: number
    correction?: boolean
  }>
}

interface Props {
  level: Level
  topic: Topic
  onBack: () => void
  onCallStart?: () => Promise<
    string | { sessionId: string; resume?: ResumeLecture | null } | void
  > | string | { sessionId: string; resume?: ResumeLecture | null } | void
  onSessionEnd?: (stats: CallSessionStats) => void | Promise<void>
}

/** Each lesson call may last at most 30 minutes. Learner can hang up earlier. */
const MAX_CALL_MS = 30 * 60 * 1000

function silenceForLevel(level: Level) {
  switch (level) {
    case 'beginner':
      return 2800
    case 'advanced':
      return 1800
    default:
      return 2200
  }
}

const MAX_LISTEN_MS = 90_000

type CallPhase = 'ready' | 'lucy' | 'your-turn' | 'listening' | 'thinking' | 'paused' | 'error'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatClock(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ChatScreen({ level, topic, onBack, onCallStart, onSessionEnd }: Props) {
  const silenceMs = silenceForLevel(level)
  const [phase, setPhase] = useState<CallPhase>('ready')
  const [hint, setHint] = useState('Tap Start call — Yappy will speak first')
  const [starting, setStarting] = useState(false)
  const [inPractice, setInPractice] = useState(false)
  const [practiceAttempt, setPracticeAttempt] = useState(0)
  const [streak, setStreak] = useState(0)
  const [remainingMs, setRemainingMs] = useState(MAX_CALL_MS)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: uid(), role: 'coach', text: topic.starter },
  ])

  const historyRef = useRef<ChatMessage[]>(messages)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const listenPromiseRef = useRef<Promise<{ transcript: string; confidence: number } | null> | null>(
    null,
  )
  const lastSpeechAtRef = useRef(0)
  const listenStartedAtRef = useRef(0)
  const autoStoppingRef = useRef(false)
  const processingRef = useRef(false)
  const sessionAliveRef = useRef(true)
  const pausedRef = useRef(false)
  const startListeningRef = useRef<() => void>(() => {})
  const callStartedRef = useRef(false)
  const practiceTargetRef = useRef<string | null>(null)
  const practiceAttemptsRef = useRef(0)
  const remainingRef = useRef(MAX_CALL_MS)
  const deadlineRef = useRef<number | null>(null)
  const endingForTimeRef = useRef(false)
  const statsRef = useRef({
    turns: 0,
    corrections: 0,
    practiceSuccesses: 0,
    maxStreak: 0,
    reported: false,
    confidences: [] as number[],
    mistakes: [] as TrackedMistake[],
    practiceExhausted: 0,
  })
  const onSessionEndRef = useRef(onSessionEnd)
  onSessionEndRef.current = onSessionEnd
  const onCallStartRef = useRef(onCallStart)
  onCallStartRef.current = onCallStart
  const sessionIdRef = useRef<string | null>(null)

  const speech = useSpeechRecognition()
  const lucy = useLucyVoice()

  useEffect(() => {
    sessionAliveRef.current = true
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      sessionAliveRef.current = false
      lucy.cancel()
      speech.abort()
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    historyRef.current = messages
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, speech.interim])

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg]
      historyRef.current = next
      return next
    })
  }, [])

  const resetMessages = useCallback((starter: string) => {
    const first: ChatMessage = { id: uid(), role: 'coach', text: starter }
    historyRef.current = [first]
    setMessages([first])
  }, [])

  const clearCallTimer = useCallback(() => {
    deadlineRef.current = null
    remainingRef.current = MAX_CALL_MS
    setRemainingMs(MAX_CALL_MS)
  }, [])

  const reportAndLeave = useCallback(
    async (endedReason: CallSessionStats['endedReason']) => {
      const hadCall = callStartedRef.current
      if (!statsRef.current.reported && hadCall) {
        statsRef.current.reported = true
        const durationMs = Math.max(0, MAX_CALL_MS - remainingRef.current)
        const stats: CallSessionStats = {
          durationMs,
          turns: statsRef.current.turns,
          corrections: statsRef.current.corrections,
          practiceSuccesses: statsRef.current.practiceSuccesses,
          maxStreak: statsRef.current.maxStreak,
          completed: durationMs >= 28 * 60 * 1000 || endedReason === 'timeup',
          endedReason,
          confidences: [...statsRef.current.confidences],
          mistakes: [...statsRef.current.mistakes],
          practiceExhausted: statsRef.current.practiceExhausted,
          sessionId: sessionIdRef.current || getPracticeContext().sessionId,
          transcript: historyRef.current.map((m, i) => ({
            role: m.role === 'user' ? 'user' : 'coach',
            text: m.text,
            turnIndex: i,
            correction: false,
          })),
        }
        sessionAliveRef.current = false
        pausedRef.current = false
        callStartedRef.current = false
        processingRef.current = false
        endingForTimeRef.current = false
        deadlineRef.current = null
        lucy.cancel()
        speech.abort()
        listenPromiseRef.current = null
        try {
          await onSessionEndRef.current?.(stats)
          return
        } catch (err) {
          console.warn(err)
        }
      }
      sessionAliveRef.current = false
      pausedRef.current = false
      callStartedRef.current = false
      processingRef.current = false
      endingForTimeRef.current = false
      deadlineRef.current = null
      lucy.cancel()
      speech.abort()
      listenPromiseRef.current = null
      onBack()
    },
    [lucy, onBack, speech],
  )

  const endCall = useCallback(() => {
    void reportAndLeave('hangup')
  }, [reportAndLeave])

  const hangUpForTime = useCallback(async () => {
    if (endingForTimeRef.current || !sessionAliveRef.current) return
    endingForTimeRef.current = true
    pausedRef.current = true
    deadlineRef.current = null
    remainingRef.current = 0
    setRemainingMs(0)
    speech.abort()
    listenPromiseRef.current = null
    processingRef.current = false
    setPhase('lucy')
    setHint('Time is up — goodbye')
    const goodbye =
      'Our thirty minutes are finished. Thank you for practicing with me today. Goodbye!'
    pushMessage({ id: uid(), role: 'coach', text: goodbye })
    try {
      await lucy.speak(goodbye)
    } catch {
      /* ignore */
    }
    await reportAndLeave('timeup')
  }, [reportAndLeave, lucy, pushMessage, speech])

  // Live countdown while call is active (pauses when call is paused)
  useEffect(() => {
    const callLive =
      phase !== 'ready' && phase !== 'error' && callStartedRef.current && !endingForTimeRef.current
    if (!callLive || phase === 'paused') return

    const tick = window.setInterval(() => {
      if (!deadlineRef.current) return
      const left = deadlineRef.current - Date.now()
      remainingRef.current = Math.max(0, left)
      setRemainingMs(remainingRef.current)
      if (left <= 0) void hangUpForTime()
    }, 250)

    return () => window.clearInterval(tick)
  }, [phase, hangUpForTime])

  const startListening = useCallback(() => {
    if (!sessionAliveRef.current || pausedRef.current) return
    if (!speech.supported || processingRef.current) return
    if (speech.listening) return

    lucy.cancel()
    autoStoppingRef.current = false
    lastSpeechAtRef.current = 0
    listenStartedAtRef.current = Date.now()
    setPhase('listening')
    setHint(
      practiceTargetRef.current
        ? `Say this: “${practiceTargetRef.current}” — tap mic when done`
        : 'Your turn — take your time, then tap the mic when finished',
    )
    listenPromiseRef.current = speech.start({
      onActivity: () => {
        lastSpeechAtRef.current = Date.now()
      },
    })
  }, [speech, lucy])

  startListeningRef.current = startListening

  const pauseCall = useCallback(() => {
    if (phase === 'ready' || phase === 'error' || phase === 'paused') return
    pausedRef.current = true
    if (deadlineRef.current) {
      remainingRef.current = Math.max(0, deadlineRef.current - Date.now())
      deadlineRef.current = null
      setRemainingMs(remainingRef.current)
    }
    lucy.cancel()
    speech.abort()
    listenPromiseRef.current = null
    autoStoppingRef.current = false
    processingRef.current = false
    setPhase('paused')
    setHint('Call paused — tap Resume when you are ready')
  }, [lucy, phase, speech])

  const resumeCall = useCallback(() => {
    if (phase !== 'paused') return
    if (remainingRef.current <= 0) {
      void hangUpForTime()
      return
    }
    pausedRef.current = false
    deadlineRef.current = Date.now() + remainingRef.current
    setPhase('your-turn')
    setHint(
      practiceTargetRef.current
        ? `Resume practice: “${practiceTargetRef.current}” — tap mic when done`
        : 'Resumed — your turn. Tap mic and speak',
    )
    window.setTimeout(() => {
      if (sessionAliveRef.current && !pausedRef.current) startListeningRef.current()
    }, 150)
  }, [phase, hangUpForTime])

  const lucySpeak = useCallback(
    async (text: string, afterHint?: string) => {
      if (!sessionAliveRef.current || pausedRef.current) return
      setPhase('lucy')
      setHint('Yappy is speaking — listen')
      try {
        await lucy.speak(text)
      } catch (err) {
        console.error(err)
        setHint('Voice glitch — keep going, your turn')
      }
      if (!sessionAliveRef.current || pausedRef.current) return
      setPhase('your-turn')
      setHint(
        afterHint ??
          (practiceTargetRef.current
            ? 'Now repeat the corrected sentence — tap mic when done'
            : 'Your turn — speak, then tap mic when finished'),
      )
      window.setTimeout(() => {
        if (sessionAliveRef.current && !pausedRef.current) startListeningRef.current()
      }, 150)
    },
    [lucy],
  )

  const beginCall = useCallback(async () => {
    if (callStartedRef.current || starting) return
    callStartedRef.current = true
    pausedRef.current = false
    sessionAliveRef.current = true
    endingForTimeRef.current = false
    setStarting(true)
    setHint('Yappy is joining…')
    practiceTargetRef.current = null
    practiceAttemptsRef.current = 0
    setInPractice(false)
    setPracticeAttempt(0)
    sessionIdRef.current = null

    try {
      let resume: ResumeLecture | null = null
      if (onCallStartRef.current) {
        const started = await onCallStartRef.current()
        if (typeof started === 'string') sessionIdRef.current = started
        else if (started && typeof started === 'object') {
          sessionIdRef.current = started.sessionId
          resume = started.resume || null
        }
      }

      const elapsed = Math.min(MAX_CALL_MS, Math.max(0, resume?.durationMs || 0))
      const remaining = Math.max(0, MAX_CALL_MS - elapsed)
      remainingRef.current = remaining
      deadlineRef.current = Date.now() + remaining
      setRemainingMs(remaining)
      setStreak(resume?.maxStreak || 0)
      statsRef.current = {
        turns: resume?.turns || 0,
        corrections: resume?.corrections || 0,
        practiceSuccesses: resume?.practiceSuccesses || 0,
        maxStreak: resume?.maxStreak || 0,
        reported: false,
        confidences: [],
        mistakes: [],
        practiceExhausted: 0,
      }

      const prior = (resume?.transcript || []).filter((turn) => turn.text?.trim())
      if (prior.length) {
        const restored: ChatMessage[] = prior.map((turn) => ({
          id: uid(),
          role: turn.role === 'user' ? 'user' : 'coach',
          text: turn.text,
        }))
        historyRef.current = restored
        setMessages(restored)
      } else {
        resetMessages(topic.starter)
      }

      await Promise.all([lucy.unlock(), warmGemini()])
      if (!sessionAliveRef.current || pausedRef.current) return
      if (remaining <= 1000) {
        setStarting(false)
        void hangUpForTime()
        return
      }
      setStarting(false)
      const greeting = prior.length
        ? "Welcome back. Let's continue this lesson where we left off."
        : topic.starter
      if (prior.length) pushMessage({ id: uid(), role: 'coach', text: greeting })
      await lucySpeak(greeting)
    } catch (err) {
      setStarting(false)
      callStartedRef.current = false
      if (pausedRef.current) return
      const msg = err instanceof Error ? err.message : 'Could not start call'
      setPhase('error')
      setHint(msg)
      window.setTimeout(() => {
        if (sessionAliveRef.current && !pausedRef.current) {
          setPhase('ready')
          setHint('Tap Start call — Yappy will speak first')
        }
      }, 2500)
    }
  }, [hangUpForTime, lucy, lucySpeak, pushMessage, resetMessages, starting, topic.starter])

  const sendUserTurn = useCallback(
    async (transcript: string, confidence?: number) => {
      const text = transcript.trim()
      if (!text || processingRef.current) return
      processingRef.current = true

      const userMsg: ChatMessage = { id: uid(), role: 'user', text, confidence }
      pushMessage(userMsg)
      statsRef.current.turns += 1
      if (typeof confidence === 'number') {
        statsRef.current.confidences.push(confidence)
        if (confidence < 0.7) {
          statsRef.current.mistakes.push({
            type: confidence < 0.55 ? 'pronunciation' : 'unclear',
            summary:
              confidence < 0.55
                ? 'Pronunciation was hard to catch'
                : 'Speech was a little unclear',
            heard: text,
          })
        }
      }
      setPhase('thinking')
      setHint(practiceTargetRef.current ? 'Checking your practice…' : 'Yappy…')

      try {
        let response = await converseTurn({
          topic,
          level,
          messages: historyRef.current,
          userText: text,
          confidence,
          practiceTarget: practiceTargetRef.current,
          practiceAttempts: practiceAttemptsRef.current,
          elapsedMs: Math.max(0, MAX_CALL_MS - remainingRef.current),
        })

        if (response.mode === 'practice') {
          const target = response.correctedSentence || practiceTargetRef.current
          if (!target) {
            response = {
              ...response,
              mode: 'chat',
              correctedSentence: null,
              hadCorrection: false,
            }
          } else {
            const nextAttempts = practiceTargetRef.current
              ? practiceAttemptsRef.current + 1
              : 1

            // After 3 user tries on the same sentence, continue the lesson (do not stay stuck)
            if (nextAttempts > MAX_PRACTICE_TRIES) {
              statsRef.current.practiceExhausted += 1
              if (!practiceTargetRef.current) {
                statsRef.current.corrections += 1
              }
              statsRef.current.mistakes.push({
                type: 'grammar',
                summary: 'Could not fix after 3 tries — continued lesson',
                heard: text,
                expected: target,
              })
              response = {
                reply: `Good try. Listen once more: ${target} Okay — let's continue. Tell me one more simple detail about ${topic.title}.`,
                mode: 'chat',
                correctedSentence: null,
                hadCorrection: false,
              }
              practiceTargetRef.current = null
              practiceAttemptsRef.current = 0
              setInPractice(false)
              setPracticeAttempt(0)
            } else {
              response = { ...response, correctedSentence: target, hadCorrection: true }
              if (!practiceTargetRef.current) {
                statsRef.current.corrections += 1
                statsRef.current.mistakes.push({
                  type: 'grammar',
                  summary: 'Grammar or sentence structure needed a fix',
                  heard: text,
                  expected: target,
                })
              }
              practiceAttemptsRef.current = nextAttempts
              practiceTargetRef.current = target
              setInPractice(true)
              setPracticeAttempt(nextAttempts)
            }
          }
        }

        if (response.mode === 'chat') {
          if (practiceTargetRef.current) {
            statsRef.current.practiceSuccesses += 1
            setStreak((s) => {
              const next = s + 1
              statsRef.current.maxStreak = Math.max(statsRef.current.maxStreak, next)
              return next
            })
          } else if (!response.hadCorrection) {
            setStreak((s) => {
              const next = s + 1
              statsRef.current.maxStreak = Math.max(statsRef.current.maxStreak, next)
              return next
            })
          } else {
            setStreak(0)
          }
          practiceTargetRef.current = null
          practiceAttemptsRef.current = 0
          setInPractice(false)
          setPracticeAttempt(0)
        }

        const coachMsg: ChatMessage = { id: uid(), role: 'coach', text: response.reply }
        pushMessage(coachMsg)
        processingRef.current = false

        const afterHint =
          response.mode === 'practice' && response.correctedSentence
            ? `Repeat: “${response.correctedSentence}” — tap mic when done`
            : undefined

        setHint(
          response.mode === 'practice'
            ? 'Listen — then repeat the correct sentence'
            : streak + 1 > 1
              ? 'Nice work — keep going'
              : 'Yappy…',
        )
        if (!pausedRef.current) await lucySpeak(response.reply, afterHint)
      } catch (err) {
        console.error(err)
        processingRef.current = false
        if (pausedRef.current || !sessionAliveRef.current) return
        try {
          setPhase('lucy')
          setHint('Yappy wants another try…')
          await lucy.speak('Sorry. Small problem. Please say that again. I am here with you.')
          if (sessionAliveRef.current && !pausedRef.current) {
            setPhase('your-turn')
            startListeningRef.current()
          }
        } catch {
          if (pausedRef.current) return
          setPhase('error')
          setHint(friendlyApiError(err))
          callStartedRef.current = false
          clearCallTimer()
        }
      }
    },
    [level, topic, lucySpeak, lucy, streak, pushMessage, clearCallTimer],
  )

  const finishListening = useCallback(
    async (reason: 'manual' | 'silence' | 'timeout') => {
      if (pausedRef.current) return
      if (!speech.listening && !listenPromiseRef.current) return
      if (autoStoppingRef.current && reason !== 'manual') return

      if (reason !== 'manual') autoStoppingRef.current = true
      setPhase('thinking')
      setHint(reason === 'timeout' ? 'Wrapping that up…' : 'Got it…')
      speech.stop()

      const result = await (listenPromiseRef.current ?? Promise.resolve(null))
      listenPromiseRef.current = null
      autoStoppingRef.current = false

      if (pausedRef.current || !sessionAliveRef.current) return

      if (!result?.transcript) {
        setPhase('your-turn')
        setHint('I did not catch that — try once more!')
        try {
          await lucy.speak('Sorry, I missed that. Please say it one more time.')
        } catch {
          /* ignore */
        }
        if (pausedRef.current) return
        window.setTimeout(() => {
          if (sessionAliveRef.current && !pausedRef.current && !processingRef.current) {
            startListeningRef.current()
          }
        }, 400)
        return
      }

      await sendUserTurn(result.transcript, result.confidence)
    },
    [sendUserTurn, speech, lucy],
  )

  useEffect(() => {
    if (!speech.listening) return

    const tick = window.setInterval(() => {
      if (!speech.listening || processingRef.current || autoStoppingRef.current) return

      const now = Date.now()
      if (now - listenStartedAtRef.current > MAX_LISTEN_MS) {
        void finishListening('timeout')
        return
      }

      const spoken = (speech.liveFinal + speech.interim).trim()
      if (!spoken || !lastSpeechAtRef.current) return

      const gap = now - lastSpeechAtRef.current
      if (gap >= silenceMs) {
        void finishListening('silence')
      }
    }, 200)

    return () => window.clearInterval(tick)
  }, [speech.listening, speech.liveFinal, speech.interim, finishListening, silenceMs])

  async function toggleMic() {
    if (phase === 'ready' || phase === 'lucy' || phase === 'thinking' || phase === 'paused') return
    if (!speech.supported) return

    if (speech.listening) {
      await finishListening('manual')
      return
    }

    startListening()
  }

  const callActive = phase !== 'ready' && phase !== 'error'
  const isPaused = phase === 'paused'
  const timerLow = remainingMs <= 5 * 60 * 1000 && callActive

  const phaseClass =
    phase === 'lucy'
      ? 'phase-lucy'
      : phase === 'listening' || phase === 'your-turn'
        ? 'phase-you'
        : phase === 'thinking'
          ? 'phase-think'
          : phase === 'paused'
            ? 'phase-paused'
            : phase === 'ready'
              ? 'phase-ready'
              : 'phase-error'

  return (
    <div className={`yp-app screen call-screen ${phaseClass}`}>
      <header className="call-top">
        <button type="button" className="btn ghost call-hangup" onClick={endCall}>
          <span aria-hidden>☎</span> Hang up
        </button>
        <div className="call-topic-wrap">
          <p className="call-lesson">Lesson {topic.number}</p>
          <p className="call-topic">{topic.title}</p>
        </div>
        <div className="call-meta-right">
          {callActive && (
            <span
              className={`call-timer ${timerLow ? 'low' : ''}`}
              title="Maximum 30 minutes per call"
            >
              {formatClock(remainingMs)}
            </span>
          )}
          {streak > 1 && <span className="streak-mini">🔥 {streak}</span>}
          <span className="call-live" aria-hidden>
            {phase === 'ready' ? '· ready' : isPaused ? '· paused' : '· live'}
          </span>
        </div>
      </header>

      <div className="call-body">
        <div className="call-main">
          <div className="call-stage">
            <div className={`lucy-orb ${phase}`} aria-hidden>
              <span className="orb-core" />
              <span className="orb-ring r1" />
              <span className="orb-ring r2" />
              <span className="orb-ring r3" />
            </div>

            <p className="call-who">
              {phase === 'listening' || phase === 'your-turn' ? 'You' : 'Yappy'}
            </p>
            <p className="call-hint" aria-live="polite">
              {speech.error ?? hint}
            </p>

            {inPractice && practiceTargetRef.current && (
              <p className="practice-banner">
                Practice ({practiceAttempt}/{MAX_PRACTICE_TRIES}): “{practiceTargetRef.current}”
              </p>
            )}

            {topic.agenda && topic.agenda.length > 0 && (
              <ul className="agenda-chips" aria-label="Introduction checklist">
                {topic.agenda.map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            )}

            {(phase === 'listening' || phase === 'your-turn') && (
              <div className="voice-bars" aria-hidden>
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            )}
          </div>

          <div className="call-controls">
            {phase === 'ready' || phase === 'error' ? (
              <>
                <button
                  type="button"
                  className="btn primary start-call-btn"
                  disabled={starting}
                  onClick={() => {
                    callStartedRef.current = false
                    void beginCall()
                  }}
                >
                  {starting
                    ? 'Yappy is joining…'
                    : phase === 'error'
                      ? 'Try again — Yappy speaks first'
                      : 'Start call — Yappy speaks first'}
                </button>
                <p className="mic-hint">
                  Up to 30 minutes. Hang up early and you can resume this lecture with the time left.
                </p>
              </>
            ) : (
              <>
                {!speech.supported && (
                  <p className="form-error">
                    Use Chrome or Edge with a microphone for this voice call.
                  </p>
                )}
                <div className="call-actions" role="group" aria-label="Call controls">
                  {isPaused ? (
                    <button type="button" className="btn primary call-action" onClick={resumeCall}>
                      Resume
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost call-action"
                      onClick={pauseCall}
                      disabled={!callActive || phase === 'thinking'}
                    >
                      Pause
                    </button>
                  )}
                  <button
                    type="button"
                    className={`mic-btn call-mic ${speech.listening ? 'hot' : ''} ${
                      phase === 'thinking' || phase === 'lucy' || isPaused ? 'disabled' : ''
                    }`}
                    disabled={
                      phase === 'thinking' || phase === 'lucy' || isPaused || !speech.supported
                    }
                    onClick={() => void toggleMic()}
                    aria-label={speech.listening ? 'I finished speaking' : 'Speak now'}
                  >
                    <span className="mic-ring" aria-hidden />
                    <span className="mic-icon" aria-hidden>
                      {isPaused ? '⏸' : speech.listening ? '▮▮' : '🎙️'}
                    </span>
                  </button>
                  <button type="button" className="btn ghost call-action danger" onClick={endCall}>
                    Hang up
                  </button>
                </div>

                <p className="mic-hint">
                  {isPaused
                    ? 'Paused — Resume to continue, or Hang up to leave'
                    : phase === 'lucy'
                      ? 'Listen — Yappy is talking'
                      : phase === 'listening'
                        ? inPractice
                          ? 'Repeat the sentence — tap mic when done'
                          : `Speak freely — tap mic when finished (or pause ~${Math.round(silenceMs / 1000)}s)`
                        : phase === 'thinking'
                          ? 'One moment…'
                          : 'Tap mic to speak'}
                </p>
              </>
            )}
          </div>
        </div>

        <aside className="call-transcript" aria-label="Conversation">
          <p className="transcript-label">Conversation</p>
          <div className="messages call-messages">
            {messages.map((m) => (
              <article key={m.id} className={`bubble ${m.role}`}>
                <span className="who">{m.role === 'coach' ? 'Yappy' : 'You'}</span>
                <p>{m.text}</p>
                {m.role === 'user' && typeof m.confidence === 'number' && (
                  <span className="conf">{Math.round(m.confidence * 100)}% clear</span>
                )}
              </article>
            ))}
            {speech.listening && speech.interim.trim() && (
              <article className="bubble user interim">
                <span className="who">You</span>
                <p>{speech.interim}</p>
              </article>
            )}
            <div ref={messagesEndRef} />
          </div>
        </aside>
      </div>
    </div>
  )
}
