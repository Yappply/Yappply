import {
  nextZonedMidnight,
  normalizeTimeZone,
  zonedDateString,
} from './timeZones.mjs'

/** One full 30-minute call completes a lesson (slight buffer for timer drift). */
export const LESSON_COMPLETE_MS = 28 * 60 * 1000

export { zonedDateString, nextZonedMidnight, normalizeTimeZone }

/** @deprecated use zonedDateString — kept for older imports */
export function utcDateString(d = new Date()) {
  return zonedDateString(d, 'UTC')
}

export function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function isLessonCompletedEnough(durationMs, endedReason = '') {
  const ms = Math.max(0, Number(durationMs) || 0)
  if (ms >= LESSON_COMPLETE_MS) return true
  const timeup = endedReason === 'timeup' || endedReason === 'time_limit'
  return timeup && ms >= 25 * 60 * 1000
}

/**
 * Lesson N unlocks only after lesson N-1 was completed on a previous local calendar day
 * in the learner's timezone. Lesson 1 is always unlocked.
 */
export function isLessonUnlocked(
  lessonNumber,
  lessonStats = [],
  now = new Date(),
  timeZone = 'UTC',
) {
  const n = Number(lessonNumber)
  if (!Number.isFinite(n) || n < 1) return false
  if (n === 1) return true

  const tz = normalizeTimeZone(timeZone)
  const prev = (lessonStats || []).find((l) => Number(l.lessonNumber) === n - 1)
  if (!prev?.completed) return false

  const completedAt = prev.completedAt ? new Date(prev.completedAt) : null
  if (!completedAt || Number.isNaN(completedAt.getTime())) {
    const fallback = prev.lastPracticedAt ? new Date(prev.lastPracticedAt) : null
    if (!fallback || Number.isNaN(fallback.getTime())) return false
    return zonedDateString(fallback, tz) < zonedDateString(now, tz)
  }

  return zonedDateString(completedAt, tz) < zonedDateString(now, tz)
}

export function buildLessonAccess(
  lessonStats = [],
  { practicedToday = false, totalLessons = 30, timeZone = 'UTC' } = {},
) {
  const now = new Date()
  const tz = normalizeTimeZone(timeZone)
  const unlocked = []
  for (let n = 1; n <= totalLessons; n++) {
    if (isLessonUnlocked(n, lessonStats, now, tz)) unlocked.push(n)
  }

  const maxUnlocked = unlocked.length ? Math.max(...unlocked) : 1
  const current = (lessonStats || []).find((l) => Number(l.lessonNumber) === maxUnlocked)
  const waitingForTomorrow =
    Boolean(current?.completed) &&
    current.completedAt &&
    zonedDateString(new Date(current.completedAt), tz) === zonedDateString(now, tz) &&
    maxUnlocked < totalLessons

  const unlocksAt =
    waitingForTomorrow || practicedToday ? nextZonedMidnight(now, tz).toISOString() : null

  return {
    practicedToday: Boolean(practicedToday),
    sessionsRemainingToday: practicedToday ? 0 : 1,
    unlockedLessonNumbers: unlocked,
    maxUnlockedLessonNumber: maxUnlocked,
    waitingForTomorrow,
    nextLessonNumber: waitingForTomorrow ? maxUnlocked + 1 : maxUnlocked,
    unlocksAt,
    timeZone: tz,
    completeMs: LESSON_COMPLETE_MS,
  }
}

export function checkLessonStartAllowed(
  user,
  { lessonNumber, lessonStats, practicedToday, timeZone = 'UTC' },
) {
  if (user?.role === 'admin') {
    return { statusCode: 403, error: 'Admin accounts cannot practice lessons', code: 'admin' }
  }

  const n = Number(lessonNumber)
  if (!Number.isFinite(n) || n < 1) {
    return { statusCode: 400, error: 'Invalid lesson', code: 'bad_lesson' }
  }

  const tz = normalizeTimeZone(timeZone)
  const unlocksAt = nextZonedMidnight(new Date(), tz).toISOString()

  if (practicedToday) {
    return {
      statusCode: 429,
      error:
        "You've already practiced today. Come back when the day changes to practice again.",
      code: 'sessions_day',
      unlocksAt,
    }
  }

  if (!isLessonUnlocked(n, lessonStats, new Date(), tz)) {
    const prev = (lessonStats || []).find((l) => Number(l.lessonNumber) === n - 1)
    if (prev?.completed) {
      return {
        statusCode: 403,
        error:
          'This lecture unlocks when the day changes. Come back tomorrow to continue.',
        code: 'lesson_locked_until_tomorrow',
        unlocksAt,
      }
    }
    return {
      statusCode: 403,
      error:
        'This lecture is locked. Finish the current lesson (full 30 minutes). The next one unlocks when the day changes.',
      code: 'lesson_locked',
      unlocksAt,
    }
  }

  return null
}
