'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '../components/AppShell'
import { fetchScores, type ScoresData, type SkillScores } from '../lib/progress'

const SKILLS: Array<{
  key: keyof SkillScores
  label: string
  box: string
  ring: string
}> = [
  { key: 'clarity', label: 'Fluency', box: 'lime', ring: 'lime' },
  { key: 'accuracy', label: 'Accuracy', box: 'pink', ring: 'pink' },
  { key: 'pronunciation', label: 'Pronunciation', box: 'lilac', ring: 'lilac' },
  { key: 'completeness', label: 'Completeness', box: 'lilac-soft', ring: 'lilac' },
]

function formatScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function averageOverall(overall: SkillScores) {
  const vals = SKILLS.map((s) => overall[s.key]).filter(
    (v): v is number => v != null && Number.isFinite(v),
  )
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

function SkillIcon({ name }: { name: keyof SkillScores }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'clarity':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20V8" />
        </svg>
      )
    case 'accuracy':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'pronunciation':
      return (
        <svg {...common}>
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
      )
    case 'completeness':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    default:
      return null
  }
}

function CircleScore({
  label,
  value,
  tone,
  size = 'md',
}: {
  label: string
  value: number | null | undefined
  tone: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const n = value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(5, value))
  const dim = size === 'lg' ? 128 : size === 'sm' ? 78 : 104
  const stroke = size === 'lg' ? 9 : size === 'sm' ? 6 : 8
  const radius = (dim - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - n / 5)

  return (
    <div
      className={`yp-score-circle ${tone} is-${size}`}
      role="img"
      aria-label={`${label} ${formatScore(value)} out of 5`}
    >
      <svg viewBox={`0 0 ${dim} ${dim}`} aria-hidden>
        <circle
          className="yp-score-circle-track"
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="yp-score-circle-fill"
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
        />
      </svg>
      <div className="yp-score-circle-center">
        <strong>{formatScore(value)}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

export function ScoresPage() {
  const [data, setData] = useState<ScoresData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const next = await fetchScores()
        if (!cancelled) setData(next)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load scores')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const avg = useMemo(() => (data ? averageOverall(data.overall) : null), [data])
  const doneCount = data?.lessons.filter((l) => l.completed).length || 0

  return (
    <AppShell title="Scores">
      <div className="yp-scores yp-scores-edu">
        <header className="yp-scores-top">
          <div>
            <h1>
              Your speaking <em className="s">scores</em>
            </h1>
            <p>
              Track fluency, accuracy, pronunciation and completeness — then open a full lesson
              report.
            </p>
          </div>
          {data && (
            <div className="yp-scores-top-stats" aria-label="Score summary">
              <div className="yp-scores-pill lime">
                <strong>{formatScore(avg)}</strong>
                <span>Avg /5</span>
              </div>
              <div className="yp-scores-pill lilac">
                <strong>{data.lessonsScored}</strong>
                <span>Scored</span>
              </div>
              <div className="yp-scores-pill pink">
                <strong>{doneCount}</strong>
                <span>Done</span>
              </div>
            </div>
          )}
        </header>

        {loading && <p className="yp-loading">Loading your scores…</p>}
        {error && <p className="yp-status error">{error}</p>}

        {data && (
          <div className="yp-scores-body">
            <section className="yp-scores-overall" aria-label="Overall skill scores">
              <div className="yp-scores-overall-layout">
                <div className="yp-scores-hero-ring">
                  <CircleScore label="Overall" value={avg} tone="lime" size="lg" />
                  <p>
                    {data.lessonsScored > 0
                      ? `Across ${data.lessonsScored} lesson${data.lessonsScored === 1 ? '' : 's'}`
                      : 'No lessons scored yet'}
                  </p>
                </div>
                <ul className="yp-scores-overall-grid" aria-label="Skill breakdown">
                  {SKILLS.map((skill) => (
                    <li key={skill.key} className={`yp-scores-stat ${skill.box}`}>
                      <span className="yp-scores-stat-icon">
                        <SkillIcon name={skill.key} />
                      </span>
                      <div className="yp-scores-stat-copy">
                        <strong>
                          {formatScore(data.overall[skill.key])}
                          <em>/5</em>
                        </strong>
                        <span>{skill.label}</span>
                      </div>
                      <div className="yp-scores-stat-bar" aria-hidden>
                        <span
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, ((data.overall[skill.key] || 0) / 5) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="yp-scores-lessons" aria-label="Scores by lesson">
              <div className="yp-dash-block-head">
                <h2>By lesson</h2>
                <Link href="/lessons">Browse lessons</Link>
              </div>

              {data.lessons.length === 0 ? (
                <div className="yp-scores-empty">
                  <p>No scored lessons yet. Finish a practice call to unlock your first report.</p>
                  <Link href="/lessons" className="yp-btn yp-btn-main">
                    Start Lesson 1
                  </Link>
                </div>
              ) : (
                <ul className="yp-scores-lesson-list">
                  {data.lessons.map((lesson, i) => {
                    const tone = SKILLS[i % SKILLS.length].box
                    return (
                      <li key={lesson.lessonId} className={`yp-scores-lesson tone-${tone}`}>
                        <div className="yp-scores-lesson-info">
                          <span className="yp-scores-lesson-num">
                            Lesson {lesson.lessonNumber}
                            {lesson.completed ? ' · Done' : ''}
                          </span>
                          <h3>{lesson.title}</h3>
                          <span className="yp-scores-lesson-sub">
                            {lesson.attempts} attempt{lesson.attempts === 1 ? '' : 's'}
                            {lesson.hasDetailedReport ? ' · full report ready' : ''}
                          </span>
                        </div>

                        <ul className="yp-scores-lesson-skills">
                          {SKILLS.map((skill) => (
                            <li key={skill.key}>
                              <CircleScore
                                label={skill.label}
                                value={lesson.bestScores?.[skill.key] ?? null}
                                tone={skill.ring}
                                size="sm"
                              />
                            </li>
                          ))}
                        </ul>

                        <div className="yp-scores-lesson-meta">
                          {lesson.bestOverall != null ? (
                            <strong>
                              {formatScore(lesson.bestOverall)}
                              <em>/5 best</em>
                            </strong>
                          ) : (
                            <strong>
                              —<em> best</em>
                            </strong>
                          )}
                          <div className="yp-scores-lesson-actions">
                            <Link
                              href={`/scores/${lesson.lessonId}`}
                              className="yp-btn yp-btn-soft yp-scores-report-link"
                            >
                              View report
                            </Link>
                            <Link
                              href={`/practice/${lesson.lessonId}`}
                              className="yp-btn yp-btn-main yp-scores-retry"
                            >
                              Practise again
                            </Link>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  )
}
