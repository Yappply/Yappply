'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMicRecorder } from '../../hooks/useMicRecorder'

const TOPICS = [
  'Describe your perfect weekend',
  'Talk about a person who inspires you',
  'What would you do with one extra hour every day?',
  'Convince me to visit your city',
  'Describe your dream job',
  'Tell me about a mistake you learned from',
  'Is social media good or bad for students?',
  "What's the best advice you've ever received?",
  'Describe a festival you love',
  'If you could live anywhere, where would it be?',
]

type MachineState = 'idle' | 'spun' | 'prep' | 'speak' | 'think' | 'result'

export type FreeTestReport = {
  overall: number
  level: string
  strength: string
  fixFirst: string
  fillers: string[]
  paceWpm: number
  answered: boolean
  answeredNote: string
  structure: {
    point: boolean
    reason: boolean
    example: boolean
    ending: boolean
  }
  structureNote: string
  grammarFixes: Array<{ heard: string; better: string }>
  strongerWords: Array<{ weak: string; stronger: string }>
  rewritten: string
  watchTip: string
  pitch: string
  transcript?: string
}

const RING = 327
const ORDER = ['spin', 'prep', 'speak', 'report'] as const
const STEP_OF: Record<MachineState, (typeof ORDER)[number]> = {
  idle: 'spin',
  spun: 'spin',
  prep: 'prep',
  speak: 'speak',
  think: 'report',
  result: 'report',
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderTranscriptWithFillers(text: string, fillers: string[]): ReactNode {
  const speech = String(text || '').trim()
  if (!speech) {
    return <em>We didn&apos;t catch any words — try again closer to the mic.</em>
  }
  const list = (fillers || []).map((f) => f.trim()).filter(Boolean)
  if (!list.length) return speech

  const pattern = new RegExp(`\\b(${list.map(escapeRegExp).join('|')})\\b`, 'gi')
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(speech))) {
    if (match.index > last) nodes.push(speech.slice(last, match.index))
    nodes.push(<mark key={`f-${key++}`}>{match[0]}</mark>)
    last = match.index + match[0].length
  }
  if (last < speech.length) nodes.push(speech.slice(last))
  return nodes
}

function paceBarWidth(wpm: number) {
  // Natural range ~120–150; map 0–200 → 0–100%
  return `${Math.max(4, Math.min(100, Math.round((wpm / 200) * 100)))}%`
}

function scoreDash(overall: number) {
  const circ = 2 * Math.PI * 50
  const filled = (Math.max(0, Math.min(100, overall)) / 100) * circ
  return `${filled} ${circ}`
}

export function FreeSpeakingTest() {
  const machineRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const topicRef = useRef(TOPICS[0])
  const durationRef = useRef(60)
  const minuteDoneRef = useRef(false)
  const evaluatingRef = useRef(false)

  const mic = useMicRecorder()
  const micRef = useRef(mic)
  useEffect(() => {
    micRef.current = mic
  })

  const [state, setState] = useState<MachineState>('idle')
  const [micStarting, setMicStarting] = useState(false)
  const [idx, setIdx] = useState(0)
  const [topicNow, setTopicNow] = useState('Pull the lever to get your topic')
  const [topicPrev, setTopicPrev] = useState(TOPICS[TOPICS.length - 1])
  const [topicNext, setTopicNext] = useState(TOPICS[1])
  const [spinning, setSpinning] = useState(false)
  const [pulled, setPulled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [prepLeft, setPrepLeft] = useState(15)
  const [speakLeft, setSpeakLeft] = useState(60)
  const [locked, setLocked] = useState(true)
  const [gateVisible, setGateVisible] = useState(true)
  const [email, setEmail] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [savingLead, setSavingLead] = useState(false)
  const [report, setReport] = useState<FreeTestReport | null>(null)
  const [transcript, setTranscript] = useState('')
  const [evalError, setEvalError] = useState('')
  const [triesLeft, setTriesLeft] = useState<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  useEffect(() => {
    let cancel = false
    fetch('/api/free-test/allowance')
      .then((res) => res.json())
      .then((data) => {
        if (!cancel && Number.isFinite(Number(data?.remaining))) {
          setTriesLeft(Number(data.remaining))
        }
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  const stepIndex = useMemo(() => ORDER.indexOf(STEP_OF[state]), [state])

  const showTopic = useCallback((i: number) => {
    setIdx(i)
    setTopicNow(TOPICS[i])
    topicRef.current = TOPICS[i]
    setTopicPrev(TOPICS[(i + TOPICS.length - 1) % TOPICS.length])
    setTopicNext(TOPICS[(i + 1) % TOPICS.length])
  }, [])

  const pick = useCallback(() => {
    let n: number
    do {
      n = Math.floor(Math.random() * TOPICS.length)
    } while (n === idx && TOPICS.length > 1)
    return n
  }, [idx])

  const spin = useCallback(() => {
    if (busy || triesLeft === 0) return
    setBusy(true)
    setPulled(true)
    setTimeout(() => setPulled(false), 450)
    const final = pick()
    if (prefersReducedMotion()) {
      showTopic(final)
      setBusy(false)
      setState('spun')
      return
    }
    setSpinning(true)
    let k = 0
    const iv = setInterval(() => {
      showTopic(Math.floor(Math.random() * TOPICS.length))
      k += 1
      if (k > 14) {
        clearInterval(iv)
        setSpinning(false)
        showTopic(final)
        setBusy(false)
        setState('spun')
      }
    }, 70)
  }, [busy, pick, showTopic, triesLeft])

  const countdown = useCallback(
    (total: number, setter: (n: number) => void, onEnd: () => void) => {
      clearTimer()
      let left = total
      setter(left)
      timerRef.current = setInterval(() => {
        left -= 1
        setter(Math.max(left, 0))
        if (left <= 0) {
          clearTimer()
          onEnd()
        }
      }, 1000)
    },
    [clearTimer],
  )

  const finishSpeaking = useCallback(async () => {
    if (evaluatingRef.current || !minuteDoneRef.current) return
    evaluatingRef.current = true
    clearTimer()
    setMicStarting(false)
    setState('think')
    setEvalError('')
    setReport(null)

    durationRef.current = 60

    let audio: Awaited<ReturnType<typeof micRef.current.stop>> = null
    try {
      audio = await micRef.current.stop()
    } catch {
      audio = null
    }

    if (!audio?.base64) {
      setEvalError('We could not capture your audio. Allow the microphone and try again.')
      setTranscript('')
      setLocked(true)
      setGateVisible(true)
      setEmail('')
      setEmailErr('')
      setState('result')
      evaluatingRef.current = false
      return
    }

    try {
      const res = await fetch('/api/free-test/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicRef.current,
          durationSec: 60,
          audioBase64: audio.base64,
          mimeType: audio.mimeType,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) setTriesLeft(0)
        throw new Error(data?.error || 'Could not build your report')
      }
      const heard = String(data.transcript || data.report?.transcript || '').trim()
      setTranscript(heard)
      setReport(data.report as FreeTestReport)
      if (Number.isFinite(Number(data?.remaining))) setTriesLeft(Number(data.remaining))
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Could not build your report')
    } finally {
      setLocked(true)
      setGateVisible(true)
      setEmail('')
      setEmailErr('')
      setState('result')
      evaluatingRef.current = false
    }
  }, [clearTimer])

  const speak = useCallback(() => {
    if (triesLeft === 0) return
    clearTimer()
    setState('speak')
    setSpeakLeft(60)
    setTranscript('')
    setReport(null)
    setEvalError('')
    evaluatingRef.current = false
    minuteDoneRef.current = false
    setMicStarting(true)
    void micRef.current.start().then((ok) => {
      setMicStarting(false)
      if (!ok) return
      countdown(60, setSpeakLeft, () => {
        minuteDoneRef.current = true
        void finishSpeaking()
      })
    })
  }, [clearTimer, countdown, finishSpeaking, triesLeft])

  const prep = useCallback(() => {
    setState('prep')
    setPrepLeft(15)
    countdown(15, setPrepLeft, speak)
  }, [countdown, speak])

  const onGateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const v = email.trim().toLowerCase()
    if (!v) {
      setEmailErr('Enter your email to unlock the report.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      setEmailErr("That email doesn't look right. Check it and try again.")
      return
    }
    setSavingLead(true)
    setEmailErr('')
    try {
      const res = await fetch('/api/free-test/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: v,
          topic: topicRef.current,
          transcript,
          durationSec: durationRef.current,
          report,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not save your email')
      setLocked(false)
      setGateVisible(false)
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Could not save your email')
    } finally {
      setSavingLead(false)
    }
  }

  const canSpin = state === 'idle' || state === 'spun'
  const displayTranscript = transcript || report?.transcript || ''
  const fillers = report?.fillers || []
  const overall = report?.overall ?? 0
  const structure = report?.structure || { point: false, reason: false, example: false, ending: false }
  const micLive = mic.recording || micStarting

  return (
    <section className="section test" id="test">
      <div className="wrap">
        <div className="head center">
          <span className="pill dot">Free · 60 seconds · No signup to start</span>
          <h2>
            How good is your English, <em className="s">really?</em>
          </h2>
          <p>Spin a topic. Talk for a minute. Yappy tells you what you nailed and what to fix.</p>
          {triesLeft === 0 ? (
            <p className="err" role="status">
              You&apos;ve used both free tests on this browser. Start daily practice to keep going.
            </p>
          ) : triesLeft === 1 ? (
            <p>1 free test left on this browser.</p>
          ) : null}
        </div>

        <ol className="tsteps" aria-label="Test steps">
          {(
            [
              {
                key: 'spin',
                label: 'Spin',
                icon: (
                  <svg viewBox="0 0 48 48">
                    <path d="M24 6v20" stroke="#16151F" strokeWidth="3.5" strokeLinecap="round" />
                    <circle cx="24" cy="8" r="6" fill="#FF8CC6" stroke="#16151F" strokeWidth="3" />
                    <ellipse
                      cx="24"
                      cy="38"
                      rx="14"
                      ry="5"
                      fill="#fff"
                      stroke="#16151F"
                      strokeWidth="3"
                    />
                  </svg>
                ),
              },
              {
                key: 'prep',
                label: 'Think 15s',
                icon: (
                  <svg viewBox="0 0 48 48">
                    <circle cx="24" cy="26" r="16" fill="#fff" stroke="#16151F" strokeWidth="3.5" />
                    <path
                      d="M24 17v9l6 4M19 6h10"
                      stroke="#16151F"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ),
              },
              {
                key: 'speak',
                label: 'Speak 60s',
                icon: (
                  <svg viewBox="0 0 48 48">
                    <rect
                      x="17"
                      y="5"
                      width="14"
                      height="24"
                      rx="7"
                      fill="#C9B8FF"
                      stroke="#16151F"
                      strokeWidth="3"
                    />
                    <path
                      d="M11 22a13 13 0 0 0 26 0M24 35v7"
                      fill="none"
                      stroke="#16151F"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ),
              },
              {
                key: 'report',
                label: 'Get report',
                icon: (
                  <svg viewBox="0 0 48 48">
                    <rect
                      x="10"
                      y="5"
                      width="28"
                      height="38"
                      rx="6"
                      fill="#DDF55B"
                      stroke="#16151F"
                      strokeWidth="3"
                    />
                    <path
                      d="M16 14h16M16 21h10"
                      stroke="#16151F"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M17 33l4 4 9-9"
                      fill="none"
                      stroke="#16151F"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
              },
            ] as const
          ).map((step, i) => (
            <li
              key={step.key}
              className={`${i === stepIndex ? 'on' : ''} ${i < stepIndex ? 'done' : ''}`.trim()}
            >
              <span className="tico" aria-hidden>
                {step.icon}
              </span>
              <b>{step.label}</b>
            </li>
          ))}
        </ol>

        <div className="machine" id="machine" ref={machineRef} data-state={state}>
          <div className="holes" aria-hidden />
          <div className="m-top">
            <span className="m-title">
              Today&apos;s <em className="s">challenge</em>
            </span>
            <span className="pill">Random topic</span>
          </div>

          <div className="m-body">
            <div className={`slot${spinning ? ' spinning' : ''}`} aria-live="polite">
              <div className="slot-row ghost">{topicPrev}</div>
              <div className="slot-row now">{topicNow}</div>
              <div className="slot-row ghost">{topicNext}</div>
            </div>
            <button
              type="button"
              className={`lever${pulled ? ' pulled' : ''}`}
              aria-label="Pull the lever to get a random topic"
              onClick={() => {
                if (canSpin) spin()
              }}
            >
              <span className="lever-hint" aria-hidden>
                pull me!
              </span>
              <svg viewBox="0 0 60 150" aria-hidden>
                <rect
                  x="27"
                  y="40"
                  width="6"
                  height="80"
                  rx="3"
                  fill="#16151F"
                  className="stick"
                />
                <circle
                  cx="30"
                  cy="34"
                  r="20"
                  fill="#FF8CC6"
                  stroke="#16151F"
                  strokeWidth="4"
                  className="knob"
                />
                <circle cx="24" cy="28" r="5" fill="#fff" opacity="0.8" className="knob" />
                <ellipse
                  cx="30"
                  cy="128"
                  rx="24"
                  ry="9"
                  fill="#C9B8FF"
                  stroke="#16151F"
                  strokeWidth="4"
                />
              </svg>
            </button>
          </div>

          <div className="panel p-idle">
            <button type="button" className="btn btn-lime" onClick={spin}>
              Spin a topic
            </button>
          </div>

          <div className="panel p-spun">
            <button type="button" className="btn btn-ink" onClick={prep}>
              I&apos;m ready, start
            </button>
            <button type="button" className="btn btn-white" onClick={spin}>
              Spin again
            </button>
          </div>

          <div className="panel p-prep">
            <div className="timer">
              <svg viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#EEE8FF" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#C9B8FF"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - prepLeft / 15)}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <span>{prepLeft}</span>
            </div>
            <div className="t-copy">
              <b>Think it through</b>
              <span>Recording starts automatically.</span>
            </div>
            <button
              type="button"
              className="btn btn-white"
              onClick={() => {
                clearTimer()
                speak()
              }}
            >
              Skip, I&apos;m ready
            </button>
          </div>

          <div className="panel p-speak">
            <div className="timer rec">
              <svg viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#FFE3F1" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#FF8CC6"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - speakLeft / 60)}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <span>{speakLeft}</span>
            </div>
            <div className="live">
              <b>
                <span className="rec-dot" aria-hidden />
                {micLive ? 'Recording, speak now' : 'Starting microphone…'}
              </b>
              <div className="eq" aria-hidden>
                {Array.from({ length: 14 }).map((_, i) => (
                  <i key={i} />
                ))}
              </div>
              <p className="live-caption">
                Yappy listens for the full minute. You can&apos;t stop early — the report uses the whole
                60 seconds.
              </p>
              {mic.error ? (
                <p className="err" role="alert">
                  {mic.error}
                </p>
              ) : null}
              {!mic.supported ? (
                <p className="err" role="alert">
                  Microphone recording needs Chrome or Edge with mic permission.
                </p>
              ) : null}
            </div>
            {mic.error && !mic.recording && !micStarting ? (
              <button type="button" className="btn btn-ink" onClick={speak}>
                Try the microphone again
              </button>
            ) : (
              <p className="live-caption">Keep speaking until the timer reaches 0.</p>
            )}
          </div>

          <div className="panel p-think">
            <svg className="think-yappy" viewBox="0 0 300 330" aria-hidden>
              <use href="#yappy" />
            </svg>
            <div className="t-copy">
              <b>Yappy is listening back…</b>
              <span>Transcribing your speech, then checking grammar, vocabulary, pace and structure.</span>
            </div>
            <div className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className="panel p-result">
            {evalError ? (
              <p className="err" role="alert">
                {evalError}
              </p>
            ) : null}

            <div className="quick">
              <div className="q-score">
                <svg viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#EEE8FF" strokeWidth="12" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#16151F"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={scoreDash(overall)}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <span>
                  <b>{report ? overall : '—'}</b>
                  <small>overall</small>
                </span>
              </div>
              <div className="q-chip lvl">
                <small>Your level</small>
                <b>{report?.level || '—'}</b>
              </div>
              <div className="q-chip good">
                <small>Strength</small>
                <b>{report?.strength || '—'}</b>
              </div>
              <div className="q-chip fix">
                <small>Fix first</small>
                <b>{report?.fixFirst || '—'}</b>
              </div>
            </div>

            {gateVisible ? (
              <form className="gate" onSubmit={onGateSubmit} noValidate>
                <div className="gate-txt">
                  <b>Your full report is ready</b>
                  <span>Enter your email to unlock all sections.</span>
                </div>
                <div className="gate-row">
                  <label className="sr" htmlFor="landing-test-email">
                    Email address
                  </label>
                  <input
                    id="landing-test-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setEmailErr('')
                    }}
                  />
                  <button className="btn btn-lime" type="submit" disabled={savingLead || !report}>
                    {savingLead ? 'Saving…' : 'Unlock my report'}
                  </button>
                </div>
                <p className="err" role="alert">
                  {emailErr}
                </p>
              </form>
            ) : null}

            <div className={`full${locked ? ' locked' : ''}`}>
              <div className="lockveil" aria-hidden>
                <svg viewBox="0 0 48 48">
                  <rect
                    x="10"
                    y="21"
                    width="28"
                    height="22"
                    rx="6"
                    fill="#DDF55B"
                    stroke="#16151F"
                    strokeWidth="3"
                  />
                  <path
                    d="M16 21v-6a8 8 0 0 1 16 0v6"
                    fill="none"
                    stroke="#16151F"
                    strokeWidth="3.5"
                  />
                </svg>
              </div>
              <div className="rgrid">
                <article className="rcard wide">
                  <h4>
                    Transcript <span>fillers marked</span>
                  </h4>
                  <p className="tr">{renderTranscriptWithFillers(displayTranscript, fillers)}</p>
                </article>
                <article className="rcard">
                  <h4>Pace</h4>
                  <div className="metric">
                    {report?.paceWpm ?? '—'} <small>words/min</small>
                  </div>
                  <div className="bar">
                    <i style={{ width: paceBarWidth(report?.paceWpm || 0) }} />
                  </div>
                  <small className="note">
                    {report
                      ? report.paceWpm >= 120 && report.paceWpm <= 150
                        ? 'In the natural range of 120–150.'
                        : report.paceWpm > 150
                          ? 'Faster than the natural 120–150.'
                          : 'Slower than the natural 120–150.'
                      : 'Natural pace is 120–150.'}
                  </small>
                </article>
                <article className="rcard">
                  <h4>Did you answer it?</h4>
                  <div className="metric">{report ? (report.answered ? 'Yes' : 'Not really') : '—'}</div>
                  <small className="note">{report?.answeredNote || ''}</small>
                </article>
                <article className="rcard">
                  <h4>Structure</h4>
                  <div className="prep">
                    <span className={structure.point ? 'ok' : 'no'}>Point</span>
                    <span className={structure.reason ? 'ok' : 'no'}>Reason</span>
                    <span className={structure.example ? 'ok' : 'no'}>Example</span>
                    <span className={structure.ending ? 'ok' : 'no'}>Ending</span>
                  </div>
                  <small className="note">{report?.structureNote || ''}</small>
                </article>
                <article className="rcard">
                  <h4>Grammar fixes</h4>
                  {(report?.grammarFixes || []).length ? (
                    report!.grammarFixes.map((g) => (
                      <p className="fixline" key={`${g.heard}-${g.better}`}>
                        <s>{g.heard}</s> → <b>{g.better}</b>
                      </p>
                    ))
                  ) : (
                    <small className="note">No clear grammar fixes from this take.</small>
                  )}
                </article>
                <article className="rcard">
                  <h4>Stronger words</h4>
                  {(report?.strongerWords || []).length ? (
                    report!.strongerWords.map((s) => (
                      <div className="swap" key={`${s.weak}-${s.stronger}`}>
                        <span>{s.weak}</span>→<b>{s.stronger}</b>
                      </div>
                    ))
                  ) : (
                    <small className="note">Your wording was already solid.</small>
                  )}
                </article>
                <article className="rcard wide">
                  <h4>Your answer, rewritten</h4>
                  <p className="rw">
                    {report?.rewritten ? `“${report.rewritten}”` : '—'}
                  </p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
