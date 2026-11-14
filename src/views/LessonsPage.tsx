'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { isTrialAccount } from '../lib/trial'
import { TOPICS } from '../data/topics'
import type { Topic } from '../types'
import { AppShell } from '../components/AppShell'
import { PracticeLimitModal, limitModalCopy } from '../components/PracticeLimitModal'
import { fetchDashboard, type DashboardData } from '../lib/progress'
import { isLessonNumberUnlocked } from '../lib/lessonAccess'

const CARD_TONES = ['lime', 'pink', 'lilac', 'lime', 'pink', 'lilac'] as const

export function LessonsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const trial = isTrialAccount(user)
  const topics = trial ? TOPICS.filter((topic) => topic.number === 1) : TOPICS
  const [data, setData] = useState<DashboardData | null>(null)
  const [gate, setGate] = useState<{ title: string; message: string; unlocksAt?: string | null } | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    fetchDashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function onPick(topic: Topic) {
    const unlocked = isLessonNumberUnlocked(topic.number, data)
    if (!unlocked) {
      const waiting =
        data?.lessonAccess?.waitingForTomorrow &&
        data.lessonAccess.nextLessonNumber === topic.number
      const copy = limitModalCopy(waiting ? 'lesson_locked_until_tomorrow' : 'lesson_locked')
      setGate({
        ...copy,
        unlocksAt: data?.lessonAccess?.unlocksAt || null,
      })
      return
    }
    const resumableHere = data?.resumable?.lessonId === topic.id
    if ((data?.stats.practicedToday || data?.lessonAccess?.practicedToday) && !resumableHere) {
      const copy = limitModalCopy('sessions_day')
      setGate({
        ...copy,
        unlocksAt: data?.lessonAccess?.unlocksAt || null,
      })
      return
    }
    router.push(`/practice/${topic.id}`)
  }

  return (
    <AppShell title="Lessons">
      <div className="yp-lessons-page">
        <header className="yp-dash-intro">
          <h1>
            Pick a lesson and start <em className="s">speaking.</em>
          </h1>
          <p>
            {trial
              ? 'Trial access includes the Introduction lesson only.'
              : 'One 30-minute call per day. Finish a lesson, then the next unlocks when the day changes.'}
          </p>
        </header>

        <div className="yp-lessons-pills" aria-hidden>
          <span className="yp-lessons-bubble lime">Speak</span>
          <span className="yp-lessons-bubble pink">Listen</span>
          <span className="yp-lessons-bubble lilac">Repeat</span>
        </div>

        <div className="yp-topic-grid">
          {topics.map((topic, index) => {
            const tone = CARD_TONES[index % CARD_TONES.length]
            const unlocked = isLessonNumberUnlocked(topic.number, data)
            const done = Boolean(
              data?.lessonStats?.find((l) => l.lessonId === topic.id && l.completed),
            )
            const resumable = data?.resumable?.lessonId === topic.id
            return (
              <button
                key={topic.id}
                type="button"
                className={`yp-topic-card tone-${tone}${unlocked ? '' : ' is-locked'}`}
                onClick={() => onPick(topic)}
                aria-disabled={!unlocked}
              >
                <div className="yp-topic-top">
                  <span className="yp-topic-num">Lesson {topic.number}</span>
                  <span className="yp-topic-icon" aria-hidden>
                    {unlocked ? topic.icon : '🔒'}
                  </span>
                </div>
                <strong>{topic.title}</strong>
                <span className="yp-topic-blurb">{topic.blurb}</span>
                <span className="yp-topic-go">
                  {!unlocked
                    ? 'Locked · unlocks next day'
                    : resumable
                      ? 'Resume call →'
                      : done
                        ? 'Practice again →'
                        : 'Start call →'}
                </span>
              </button>
            )
          })}
        </div>
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
