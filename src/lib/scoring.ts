import type { Topic } from '../types'

export interface TrackedMistake {
  type: 'grammar' | 'pronunciation' | 'unclear'
  summary: string
  heard?: string
  expected?: string
}

export interface LessonScores {
  clarity: number
  accuracy: number
  pronunciation: number
  completeness: number
}

export interface LessonResult {
  lessonId: string
  lessonNumber: number
  lessonTitle: string
  durationMs: number
  turns: number
  corrections: number
  practiceSuccesses: number
  maxStreak: number
  endedReason: 'hangup' | 'timeup' | 'error'
  scores: LessonScores
  overall: number
  topMistakes: TrackedMistake[]
  tips: string[]
}

export interface RawSessionStats {
  durationMs: number
  turns: number
  corrections: number
  practiceSuccesses: number
  maxStreak: number
  completed: boolean
  endedReason: 'hangup' | 'timeup' | 'error'
  confidences: number[]
  mistakes: TrackedMistake[]
  practiceExhausted: number
}

function clamp1to5(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(5, Math.round(n)))
}

/** Clarity from average speech confidence. */
function scoreClarity(confidences: number[]): number {
  if (!confidences.length) return 1
  const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length
  if (avg >= 0.93) return 5
  if (avg >= 0.86) return 4
  if (avg >= 0.78) return 3
  if (avg >= 0.68) return 2
  return 1
}

/** Accuracy from correction rate. */
function scoreAccuracy(turns: number, corrections: number): number {
  if (turns <= 0) return 1
  const rate = corrections / turns
  if (rate <= 0.05) return 5
  if (rate <= 0.15) return 4
  if (rate <= 0.28) return 3
  if (rate <= 0.45) return 2
  return 1
}

/** Pronunciation from low-confidence share + exhausted practice. */
function scorePronunciation(
  confidences: number[],
  practiceExhausted: number,
  turns: number,
): number {
  if (!confidences.length) return 1
  const low = confidences.filter((c) => c < 0.7).length / confidences.length
  const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length
  let score = 5
  if (avg < 0.92) score -= 1
  if (avg < 0.84) score -= 1
  if (avg < 0.75) score -= 1
  if (low > 0.2) score -= 1
  if (low > 0.4) score -= 1
  if (practiceExhausted > 0) score -= 1
  if (practiceExhausted > 1 && turns > 0) score -= 1
  return clamp1to5(score)
}

/** Completeness — unfinished lessons score very low. */
function scoreCompleteness(
  turns: number,
  durationMs: number,
  endedReason: string,
  completed: boolean,
): number {
  if (!completed) {
    return 1
  }

  const minutes = durationMs / 60000
  let score = 3
  if (turns >= 5 || minutes >= 6) score = 4
  if (turns >= 7 || minutes >= 10 || endedReason === 'timeup') score = 5
  return clamp1to5(score)
}

function rankMistakes(mistakes: TrackedMistake[]): TrackedMistake[] {
  const seen = new Set<string>()
  const unique: TrackedMistake[] = []
  for (const m of mistakes) {
    const key = `${m.type}|${(m.expected || m.summary).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(m)
  }
  // Prefer grammar, then pronunciation, then unclear
  const weight = { grammar: 0, pronunciation: 1, unclear: 2 }
  unique.sort((a, b) => weight[a.type] - weight[b.type])
  return unique.slice(0, 5)
}

export function buildLessonResult(topic: Topic, raw: RawSessionStats): LessonResult {
  const scores: LessonScores = {
    clarity: scoreClarity(raw.confidences),
    accuracy: scoreAccuracy(raw.turns, raw.corrections),
    pronunciation: scorePronunciation(raw.confidences, raw.practiceExhausted, raw.turns),
    completeness: scoreCompleteness(
      raw.turns,
      raw.durationMs,
      raw.endedReason,
      raw.completed,
    ),
  }

  const overall =
    Math.round(
      ((scores.clarity + scores.accuracy + scores.pronunciation + scores.completeness) / 4) * 10,
    ) / 10

  const topMistakes = rankMistakes(raw.mistakes)
  const tips: string[] = []
  if (scores.pronunciation <= 2) {
    tips.push('Speak a little slower and say each word clearly.')
  }
  if (scores.accuracy <= 2) {
    tips.push('Listen to Yappy’s corrected sentence, then copy it once carefully.')
  }
  if (scores.clarity <= 2) {
    tips.push('Move closer to the mic and reduce background noise.')
  }
  if (scores.completeness <= 2) {
    tips.push('Try a longer call next time — even 5 more turns helps a lot.')
  }
  if (tips.length === 0) {
    tips.push('Nice work. Keep telling stories — practice a little every day.')
  }

  return {
    lessonId: topic.id,
    lessonNumber: topic.number,
    lessonTitle: topic.title,
    durationMs: raw.durationMs,
    turns: raw.turns,
    corrections: raw.corrections,
    practiceSuccesses: raw.practiceSuccesses,
    maxStreak: raw.maxStreak,
    endedReason: raw.endedReason,
    scores,
    overall,
    topMistakes,
    tips,
  }
}
