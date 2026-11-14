'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TOPICS } from '../data/topics'
import { ChatScreen, type CallSessionStats } from '../components/ChatScreen'
import { PracticeLimitModal, limitModalCopy } from '../components/PracticeLimitModal'
import { useAuth } from '../context/AuthContext'
import { isTrialAccount } from '../lib/trial'
import { ApiError } from '../lib/api'
import { savePracticeSession, startPracticeSession } from '../lib/progress'
import {
  clearPracticeContext,
  setPracticeContext,
} from '../lib/practiceContext'
import { buildLessonResult } from '../lib/scoring'
import type { StoredLessonResultPayload } from '../lib/detailedReport'

export function PracticePage() {
  const params = useParams<{ lessonId: string }>()
  const lessonId = params?.lessonId ?? ''
  const { user } = useAuth()
  const router = useRouter()
  const topic = TOPICS.find((t) => t.id === lessonId)
  const [gate, setGate] = useState<{
    title: string
    message: string
    unlocksAt?: string | null
  } | null>(null)

  useEffect(() => {
    if (!topic) router.replace('/lessons')
    else if (!user) router.replace('/login')
    else if (isTrialAccount(user) && topic.number !== 1) router.replace('/lessons')
  }, [topic, user, router])

  useEffect(() => {
    return () => clearPracticeContext()
  }, [])

  if (!topic || !user || (isTrialAccount(user) && topic.number !== 1)) return null

  async function handleCallStart() {
    try {
      const started = await startPracticeSession({
        lessonId: topic!.id,
        lessonNumber: topic!.number,
        lessonTitle: topic!.title,
      })
      setPracticeContext({
        sessionId: started.sessionId,
        lessonId: topic!.id,
        turnIndex: started.resume?.transcript?.length || 0,
      })
      return started
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null
      const copy = limitModalCopy(apiErr?.code)
      setGate({
        title: copy.title,
        message: apiErr?.message || copy.message,
        unlocksAt: apiErr?.unlocksAt || null,
      })
      throw err
    }
  }

  async function handleSessionEnd(
    stats: CallSessionStats & {
      sessionId?: string | null
      transcript?: Array<{
        role: 'user' | 'coach'
        text: string
        turnIndex?: number
        correction?: boolean
      }>
    },
  ) {
    const result = buildLessonResult(topic!, stats)
    let sessionId = stats.sessionId || null
    try {
      const saved = await savePracticeSession({
        sessionId: stats.sessionId || undefined,
        lessonId: topic!.id,
        lessonNumber: topic!.number,
        lessonTitle: topic!.title,
        durationMs: stats.durationMs,
        turns: stats.turns,
        corrections: stats.corrections,
        practiceSuccesses: stats.practiceSuccesses,
        maxStreak: stats.maxStreak,
        completed: stats.completed,
        endedReason: stats.endedReason,
        scores: result.scores,
        overall: result.overall,
        topMistakes: result.topMistakes,
        transcript: stats.transcript,
      })
      if (saved.sessionId) sessionId = saved.sessionId
      if (saved.paused || (stats.endedReason !== 'timeup' && stats.durationMs < 30 * 60 * 1000)) {
        clearPracticeContext()
        router.replace('/lessons')
        return
      }
    } catch (err) {
      console.warn('Could not save session', err)
    } finally {
      clearPracticeContext()
    }

    const payload: StoredLessonResultPayload = {
      ...result,
      sessionId,
      confidences: stats.confidences,
      transcript: stats.transcript,
      detailedReport: null,
    }
    try {
      sessionStorage.setItem(`yappply-result:${topic!.id}`, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
    router.replace(`/practice/${topic!.id}/results`)
  }

  return (
    <>
      <ChatScreen
        level={user.level}
        topic={topic}
        onBack={() => router.push('/lessons')}
        onCallStart={handleCallStart}
        onSessionEnd={handleSessionEnd}
      />
      <PracticeLimitModal
        open={Boolean(gate)}
        title={gate?.title}
        message={gate?.message || ''}
        unlocksAt={gate?.unlocksAt}
        onClose={() => {
          setGate(null)
          router.push('/lessons')
        }}
      />
    </>
  )
}
