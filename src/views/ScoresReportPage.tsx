'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '../components/AppShell'
import { DetailedLessonReportView } from '../components/DetailedLessonReport'
import {
  isDetailedLessonReport,
  type DetailedLessonReport,
} from '../lib/detailedReport'
import { fetchLessonReport, type LessonReportResponse } from '../lib/progress'

export function ScoresReportPage() {
  const params = useParams<{ lessonId: string }>()
  const lessonId = params?.lessonId ?? ''
  const router = useRouter()
  const [meta, setMeta] = useState<LessonReportResponse | null>(null)
  const [report, setReport] = useState<DetailedLessonReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!lessonId) {
      router.replace('/scores')
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchLessonReport(lessonId)
        if (cancelled) return
        if (!isDetailedLessonReport(data.report)) {
          setError('Detailed report is not available for this lesson yet.')
          return
        }
        setMeta(data)
        setReport(data.report)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load lesson report')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lessonId, router])

  const minutes =
    meta?.durationMs != null ? Math.max(1, Math.round(meta.durationMs / 60000)) : null

  return (
    <AppShell title="Lesson report">
      <div className="yp-scores-report">
        <div className="yp-scores-report-bar">
          <Link href="/scores" className="yp-btn yp-btn-soft">
            ← Scores
          </Link>
          {meta ? (
            <Link href={`/practice/${meta.lessonId}`} className="yp-btn yp-btn-main">
              Practise again
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="dlr-loading" role="status">
            <div className="dlr-loading-pulse" aria-hidden />
            <p>
              <strong>Loading your detailed report…</strong>
              <span>Pulling fluency, vocabulary, grammar, and pronunciation notes.</span>
            </p>
          </div>
        ) : null}

        {error ? <p className="yp-status error">{error}</p> : null}

        {meta && report ? (
          <>
            <header className="yp-scores-report-head">
              <div className="yp-scores-report-title">
                <span className="yp-tag pink">Lesson {meta.lessonNumber}</span>
                <h1>{meta.lessonTitle}</h1>
                <p>Full speaking breakdown from your best saved attempt.</p>
              </div>
              <ul className="yp-report-meta">
                {minutes != null ? (
                  <li>
                    <strong>{minutes}</strong>
                    <span>min spoken</span>
                  </li>
                ) : null}
                <li>
                  <strong>{meta.turns}</strong>
                  <span>turns</span>
                </li>
                <li>
                  <strong>{meta.corrections}</strong>
                  <span>corrections</span>
                </li>
                {meta.overall != null ? (
                  <li className="is-overall">
                    <strong>{meta.overall.toFixed(1)}</strong>
                    <span>overall /5</span>
                  </li>
                ) : null}
              </ul>
            </header>
            <DetailedLessonReportView report={report} />
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
