/** IELTS-style detailed lesson report shown after each practice session. */

export interface WordScore {
  word: string
  score: number
}

export interface VocabRepetition {
  word: string
  count: number
}

export interface CriterionFeedback {
  score: number
  feedback: string
}

export interface DetailedLessonReport {
  accuracyPercent: number
  polishedTranscript: string
  actualWords: WordScore[]
  overallBand: number
  bandConfidence: number
  vocabulary: {
    level: string
    feedback: string
    repetitions: VocabRepetition[]
    tip: string
  }
  pronunciation: CriterionFeedback
  taskResponse: CriterionFeedback
  fluency: CriterionFeedback
  lexical: CriterionFeedback
  grammar: CriterionFeedback
}

export interface StoredLessonResultPayload {
  lessonId: string
  lessonNumber: number
  lessonTitle: string
  durationMs: number
  turns: number
  corrections: number
  practiceSuccesses: number
  maxStreak: number
  endedReason: 'hangup' | 'timeup' | 'error'
  scores: {
    clarity: number
    accuracy: number
    pronunciation: number
    completeness: number
  }
  overall: number
  topMistakes: Array<{
    type: string
    summary: string
    heard?: string
    expected?: string
  }>
  tips: string[]
  sessionId?: string | null
  confidences?: number[]
  transcript?: Array<{
    role: 'user' | 'coach'
    text: string
    turnIndex?: number
  }>
  detailedReport?: DetailedLessonReport | null
}

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'so',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'my',
  'i',
  'it',
  'is',
  'was',
  'are',
  'be',
  'as',
  'that',
  'this',
  'then',
  'than',
  'from',
  'up',
  'out',
  'me',
  'you',
  'we',
  'they',
  'he',
  'she',
])

function clampBand(n: number): number {
  if (!Number.isFinite(n)) return 5
  return Math.round(Math.max(1, Math.min(9, n)) * 2) / 2
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

function userSpeech(transcript: StoredLessonResultPayload['transcript']): string {
  if (!transcript?.length) return ''
  return transcript
    .filter((t) => t.role === 'user' && t.text.trim())
    .map((t) => t.text.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, ''))
    .filter(Boolean)
}

function wordCounts(words: string[]): VocabRepetition[] {
  const map = new Map<string, number>()
  for (const w of words) {
    const key = w.toLowerCase()
    if (key.length < 3 || STOP.has(key)) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }))
}

function cefrFromBand(band: number): { level: string; feedback: string } {
  if (band >= 8)
    return {
      level: 'C1 - Advanced',
      feedback: 'Your word choice is precise and flexible. Keep stretching into less common phrasing.',
    }
  if (band >= 7)
    return {
      level: 'B2 - Upper Intermediate',
      feedback: 'Vocabulary is generally appropriate. Add more precise verbs and less common adjectives.',
    }
  if (band >= 6)
    return {
      level: 'B1 - Intermediate',
      feedback: 'You communicate clearly. Try richer collocations and fewer repeated everyday words.',
    }
  if (band >= 5)
    return {
      level: 'A2 - Upper Beginner',
      feedback: 'Consider using more varied and advanced words.',
    }
  return {
    level: 'A1 - Beginner',
    feedback: 'Build a wider base of everyday vocabulary and practise full sentences.',
  }
}

function scoreColorBand(avgConf: number, overall: number): number {
  const fromConf = 4 + avgConf * 5
  const fromStars = (overall / 5) * 9
  return clampBand(fromConf * 0.45 + fromStars * 0.55)
}

/** Local fallback when Gemini evaluation is unavailable. */
export function buildHeuristicDetailedReport(
  payload: StoredLessonResultPayload,
): DetailedLessonReport {
  const speech = userSpeech(payload.transcript) || 'No learner speech was captured in this session.'
  const words = tokenize(speech)
  const confs = payload.confidences?.filter((c) => Number.isFinite(c) && c > 0) || []
  const avgConf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.72
  const accuracyPercent = clampPct(avgConf * 100)
  const overallBand = scoreColorBand(avgConf, payload.overall)
  const { level, feedback } = cefrFromBand(overallBand)
  const repetitions = wordCounts(words)

  const actualWords: WordScore[] = words.slice(0, 120).map((word, i) => {
    const jitter = ((i * 17) % 21) - 10
    const base = accuracyPercent + jitter
    const lowBoost = word.length <= 2 ? -8 : 0
    return { word, score: clampPct(base + lowBoost) }
  })

  const tip =
    repetitions.length > 0
      ? 'Try using synonyms for the above words'
      : 'Keep building longer answers with fresh vocabulary'

  const grammarNote =
    payload.topMistakes.find((m) => m.type === 'grammar')?.summary ||
    'Watch articles and natural collocations in longer sentences.'

  return {
    accuracyPercent,
    polishedTranscript: speech,
    actualWords,
    overallBand,
    bandConfidence: 0.5,
    vocabulary: {
      level,
      feedback,
      repetitions,
      tip,
    },
    pronunciation: {
      score: clampBand(overallBand - (avgConf < 0.75 ? 0.5 : 0)),
      feedback:
        avgConf >= 0.85
          ? 'Your pronunciation is quite good. Working on consistency and tackling difficult sounds may enhance clarity.'
          : 'Slow down slightly and stress key content words so listeners catch every syllable.',
    },
    taskResponse: {
      score: clampBand(overallBand + (payload.scores.completeness >= 4 ? 0.5 : 0)),
      feedback:
        payload.turns >= 3
          ? `You stayed on the lesson topic (“${payload.lessonTitle}”) across ${payload.turns} turns. Adding a short concluding idea or one extra detail would push the score higher.`
          : 'Give fuller answers that directly address the prompt with examples and a clear ending.',
    },
    fluency: {
      score: clampBand(overallBand),
      feedback:
        'Your answers were generally coherent with natural linking words. Vary connectors and finish with a clear wrap-up sentence to sound more fluent.',
    },
    lexical: {
      score: clampBand(overallBand - (repetitions.length > 3 ? 0.5 : 0)),
      feedback:
        repetitions.length > 0
          ? `Vocabulary was understandable but repeated (${repetitions
              .slice(0, 3)
              .map((r) => r.word)
              .join(', ')}). Synonyms and more precise phrases will lift lexical resource.`
          : 'Word choice was appropriate. Stretch into less common but accurate expressions for a higher band.',
    },
    grammar: {
      score: clampBand(overallBand - (payload.corrections > payload.turns * 0.3 ? 0.5 : 0)),
      feedback: `Grammar was mostly clear. Focus next on: ${grammarNote}`,
    },
  }
}

export function isDetailedLessonReport(value: unknown): value is DetailedLessonReport {
  if (!value || typeof value !== 'object') return false
  const v = value as DetailedLessonReport
  return (
    typeof v.accuracyPercent === 'number' &&
    typeof v.polishedTranscript === 'string' &&
    Array.isArray(v.actualWords) &&
    typeof v.overallBand === 'number' &&
    v.vocabulary != null &&
    v.pronunciation != null &&
    v.taskResponse != null &&
    v.fluency != null &&
    v.lexical != null &&
    v.grammar != null
  )
}
