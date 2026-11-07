'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { TOPICS } from '../data/topics'
import { DetailedLessonReportView } from '../components/DetailedLessonReport'
import {
  buildHeuristicDetailedReport,
  isDetailedLessonReport,
  type DetailedLessonReport,
  type StoredLessonResultPayload,
} from '../lib/detailedReport'
import { evaluatePracticeSession } from '../lib/progress'

export function ResultsPage() {
  const params = useParams<{ lessonId: string }>()
  const lessonId = params?.lessonId ?? ''
  const router = useRouter()
  const topic = TOPICS.find((t) => t.id === lessonId)
  const [payload, setPayload] = useState<StoredLessonResultPayload | null>(null)
  const [report, setReport] = useState<DetailedLessonReport | null>(null)
  const [ready, setReady] = useState(false)
  const [evaluating, setEvaluating] = useState(true)
  const [evalNote, setEvalNote] = useState<string | null>(null)

  useEffect(() => {
    if (!topic) {
      router.replace('/lessons')
      return
    }
    try {
      const raw = sessionStorage.getItem(`yappply-result:${topic.id}`)
      if (!raw) {
        router.replace(`/practice/${topic.id}`)
        return
      }
      const parsed = JSON.parse(raw) as StoredLessonResultPayload
      if (parsed.lessonId !== topic.id) {
        router.replace(`/practice/${topic.id}`)
        return
      }
      setPayload(parsed)
      if (isDetailedLessonReport(parsed.detailedReport)) {
        setReport(parsed.detailedReport)
        setEvaluating(false)
      }
    } catch {
      router.replace(`/practice/${topic.id}`)
    } finally {
      setReady(true)
    }
  }, [topic, router])

  useEffect(() => {
    if (!payload || !topic || report) return

    const snap = payload
    const topicId = topic.id
    let cancelled = false

    async function run() {
      setEvaluating(true)
      setEvalNote(null)
      try {
        const { report: aiReport } = await evaluatePracticeSession({
          sessionId: snap.sessionId,
          lessonId: snap.lessonId,
          lessonNumber: snap.lessonNumber,
          lessonTitle: snap.lessonTitle,
          transcript: snap.transcript,
          confidences: snap.confidences,
          topMistakes: snap.topMistakes,
          scores: snap.scores,
          overall: snap.overall,
        })
        if (cancelled) return
        if (isDetailedLessonReport(aiReport)) {
          setReport(aiReport)
          const next: StoredLessonResultPayload = { ...snap, detailedReport: aiReport }
          setPayload(next)
          try {
            sessionStorage.setItem(`yappply-result:${topicId}`, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return
        }
      } catch (err) {
        console.warn('Detailed evaluation unavailable', err)
        if (!cancelled) {
          setEvalNote('Showing a local detailed report while AI scoring is unavailable.')
        }
      }

      if (cancelled) return
      const fallback = buildHeuristicDetailedReport(snap)
      setReport(fallback)
      const next: StoredLessonResultPayload = { ...snap, detailedReport: fallback }
      setPayload(next)
      try {
        sessionStorage.setItem(`yappply-result:${topicId}`, JSON.stringify(next))
      } catch {
        /* ignore */
      }
    }

    void run().finally(() => {
      if (!cancelled) setEvaluating(false)
    })

    return () => {
      cancelled = true
    }
  }, [payload, topic, report])

  if (!topic || !ready || !payload) return null

  const minutes = Math.max(1, Math.round(payload.durationMs / 60000))

  return (
    <div className="yp-app results-page results-page--detailed">
      <header className="results-top yp-scores-report-head">
        <div className="yp-scores-report-title">
          <span className="yp-tag pink">Lesson {payload.lessonNumber} complete</span>
          <h1>{payload.lessonTitle}</h1>
          <p>
            {payload.endedReason === 'timeup'
              ? 'Your 30 minutes are up. Here is your full speaking report.'
              : 'You ended the call. Here is your full speaking report.'}
          </p>
        </div>
        <ul className="yp-report-meta">
          <li>
            <strong>{minutes}</strong>
            <span>min spoken</span>
          </li>
          <li>
            <strong>{payload.turns}</strong>
            <span>turns</span>
          </li>
          <li>
            <strong>{payload.corrections}</strong>
            <span>corrections</span>
          </li>
          <li className="is-overall">
            <strong>{payload.maxStreak}</strong>
            <span>best streak</span>
          </li>
        </ul>
      </header>

      {evaluating && !report ? (
        <div className="dlr-loading" role="status">
          <div className="dlr-loading-pulse" aria-hidden />
          <p>
            <strong>Building your detailed report…</strong>
            <span>Analyzing fluency, vocabulary, grammar, and pronunciation.</span>
          </p>
        </div>
      ) : null}

      {evalNote ? <p className="dlr-eval-note">{evalNote}</p> : null}

      {report ? <DetailedLessonReportView report={report} /> : null}

      <div className="results-actions">
        <Link href="/dashboard" className="btn primary">
          Dashboard
        </Link>
        <Link href="/lessons" className="btn ghost">
          Lessons
        </Link>
      </div>
    </div>
  )
}
