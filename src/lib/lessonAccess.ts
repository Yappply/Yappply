import type { DashboardData } from './progress'

function localDateString(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

export function isLessonNumberUnlocked(
  lessonNumber: number,
  data: Pick<DashboardData, 'lessonAccess' | 'lessonStats'> | null | undefined,
): boolean {
  if (lessonNumber <= 1) return true
  if (!data) return lessonNumber <= 1
  if (data.lessonAccess?.unlockedLessonNumbers?.includes(lessonNumber)) return true
  const prev = data.lessonStats?.find((l) => l.lessonNumber === lessonNumber - 1)
  if (!prev?.completed) return false
  if (!prev.completedAt) return false
  const completedDay = localDateString(new Date(prev.completedAt))
  const today = localDateString()
  return completedDay < today
}
