import { generateText, resolveApiKey } from '../geminiApi.mjs'

export const DETAILED_REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    accuracyPercent: { type: 'NUMBER' },
    polishedTranscript: { type: 'STRING' },
    actualWords: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' },
          score: { type: 'NUMBER' },
        },
        required: ['word', 'score'],
      },
    },
    overallBand: { type: 'NUMBER' },
    bandConfidence: { type: 'NUMBER' },
    vocabulary: {
      type: 'OBJECT',
      properties: {
        level: { type: 'STRING' },
        feedback: { type: 'STRING' },
        repetitions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              word: { type: 'STRING' },
              count: { type: 'NUMBER' },
            },
            required: ['word', 'count'],
          },
        },
        tip: { type: 'STRING' },
      },
      required: ['level', 'feedback', 'repetitions', 'tip'],
    },
    pronunciation: {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' },
      },
      required: ['score', 'feedback'],
    },
    taskResponse: {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' },
      },
      required: ['score', 'feedback'],
    },
    fluency: {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' },
      },
      required: ['score', 'feedback'],
    },
    lexical: {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' },
      },
      required: ['score', 'feedback'],
    },
    grammar: {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' },
      },
      required: ['score', 'feedback'],
    },
  },
  required: [
    'accuracyPercent',
    'polishedTranscript',
    'actualWords',
    'overallBand',
    'bandConfidence',
    'vocabulary',
    'pronunciation',
    'taskResponse',
    'fluency',
    'lexical',
    'grammar',
  ],
}

function clampBand(n) {
  if (!Number.isFinite(n)) return 5
  return Math.round(Math.max(1, Math.min(9, Number(n))) * 2) / 2
}

function clampPct(n) {
  if (!Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, Math.round(Number(n))))
}

function criterion(raw, fallbackScore = 6) {
  return {
    score: clampBand(raw?.score ?? fallbackScore),
    feedback: String(raw?.feedback || 'Keep practising this skill with longer answers.').slice(0, 1200),
  }
}

export function normalizeDetailedReport(raw, { avgConfidence = 0.75, learnerSpeech = '' } = {}) {
  const speech = String(learnerSpeech || '').trim()
  const words = Array.isArray(raw?.actualWords) ? raw.actualWords : []
  const actualWords = words
    .slice(0, 160)
    .map((w) => ({
      word: String(w?.word || '').slice(0, 40),
      score: clampPct(w?.score),
    }))
    .filter((w) => w.word)

  if (!actualWords.length && speech) {
    for (const word of speech.split(/\s+/).slice(0, 100)) {
      const clean = word.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, '')
      if (!clean) continue
      actualWords.push({
        word: clean,
        score: clampPct(avgConfidence * 100 + (Math.random() * 20 - 10)),
      })
    }
  }

  const repetitions = Array.isArray(raw?.vocabulary?.repetitions)
    ? raw.vocabulary.repetitions
        .slice(0, 10)
        .map((r) => ({
          word: String(r?.word || '').toLowerCase().slice(0, 40),
          count: Math.max(2, Math.round(Number(r?.count) || 2)),
        }))
        .filter((r) => r.word)
    : []

  return {
    accuracyPercent: clampPct(raw?.accuracyPercent ?? avgConfidence * 100),
    polishedTranscript: String(raw?.polishedTranscript || speech || '').slice(0, 4000),
    actualWords,
    overallBand: clampBand(raw?.overallBand ?? 6),
    bandConfidence: Math.max(0.25, Math.min(1, Number(raw?.bandConfidence) || 0.5)),
    vocabulary: {
      level: String(raw?.vocabulary?.level || 'A2 - Upper Beginner').slice(0, 80),
      feedback: String(
        raw?.vocabulary?.feedback || 'Consider using more varied and advanced words.',
      ).slice(0, 400),
      repetitions,
      tip: String(raw?.vocabulary?.tip || 'Try using synonyms for the above words').slice(0, 200),
    },
    pronunciation: criterion(raw?.pronunciation, 6.5),
    taskResponse: criterion(raw?.taskResponse, 7),
    fluency: criterion(raw?.fluency, 6.5),
    lexical: criterion(raw?.lexical, 6.5),
    grammar: criterion(raw?.grammar, 6.5),
  }
}

/** Lightweight local report when Gemini is unavailable. */
export function buildFallbackDetailedReport({
  lessonTitle = 'Lesson',
  learnerSpeech = '',
  confidences = [],
  overall = 3,
  turns = 0,
  corrections = 0,
} = {}) {
  const confs = Array.isArray(confidences)
    ? confidences.filter((c) => Number.isFinite(c) && c > 0)
    : []
  const avgConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.72
  const speech = String(learnerSpeech || '').trim() || 'No learner speech was captured in this session.'
  const words = speech
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, ''))
    .filter(Boolean)
    .slice(0, 120)

  const bandBase = Math.max(1, Math.min(9, (Number(overall) / 5) * 9 || 5.5))
  const actualWords = words.map((word, i) => ({
    word,
    score: Math.max(0, Math.min(100, Math.round(avgConfidence * 100 + ((i * 17) % 21) - 10))),
  }))

  const counts = new Map()
  for (const w of words) {
    const key = w.toLowerCase()
    if (key.length < 3) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const repetitions = [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }))

  return normalizeDetailedReport(
    {
      accuracyPercent: Math.round(avgConfidence * 100),
      polishedTranscript: speech,
      actualWords,
      overallBand: bandBase,
      bandConfidence: 0.5,
      vocabulary: {
        level: bandBase >= 6 ? 'B1 - Intermediate' : 'A2 - Upper Beginner',
        feedback: 'Consider using more varied and advanced words.',
        repetitions,
        tip: repetitions.length
          ? 'Try using synonyms for the above words'
          : 'Keep building longer answers with fresh vocabulary',
      },
      pronunciation: {
        score: bandBase,
        feedback:
          'Your pronunciation is quite good. Working on consistency and tackling difficult sounds may enhance clarity.',
      },
      taskResponse: {
        score: Math.min(9, bandBase + 0.5),
        feedback: `You addressed “${lessonTitle}” across ${turns || 'several'} turns. Add a short concluding idea for a higher band.`,
      },
      fluency: {
        score: bandBase,
        feedback:
          'Your answers were generally coherent. Vary linking words and finish with a clear wrap-up sentence.',
      },
      lexical: {
        score: bandBase,
        feedback:
          repetitions.length > 0
            ? `Vocabulary was understandable but repeated (${repetitions
                .slice(0, 3)
                .map((r) => r.word)
                .join(', ')}).`
            : 'Word choice was appropriate. Stretch into less common expressions for a higher band.',
      },
      grammar: {
        score: Math.max(1, bandBase - (corrections > turns * 0.3 ? 0.5 : 0)),
        feedback: 'Grammar was mostly clear. Focus on articles and natural collocations next.',
      },
    },
    { avgConfidence, learnerSpeech: speech },
  )
}

export async function evaluateLessonWithGemini({
  lessonTitle,
  lessonNumber,
  learnerSpeech,
  transcriptPreview,
  mistakes,
  confidences,
  heuristicScores,
  overall,
}) {
  const apiKey = resolveApiKey(process.env)
  if (!apiKey) {
    throw new Error('Missing Gemini API key')
  }

  const confs = Array.isArray(confidences)
    ? confidences.filter((c) => Number.isFinite(c) && c > 0)
    : []
  const avgConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.75

  const systemInstruction = `You are an expert IELTS Speaking examiner and pronunciation coach for Yappply.
Return ONLY JSON matching the schema. Be specific, constructive, and reference the learner's actual words.
Scores use the IELTS 0–9 band scale in 0.5 increments.
accuracyPercent is 0–100 overall intelligibility from speech recognition confidence and clarity.
actualWords must cover the learner speech word-by-word with a 0–100 score per word (green-quality ≈80+, amber ≈55–79, red <55).
polishedTranscript is a grammatically natural rewrite preserving the learner's meaning.
vocabulary.level should look like "A2 - Upper Beginner" or "B1 - Intermediate".
vocabulary.repetitions lists overused content words with counts (≥2 only).
Write feedback paragraphs of 2–4 sentences that sound like a human examiner.`

  const prompt = `Evaluate this English speaking lesson.

Lesson ${lessonNumber}: ${lessonTitle}
Heuristic star scores (1–5): ${JSON.stringify(heuristicScores || {})}
Overall stars: ${overall}
Speech recognition confidences (0–1): ${JSON.stringify(confs.slice(0, 40))}
Average confidence: ${avgConfidence.toFixed(3)}
Tracked mistakes: ${JSON.stringify((mistakes || []).slice(0, 8))}

Learner speech (concatenate of user turns):
"""
${String(learnerSpeech || '').slice(0, 3500)}
"""

Conversation preview:
"""
${String(transcriptPreview || '').slice(0, 2500)}
"""

Produce the full detailed speaking report JSON now.`

  const result = await generateText(apiKey, {
    systemInstruction,
    prompt,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: DETAILED_REPORT_SCHEMA,
    },
  })

  let parsed
  try {
    parsed = JSON.parse(result.text)
  } catch {
    throw new Error('Invalid evaluation JSON from model')
  }

  const report = normalizeDetailedReport(parsed, { avgConfidence, learnerSpeech })
  return { report, model: result.model, usage: result.usage }
}
