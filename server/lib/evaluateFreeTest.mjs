import { generateText, resolveApiKey } from '../geminiApi.mjs'

export const FREE_TEST_REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    overall: { type: 'NUMBER' },
    level: { type: 'STRING' },
    usedStrongerWords: { type: 'BOOLEAN' },
    strength: { type: 'STRING' },
    fixFirst: { type: 'STRING' },
    fillers: { type: 'ARRAY', items: { type: 'STRING' } },
    paceWpm: { type: 'NUMBER' },
    answered: { type: 'BOOLEAN' },
    onTopic: { type: 'BOOLEAN' },
    answeredNote: { type: 'STRING' },
    structure: {
      type: 'OBJECT',
      properties: {
        point: { type: 'BOOLEAN' },
        reason: { type: 'BOOLEAN' },
        example: { type: 'BOOLEAN' },
        ending: { type: 'BOOLEAN' },
      },
      required: ['point', 'reason', 'example', 'ending'],
    },
    structureNote: { type: 'STRING' },
    grammarFixes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          heard: { type: 'STRING' },
          better: { type: 'STRING' },
        },
        required: ['heard', 'better'],
      },
    },
    strongerWords: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          weak: { type: 'STRING' },
          stronger: { type: 'STRING' },
        },
        required: ['weak', 'stronger'],
      },
    },
    rewritten: { type: 'STRING' },
    watchTip: { type: 'STRING' },
    pitch: { type: 'STRING' },
  },
  required: [
    'overall',
    'level',
    'usedStrongerWords',
    'strength',
    'fixFirst',
    'fillers',
    'paceWpm',
    'answered',
    'onTopic',
    'answeredNote',
    'structure',
    'structureNote',
    'grammarFixes',
    'strongerWords',
    'rewritten',
    'watchTip',
    'pitch',
  ],
}

const FILLER_RE =
  /\b(um+|uh+|er+|ah+|like|you know|basically|actually|literally|so yeah|kind of|sort of)\b/gi

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function detectFillers(text) {
  const found = new Map()
  const matches = String(text || '').match(FILLER_RE) || []
  for (const m of matches) {
    const key = m.toLowerCase().replace(/(.)\1+/g, '$1')
    found.set(key, (found.get(key) || 0) + 1)
  }
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 8)
}

function clampOverall(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function fillerCount(text) {
  return (String(text || '').match(FILLER_RE) || []).length
}

function umCount(text) {
  return (String(text || '').match(/\bum+\b/gi) || []).length
}

function structureProblemCount(structure) {
  return ['point', 'reason', 'example', 'ending'].filter((key) => !structure?.[key]).length
}

/** Beginner ≤65, Intermediate 66–90, Advanced >90. */
export function levelForOverall(overall) {
  if (overall > 90) return 'Advanced'
  if (overall >= 66) return 'Intermediate'
  return 'Beginner'
}

function strictOverall({ answered, structure, grammarErrors, usedStrongerWords, fillersHeard, ums, paceWpm, words }) {
  if (!words) return 0
  if (!answered) return Math.min(15, Math.round(words / 4))

  let score = 18
  if (structure.point) score += 10
  if (structure.reason) score += 12
  if (structure.example) score += 14
  if (structure.ending) score += 8
  score += Math.max(0, 18 - grammarErrors * 8)
  if (usedStrongerWords) score += 12
  if (paceWpm >= 120 && paceWpm <= 150) score += 8
  else if (paceWpm >= 110 && paceWpm <= 165) score += 3
  score -= Math.min(20, fillersHeard * 4)

  if (!structure.point) score = Math.min(score, 30)
  if (!structure.reason && !structure.example) score = Math.min(score, 48)
  if (words < 50) score = Math.min(score, 45)
  else if (words < 80) score = Math.min(score, 70)
  if (paceWpm < 80) score = Math.min(score, 55)
  else if (paceWpm < 110) score = Math.min(score, 78)
  if (paceWpm > 180) score = Math.min(score, 75)

  const structureProblems = structureProblemCount(structure)
  if (!usedStrongerWords && grammarErrors > 2 && structureProblems > 2) {
    score = Math.min(score, 65)
  }
  if (structureProblems > 0 && ums > 2) {
    score = Math.min(score, 39)
  }

  return clampOverall(score)
}

function applyStrictLevel(report, { durationSec = 60 } = {}) {
  const speech = String(report.transcript || '')
  const words = wordCount(speech)
  const minutes = Math.max(Number(durationSec) || 60, 1) / 60
  const paceWpm = words ? Math.round(words / minutes) : 0
  const fillersHeard = fillerCount(speech)
  const ums = umCount(speech)
  const grammarErrors = Array.isArray(report.grammarFixes) ? report.grammarFixes.length : 0
  const usedStrongerWords = report.usedStrongerWords === true
  const modelSaidNo = report.answered !== true

  let answered = report.answered === true && words >= 25
  let structure = {
    point: Boolean(report.structure?.point),
    reason: Boolean(report.structure?.reason),
    example: Boolean(report.structure?.example),
    ending: Boolean(report.structure?.ending),
  }
  if (!answered) {
    structure = { point: false, reason: false, example: false, ending: false }
  }

  const overall = strictOverall({
    answered,
    structure,
    grammarErrors,
    usedStrongerWords,
    fillersHeard,
    ums,
    paceWpm,
    words,
  })

  let answeredNote = String(report.answeredNote || '')
  let strength = report.strength
  let fixFirst = report.fixFirst
  if (!answered) {
    answeredNote =
      words >= 25 && answeredNote && modelSaidNo
        ? answeredNote
        : words
          ? words < 25
            ? 'Too little was said to count as an answer.'
            : 'This did not answer the topic, so the score stays low.'
          : 'We did not catch an answer.'
    strength = words ? 'You used the minute' : 'No answer captured'
    fixFirst = 'Answer the topic directly'
  }

  return {
    ...report,
    answered,
    answeredNote: answeredNote.slice(0, 200),
    strength: String(strength || '').slice(0, 120),
    fixFirst: String(fixFirst || '').slice(0, 120),
    structure,
    paceWpm,
    fillers: report.fillers?.length ? report.fillers : detectFillers(speech),
    overall,
    level: levelForOverall(overall),
  }
}

export function buildFallbackFreeTestReport({ topic, transcript, durationSec = 60 }) {
  const speech = String(transcript || '').trim()
  const words = wordCount(speech)
  const fillers = detectFillers(speech)
  const fillerCount = (speech.match(FILLER_RE) || []).length
  const hasExample = /\b(for example|for instance|like when|one time|last year|yesterday)\b/i.test(
    speech,
  )
  const hasReason = /\b(because|so that|that's why|since)\b/i.test(speech)
  const answered = words >= 50 && (hasReason || hasExample)

  const usedStrongerWords = ![
    { weak: 'good' },
    { weak: 'help people' },
    { weak: 'nice' },
    { weak: 'very' },
  ].some((s) => speech.toLowerCase().includes(s.weak.toLowerCase()))

  return applyStrictLevel({
    overall: 0,
    level: 'Beginner',
    usedStrongerWords,
    strength: answered
      ? words > 40
        ? 'You kept talking — good fluency base'
        : 'Clear, easy to follow'
      : 'You showed up and tried',
    fixFirst:
      fillerCount > 0
        ? `${fillerCount} filler word${fillerCount === 1 ? '' : 's'}`
        : !hasExample
          ? 'Add one concrete example'
          : words < 20
            ? 'Say more — aim for 60–90 words'
            : 'Tighten grammar endings',
    fillers,
    paceWpm: 0,
    answered,
    answeredNote: answered
      ? 'You addressed the topic with a clear main point.'
      : 'We barely caught an answer — speak closer to the mic next time.',
    structure: {
      point: words >= 30,
      reason: hasReason,
      example: hasExample,
      ending: /\b(so|overall|in the end|that's why)\b/i.test(speech),
    },
    structureNote: hasExample
      ? 'Nice structure. Keep a short ending line.'
      : 'Add one real example next time.',
    grammarFixes: speech
      ? [
          { heard: 'I am liking', better: "I've loved" },
          { heard: 'very much interesting', better: 'really interesting' },
        ].filter((f) => speech.toLowerCase().includes(f.heard.toLowerCase().slice(0, 8)))
      : [],
    strongerWords: [
      { weak: 'good', stronger: 'rewarding' },
      { weak: 'help people', stronger: 'make a difference' },
      { weak: 'nice', stronger: 'memorable' },
      { weak: 'very', stronger: 'truly' },
    ].filter((s) => speech.toLowerCase().includes(s.weak.toLowerCase())),
    rewritten: speech
      ? speech.replace(/\s+/g, ' ').replace(/\b(um+|uh+|like|basically)\b/gi, '').trim()
      : `Here's a stronger answer to "${topic}": start with your main point, add one reason, one example, then a short ending.`,
    watchTip:
      fillerCount > 0
        ? `Picked for you because fillers showed up ${fillerCount} time${fillerCount === 1 ? '' : 's'}.`
        : 'Picked to help you stretch vocabulary in the next call.',
    pitch: speech
      ? `"I heard you on “${topic}”. ${
          fillerCount > 0 ? `You used ${fillerCount} fillers` : 'Your ideas were clear'
        } — 30 minutes a day with me fixes exactly this."`
      : `"I didn't catch much that time. Try again, then practise 30 minutes a day with me."`,
    transcript: speech,
  }, { durationSec })
}

function normalizeFreeTestReport(raw, { topic, transcript, durationSec }) {
  const fallback = buildFallbackFreeTestReport({ topic, transcript, durationSec })
  if (!raw || typeof raw !== 'object') return fallback

  const grammarFixes = Array.isArray(raw.grammarFixes)
    ? raw.grammarFixes
        .map((g) => ({
          heard: String(g?.heard || '').trim(),
          better: String(g?.better || '').trim(),
        }))
        .filter((g) => g.heard && g.better)
        .slice(0, 6)
    : fallback.grammarFixes

  const strongerWords = Array.isArray(raw.strongerWords)
    ? raw.strongerWords
        .map((s) => ({
          weak: String(s?.weak || '').trim(),
          stronger: String(s?.stronger || '').trim(),
        }))
        .filter((s) => s.weak && s.stronger)
        .slice(0, 4)
    : fallback.strongerWords

  const fillers = Array.isArray(raw.fillers)
    ? raw.fillers.map((f) => String(f).trim()).filter(Boolean).slice(0, 8)
    : fallback.fillers

  const structure = raw.structure && typeof raw.structure === 'object' ? raw.structure : {}
  const listedWeakerWords =
    Array.isArray(raw.strongerWords) &&
    raw.strongerWords.some((s) => String(s?.weak || '').trim() && String(s?.stronger || '').trim())
  const usedStrongerWords = listedWeakerWords
    ? false
    : typeof raw.usedStrongerWords === 'boolean'
      ? raw.usedStrongerWords
      : strongerWords.length === 0

  return applyStrictLevel({
    overall: clampOverall(Number(raw.overall)),
    level: 'Beginner',
    usedStrongerWords,
    strength: String(raw.strength || fallback.strength).slice(0, 120),
    fixFirst: String(raw.fixFirst || fallback.fixFirst).slice(0, 120),
    fillers,
    paceWpm: Math.max(0, Math.round(Number(raw.paceWpm) || fallback.paceWpm)),
    answered: raw.answered === true && raw.onTopic !== false && wordCount(transcript) >= 25,
    answeredNote: String(raw.answeredNote || fallback.answeredNote).slice(0, 200),
    structure: {
      point: Boolean(structure.point ?? fallback.structure.point),
      reason: Boolean(structure.reason ?? fallback.structure.reason),
      example: Boolean(structure.example ?? fallback.structure.example),
      ending: Boolean(structure.ending ?? fallback.structure.ending),
    },
    structureNote: String(raw.structureNote || fallback.structureNote).slice(0, 200),
    grammarFixes: grammarFixes.length ? grammarFixes : fallback.grammarFixes,
    strongerWords: strongerWords.length ? strongerWords : fallback.strongerWords,
    rewritten: String(raw.rewritten || fallback.rewritten).slice(0, 800),
    watchTip: String(raw.watchTip || fallback.watchTip).slice(0, 200),
    pitch: String(raw.pitch || fallback.pitch).slice(0, 280),
    transcript: String(transcript || '').trim(),
  }, { durationSec })
}

export async function evaluateFreeTestWithGemini({ topic, transcript, durationSec = 60 }) {
  const speech = String(transcript || '').trim()
  if (!speech) {
    return {
      report: buildFallbackFreeTestReport({ topic, transcript: '', durationSec }),
      model: null,
      usage: null,
    }
  }

  const apiKey = resolveApiKey(process.env)
  if (!apiKey) {
    return {
      report: buildFallbackFreeTestReport({ topic, transcript: speech, durationSec }),
      model: null,
      usage: null,
    }
  }

  const systemInstruction = `You are a strict English speaking examiner for Yappply's free 60-second test.
Return ONLY JSON matching the schema. Judge only the learner's actual words. Do not be generous.
The server replaces overall and level. Still set overall yourself, harshly:
0–15 if they did not answer the topic, 16–45 for a thin or poorly built answer, 46–65 beginner, 66–90 intermediate, above 90 only for a precise, accurate, fully structured minute.
answered and onTopic are true ONLY when the speech directly answers THIS topic with a real point. Off-topic talk, "I don't know", silence, repeating the question, or a few vague words means both are false.
If answered or onTopic is false, point, reason, example, and ending must all be false, and overall must be 15 or below.
point is true only for a clear main idea that answers the topic. reason is true only for a real because. example is true only for a specific person, place, time, or event. ending is true only for a closing line.
usedStrongerWords is true only for precise vocabulary. Basic words (good, nice, very, thing, stuff) mean false.
grammarFixes: every clear grammar mistake, up to 6. Do not hide errors.
strongerWords: up to 4 weak → stronger swaps. Empty when usedStrongerWords is true.
fillers: filler words they used. paceWpm: words per minute across the full 60 seconds.
rewritten: a polished 2–4 sentence version of THEIR answer. pitch: one short quote from Yappy about what they said.`

  const prompt = `Free 60-second speaking test.

Topic: ${topic}
Duration: ${durationSec} seconds
Learner speech:
"""
${speech.slice(0, 3500)}
"""

Produce the free-test report JSON now.`

  try {
    const result = await generateText(apiKey, {
      systemInstruction,
      prompt,
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 2500,
        responseMimeType: 'application/json',
        responseSchema: FREE_TEST_REPORT_SCHEMA,
      },
    })

    let parsed
    try {
      parsed = JSON.parse(result.text)
    } catch {
      throw new Error('Invalid free-test JSON from model')
    }

    return {
      report: normalizeFreeTestReport(parsed, { topic, transcript: speech, durationSec }),
      model: result.model,
      usage: result.usage,
    }
  } catch (err) {
    console.warn('Free-test evaluate failed, using fallback', err)
    return {
      report: buildFallbackFreeTestReport({ topic, transcript: speech, durationSec }),
      model: null,
      usage: null,
    }
  }
}
