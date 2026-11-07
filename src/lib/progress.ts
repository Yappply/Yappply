import { api } from './api'

export interface DashboardData {
  user: {
    id: string
    name: string
    email: string
    level: 'beginner' | 'intermediate' | 'advanced'
  }
  stats: {
    totalSessions: number
    totalMinutes: number
    totalTurns: number
    totalCorrections: number
    lessonsCompleted: number
    currentStreak: number
    longestStreak: number
    lastPracticeDate: string | null
    speakingScore: number | null
    practicedToday?: boolean
  }
  lessonAccess?: {
    practicedToday: boolean
    sessionsRemainingToday: number
    unlockedLessonNumbers: number[]
    maxUnlockedLessonNumber: number
    waitingForTomorrow: boolean
    nextLessonNumber: number
    unlocksAt: string | null
    timeZone?: string
    completeMs: number
  }
  lessonStats: Array<{
    lessonId: string
    lessonNumber: number
    title: string
    attempts: number
    totalDurationMs: number
    totalTurns: number
    totalCorrections: number
    bestStreak: number
    completed: boolean
    completedAt?: string | null
    unlocked?: boolean
    lastPracticedAt?: string
  }>
  weekActivity?: Array<{
    label: string
    minutes: number
  }>
  /** UTC YYYY-MM-DD dates with at least one practice session */
  practiceDays?: string[]
  recentSessions: Array<{
    id: string
    lessonId: string
    lessonNumber: number
    lessonTitle: string
    durationMs: number
    turns: number
    corrections: number
    practiceSuccesses: number
    maxStreak: number
    completed: boolean
    endedReason: string
    overall?: number | null
    createdAt: string
  }>
}

export interface SessionPayload {
  sessionId?: string
  lessonId: string
  lessonNumber: number
  lessonTitle: string
  durationMs: number
  turns: number
  corrections: number
  practiceSuccesses: number
  maxStreak: number
  completed: boolean
  endedReason: 'hangup' | 'timeup' | 'error'
  scores?: {
    clarity: number
    accuracy: number
    pronunciation: number
    completeness: number
  }
  overall?: number
  topMistakes?: Array<{
    type: string
    summary: string
    heard?: string
    expected?: string
  }>
  transcript?: Array<{
    role: 'user' | 'coach'
    text: string
    turnIndex?: number
    correction?: boolean
    practiceAttempts?: number
  }>
}

export type SkillScores = {
  clarity: number | null
  accuracy: number | null
  pronunciation: number | null
  completeness: number | null
}

export interface ScoresData {
  overall: SkillScores
  lessonsScored: number
  lessons: Array<{
    lessonId: string
    lessonNumber: number
    title: string
    attempts: number
    completed: boolean
    bestScores: SkillScores
    latestScores: SkillScores
    bestOverall: number | null
    lastPracticedAt?: string
    bestSessionId?: string
    reportSessionId?: string
    hasDetailedReport?: boolean
  }>
}

export interface LessonReportResponse {
  sessionId: string
  lessonId: string
  lessonNumber: number
  lessonTitle: string
  durationMs: number
  turns: number
  corrections: number
  maxStreak: number
  endedReason: string
  scores: SkillScores | null
  overall: number | null
  report: import('./detailedReport').DetailedLessonReport
  cached?: boolean
}

export function fetchDashboard() {
  return api<DashboardData>('/api/progress/summary')
}

export function fetchScores() {
  return api<ScoresData>('/api/progress/scores')
}

export function fetchLessonReport(lessonId: string) {
  return api<LessonReportResponse>(
    `/api/progress/lessons/${encodeURIComponent(lessonId)}/report`,
  )
}

export function startPracticeSession(payload: {
  lessonId: string
  lessonNumber: number
  lessonTitle: string
}) {
  return api<{ sessionId: string }>('/api/progress/sessions/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function savePracticeSession(payload: SessionPayload) {
  return api<{ sessionId?: string; skipped?: boolean }>('/api/progress/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function evaluatePracticeSession(payload: {
  sessionId?: string | null
  lessonId: string
  lessonNumber: number
  lessonTitle: string
  transcript?: SessionPayload['transcript']
  confidences?: number[]
  topMistakes?: SessionPayload['topMistakes']
  scores?: SessionPayload['scores']
  overall?: number
}) {
  return api<{ report: import('./detailedReport').DetailedLessonReport; cached?: boolean }>(
    '/api/progress/evaluate',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}
