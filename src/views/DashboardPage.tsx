'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { isTrialAccount } from '../lib/trial'
import { fetchDashboard, type DashboardData } from '../lib/progress'
import { isLessonNumberUnlocked } from '../lib/lessonAccess'
import { TOPICS } from '../data/topics'
import { AppShell } from '../components/AppShell'
import { PracticeLimitModal, limitModalCopy } from '../components/PracticeLimitModal'
import { YappyMark } from '../components/YappyMark'

function daysRemaining(iso?: string) {
  if (!iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)))
}

function sessionScore(s: DashboardData['recentSessions'][number]) {
  if (s.overall != null && Number.isFinite(s.overall)) return Math.round(s.overall)
  if (s.turns > 0) {
    return Math.max(0, Math.round((1 - s.corrections / Math.max(s.turns, 1)) * 100))
  }
  return null
}

function formatMinutes(mins: number) {
  if (!Number.isFinite(mins) || mins <= 0) return '0 min'
  if (mins < 60) return `${Math.round(mins)} min`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m ? `${h}h ${m} min` : `${h}h`
}

function ProgressRing({ value, tone = 'lime' }: { value: number; tone?: 'lime' | 'lilac' | 'pink' }) {
  const pct = Math.max(0, Math.min(100, value))
  const r = 18
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className={`yp-progress-ring tone-${tone}`} aria-label={`${pct}% complete`}>
      <svg viewBox="0 0 44 44" aria-hidden>
        <circle className="track" cx="22" cy="22" r={r} />
        <circle
          className="value"
          cx="22"
          cy="22"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <strong>{pct}%</strong>
    </div>
  )
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Local YYYY-MM-DD for a calendar cell — matches streak / practice day keys */
function localDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function localTodayKey() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function buildCalendar(base: Date, practiced: Set<string>) {
  const year = base.getFullYear()
  const month = base.getMonth()
  const first = new Date(year, month, 1)
  const startPad = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = localTodayKey()
  const cells: Array<{
    day: number | null
    dateKey: string | null
    isToday: boolean
    practiced: boolean
  }> = []
  for (let i = 0; i < startPad; i++) {
    cells.push({ day: null, dateKey: null, isToday: false, practiced: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = localDateKey(year, month, d)
    cells.push({
      day: d,
      dateKey,
      isToday: dateKey === todayKey,
      practiced: practiced.has(dateKey),
    })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateKey: null, isToday: false, practiced: false })
  }
  return {
    year,
    month,
    label: first.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    cells,
  }
}

const COURSE_TONES = ['peach', 'lime', 'lilac'] as const

export function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [gate, setGate] = useState<{
    title: string
    message: string
    unlocksAt?: string | null
  } | null>(null)
  const [calCursor, setCalCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  function openPractice(lessonId: string, lessonNumber: number) {
    const unlocked = isLessonNumberUnlocked(lessonNumber, data)
    if (!unlocked) {
      const waiting =
        data?.lessonAccess?.waitingForTomorrow &&
        data.lessonAccess.nextLessonNumber === lessonNumber
      const copy = limitModalCopy(waiting ? 'lesson_locked_until_tomorrow' : 'lesson_locked')
      setGate({ ...copy, unlocksAt: data?.lessonAccess?.unlocksAt || null })
      return
    }
    const resumableHere = data?.resumable?.lessonId === lessonId
    if ((data?.stats.practicedToday || data?.lessonAccess?.practicedToday) && !resumableHere) {
      const copy = limitModalCopy('sessions_day')
      setGate({ ...copy, unlocksAt: data?.lessonAccess?.unlocksAt || null })
      return
    }
    router.push(`/practice/${lessonId}`)
  }

  useEffect(() => {
    let cancelled = false
    void fetchDashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const completedIds = new Set(
    (data?.lessonStats || []).filter((l) => l.completed).map((l) => l.lessonId),
  )
  const nextLessonNumber = data?.lessonAccess?.nextLessonNumber || 1
  const nextIndex = Math.max(
    0,
    TOPICS.findIndex((t) => t.number === nextLessonNumber),
  )
  const nextLesson = TOPICS[nextIndex] || TOPICS[0]
  const firstName = user?.name?.split(' ')[0] || 'friend'
  const remaining = daysRemaining(user?.subscriptionEndsAt)

  const weekActivity = useMemo(() => {
    const fallback = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => ({
      label,
      minutes: 0,
    }))
    return data?.weekActivity?.length === 7 ? data.weekActivity : fallback
  }, [data])

  const weekTotal = weekActivity.reduce((sum, d) => sum + d.minutes, 0)
  const maxMinutes = Math.max(1, ...weekActivity.map((d) => d.minutes))
  const peakDay = weekActivity.reduce(
    (best, d) => (d.minutes > best.minutes ? d : best),
    weekActivity[0],
  )

  const trial = isTrialAccount(user)
  const catalog = trial ? TOPICS.filter((topic) => topic.number === 1) : TOPICS

  const featuredLessons = useMemo(() => {
    if (trial) return catalog
    const start = nextIndex >= 0 ? nextIndex : 0
    return [0, 1, 2].map((offset) => TOPICS[(start + offset) % TOPICS.length])
  }, [catalog, nextIndex, trial])

  const scheduleLessons = useMemo(() => {
    if (trial) return catalog
    const start = nextIndex >= 0 ? nextIndex : 0
    return [0, 1, 2, 3].map((offset) => TOPICS[(start + offset) % TOPICS.length])
  }, [catalog, nextIndex, trial])

  const takingLessons = useMemo(() => {
    return (data?.lessonStats || [])
      .filter((l) => (l.attempts || 0) > 0 || (l.totalDurationMs || 0) > 0)
      .sort((a, b) => (b.lastPracticedAt || '').localeCompare(a.lastPracticedAt || ''))
      .slice(0, 2)
  }, [data])

  const recent = data?.recentSessions.slice(0, 4) || []
  const practicedSet = useMemo(
    () => new Set(data?.practiceDays || []),
    [data?.practiceDays],
  )
  const calendar = useMemo(
    () => buildCalendar(calCursor, practicedSet),
    [calCursor, practicedSet],
  )
  const currentStreak = data?.stats.currentStreak || 0
  const practicedToday = Boolean(data?.stats.practicedToday)
  const nowMonth = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }, [])
  const canGoNextMonth =
    calCursor.getFullYear() < nowMonth.getFullYear() ||
    (calCursor.getFullYear() === nowMonth.getFullYear() &&
      calCursor.getMonth() < nowMonth.getMonth())

  const filteredFeatured = featuredLessons.filter((t) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return t.title.toLowerCase().includes(q) || t.blurb.toLowerCase().includes(q)
  })

  return (
    <AppShell title="Dashboard">
      <div className="yp-dash yp-dash-edu">
        {loading && <p className="yp-loading">Loading your progress…</p>}
        {error && <p className="yp-status error">{error}</p>}

        {data && (
          <div className="yp-dash-layout">
            <header className="yp-dash-top">
              <div className="yp-dash-welcome">
                <h1>
                  Welcome back {firstName} <span aria-hidden>👋</span>
                </h1>
                <p>
                  {weekTotal > 0
                    ? `${formatMinutes(weekTotal)} practised this week — keep the streak going.`
                    : `Next up: Lesson ${nextLesson.number} · ${nextLesson.title}`}
                </p>
              </div>
              <div className="yp-dash-top-tools">
                <label className="yp-rail-search">
                  <span className="sr">Search lessons</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M20 20l-3.5-3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search lessons"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <span className="yp-rail-avatar" aria-hidden>
                  {(user?.name || 'Y').charAt(0).toUpperCase()}
                </span>
              </div>
            </header>

            <div className="yp-dash-body">
              <div className="yp-dash-main">
                <section className="yp-dash-block" aria-labelledby="yp-new-lessons">
                  <div className="yp-dash-block-head">
                    <h2 id="yp-new-lessons">New lessons</h2>
                    <Link href="/lessons">See all</Link>
                  </div>
                  <div className="yp-course-row">
                    {(filteredFeatured.length ? filteredFeatured : featuredLessons).map(
                      (topic, i) => {
                        const unlocked = isLessonNumberUnlocked(topic.number, data)
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            className={`yp-course-card tone-${COURSE_TONES[i % COURSE_TONES.length]}${unlocked ? '' : ' is-locked'}`}
                            onClick={() => openPractice(topic.id, topic.number)}
                          >
                            <span className="yp-course-icon" aria-hidden>
                              {unlocked ? topic.icon : '🔒'}
                            </span>
                            <strong>{topic.title}</strong>
                            <span className="yp-course-meta">
                              Lesson {topic.number}
                              <em>· 30 min</em>
                            </span>
                            <span className="yp-course-rating">
                              ★{' '}
                              {!unlocked
                                ? 'Locked'
                                : completedIds.has(topic.id)
                                  ? 'Done'
                                  : 'Ready'}
                            </span>
                          </button>
                        )
                      },
                    )}
                  </div>
                </section>

                <div className="yp-dash-mid">
                  <section className="yp-dash-panel yp-hours-panel" aria-labelledby="yp-hours">
                    <div className="yp-dash-block-head">
                      <h2 id="yp-hours">Hours spent</h2>
                      <span>This week</span>
                    </div>
                    <div
                      className="yp-hours-chart"
                      role="img"
                      aria-label={`Minutes spoken each day: ${weekActivity
                        .map((d) => `${d.label} ${d.minutes} min`)
                        .join(', ')}`}
                    >
                      {weekActivity.map((day) => {
                        const active = day.label === peakDay.label && day.minutes > 0
                        const ratio = day.minutes / maxMinutes
                        return (
                          <div
                            key={day.label}
                            className={`yp-hours-col${active ? ' is-peak' : ''}`}
                          >
                            {active ? (
                              <span className="yp-hours-tip">
                                {formatMinutes(day.minutes)}
                              </span>
                            ) : null}
                            <div className="yp-hours-bar" aria-hidden>
                              <span
                                style={{
                                  height: `${Math.max(12, ratio * 100)}%`,
                                }}
                              />
                            </div>
                            <em>{day.label.slice(0, 2)}</em>
                          </div>
                        )
                      })}
                    </div>
                    <p className="yp-hours-total">{formatMinutes(weekTotal)} this week</p>
                  </section>

                  <section className="yp-dash-panel yp-schedule-panel" aria-labelledby="yp-schedule">
                    <div className="yp-dash-block-head">
                      <h2 id="yp-schedule">Daily schedule</h2>
                      <button
                        type="button"
                        className="yp-linkish"
                        onClick={() => openPractice(nextLesson.id, nextLesson.number)}
                      >
                        {data?.resumable?.lessonId === nextLesson.id ? 'Resume' : 'Start'}
                      </button>
                    </div>
                    <ul className="yp-schedule-list">
                      {scheduleLessons.map((topic) => {
                        const unlocked = isLessonNumberUnlocked(topic.number, data)
                        return (
                          <li key={topic.id}>
                            <button
                              type="button"
                              className={`yp-schedule-item${unlocked ? '' : ' is-locked'}`}
                              onClick={() => openPractice(topic.id, topic.number)}
                            >
                              <span className="yp-schedule-icon" aria-hidden>
                                {unlocked ? topic.icon : '🔒'}
                              </span>
                              <span className="yp-schedule-copy">
                                <strong>{topic.title}</strong>
                                <em>
                                  Lesson {topic.number} ·{' '}
                                  {data?.resumable?.lessonId === topic.id
                                    ? 'Resume lecture'
                                    : unlocked
                                      ? '30 min call'
                                      : 'Unlocks next day'}
                                </em>
                              </span>
                              <Chevron />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                </div>

                <section className="yp-dash-block" aria-labelledby="yp-taking">
                  <div className="yp-dash-block-head">
                    <h2 id="yp-taking">Lessons you&apos;re taking</h2>
                    <Link href="/lessons">Browse</Link>
                  </div>
                  {takingLessons.length === 0 ? (
                    <p className="yp-empty">No lessons taken yet. Start Lesson 1 to begin.</p>
                  ) : (
                    <ul className="yp-taking-list">
                      {takingLessons.map((lesson, i) => {
                        const topic = TOPICS.find((t) => t.id === lesson.lessonId)
                        const mins = Math.round((lesson.totalDurationMs || 0) / 60000)
                        const progress = lesson.completed
                          ? 100
                          : Math.min(
                              99,
                              Math.round(((lesson.totalDurationMs || 0) / (30 * 60 * 1000)) * 100),
                            )
                        return (
                          <li key={lesson.lessonId}>
                            <button
                              type="button"
                              className={`yp-taking-item tone-${COURSE_TONES[i % COURSE_TONES.length]}`}
                              onClick={() => openPractice(lesson.lessonId, lesson.lessonNumber)}
                            >
                              <span
                                className={`yp-taking-icon tone-${COURSE_TONES[i % COURSE_TONES.length]}`}
                                aria-hidden
                              >
                                {topic?.icon || '🗣️'}
                              </span>
                              <div className="yp-taking-copy">
                                <strong>
                                  Lesson {lesson.lessonNumber}: {lesson.title}
                                </strong>
                                <span>
                                  With Yappy
                                  <em>· {formatMinutes(mins)} practised</em>
                                </span>
                              </div>
                              <ProgressRing
                                value={progress}
                                tone={i % 2 === 0 ? 'lime' : 'lilac'}
                              />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              </div>

              <aside className="yp-dash-rail" aria-label="Plan and calendar">
                <div className="yp-rail-premium">
                  <div className="yp-rail-premium-copy">
                    <YappyMark />
                    <strong>Keep speaking with Yappy</strong>
                    <p>
                      {remaining == null
                        ? 'Start a plan to unlock your daily 30-minute call.'
                        : remaining === 0
                          ? 'Your plan ended. Renew to continue daily practice.'
                          : `${remaining} day${remaining === 1 ? '' : 's'} left on your plan.`}
                    </p>
                    <Link href="/lessons" className="yp-btn yp-btn-main">
                      {remaining === 0 ? 'Renew plan' : 'Get practising'}
                    </Link>
                  </div>
                </div>

                <div className="yp-rail-card yp-cal-card">
                  <div className="yp-dash-block-head">
                    <h2>Streak calendar</h2>
                    <span className="yp-cal-streak" title="Current practice streak">
                      {currentStreak > 0 ? `🔥 ${currentStreak} day${currentStreak === 1 ? '' : 's'}` : 'No streak yet'}
                    </span>
                  </div>
                  <div className="yp-cal-nav">
                    <button
                      type="button"
                      className="yp-cal-nav-btn"
                      aria-label="Previous month"
                      onClick={() =>
                        setCalCursor(
                          (prev) =>
                            new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                        )
                      }
                    >
                      ‹
                    </button>
                    <strong>{calendar.label}</strong>
                    <button
                      type="button"
                      className="yp-cal-nav-btn"
                      aria-label="Next month"
                      disabled={!canGoNextMonth}
                      onClick={() =>
                        setCalCursor(
                          (prev) =>
                            new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                        )
                      }
                    >
                      ›
                    </button>
                  </div>
                  <div className="yp-cal-weekdays" aria-hidden>
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div
                    className="yp-cal-grid"
                    role="grid"
                    aria-label={`Practice days in ${calendar.label}. Current streak ${currentStreak} days.`}
                  >
                    {calendar.cells.map((cell, i) =>
                      cell.day == null ? (
                        <span key={`e-${i}`} className="yp-cal-empty" />
                      ) : (
                        <span
                          key={cell.dateKey}
                          className={[
                            'yp-cal-day',
                            cell.isToday ? 'is-today' : '',
                            cell.practiced ? 'is-practiced' : '',
                            cell.isToday && !cell.practiced && currentStreak > 0
                              ? 'is-due'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          title={
                            cell.practiced
                              ? `Practised ${cell.dateKey}`
                              : cell.isToday
                                ? 'Practice today to keep your streak'
                                : undefined
                          }
                        >
                          {cell.day}
                        </span>
                      ),
                    )}
                  </div>
                  <p className="yp-cal-footnote">
                    {practicedToday
                      ? currentStreak > 0
                        ? `Streak saved — ${currentStreak} day${currentStreak === 1 ? '' : 's'} in a row.`
                        : 'Nice work — you practised today.'
                      : currentStreak > 0
                        ? `Practice today to keep your ${currentStreak}-day streak.`
                        : 'Practice today to start a streak.'}
                  </p>
                </div>

                <div className="yp-rail-card">
                  <div className="yp-dash-block-head">
                    <h2>Practice queue</h2>
                    <Link href="/scores">Scores</Link>
                  </div>
                  {recent.length === 0 ? (
                    <p className="yp-empty">No sessions yet. Start Lesson 1 today.</p>
                  ) : (
                    <ul className="yp-assign-list">
                      {recent.map((s) => {
                        const score = sessionScore(s)
                        const status =
                          score == null ? 'Upcoming' : score >= 70 ? 'Completed' : 'In progress'
                        const tone =
                          status === 'Completed' ? 'ok' : status === 'In progress' ? 'mid' : 'next'
                        return (
                          <li key={s.id}>
                            <div>
                              <strong>
                                L{s.lessonNumber}: {s.lessonTitle}
                              </strong>
                              <span className={`yp-assign-status ${tone}`}>{status}</span>
                            </div>
                            <Link href={`/scores/${s.lessonId}`}>
                              {score != null ? `${score}%` : 'Open'}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>

      <PracticeLimitModal
        open={Boolean(gate)}
        title={gate?.title}
        message={gate?.message || ''}
        unlocksAt={gate?.unlocksAt}
        onClose={() => setGate(null)}
      />
    </AppShell>
  )
}
