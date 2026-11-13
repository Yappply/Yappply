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
  if (!Number.isFinite(n)) return 55
  return Math.max(0, Math.min(100, Math.round(n)))
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

function applyStrictLevel(report) {
  const grammarErrors = Array.isArray(report.grammarFixes) ? report.grammarFixes.length : 0
  const structureProblems = structureProblemCount(report.structure)
  const usedStrongerWords = report.usedStrongerWords === true
  let overall = clampOverall(report.overall)

  if (!usedStrongerWords && grammarErrors > 2 && structureProblems > 2) {
    overall = Math.min(overall, 65)
  }

  return {
    ...report,
    overall,
    level: levelForOverall(overall),
  }
}

export function buildFallbackFreeTestReport({ topic, transcript, durationSec = 60 }) {
  const speech = String(transcript || '').trim()
  const words = wordCount(speech)
  const fillers = detectFillers(speech)
  const fillerCount = (speech.match(FILLER_RE) || []).length
  const minutes = Math.max(durationSec / 60, 0.4)
  const paceWpm = words ? Math.round(words / minutes) : 0
  const answered = words >= 12
  const hasExample = /\b(for example|for instance|like when|one time|last year|yesterday)\b/i.test(
    speech,
  )
  const hasReason = /\b(because|so that|that's why|since)\b/i.test(speech)
  const overall = !speech
    ? 0
    : clampOverall(
        45 +
          Math.min(35, words * 0.6) -
          fillerCount * 3 +
          (answered ? 8 : 0) +
          (hasExample ? 6 : 0) +
          (hasReason ? 4 : 0),
      )

  const usedStrongerWords = ![
    { weak: 'good' },
    { weak: 'help people' },
    { weak: 'nice' },
    { weak: 'very' },
  ].some((s) => speech.toLowerCase().includes(s.weak.toLowerCase()))

  return applyStrictLevel({
    overall,
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
    paceWpm,
    answered,
    answeredNote: answered
      ? 'You addressed the topic with a clear main point.'
      : 'We barely caught an answer — speak closer to the mic next time.',
    structure: {
      point: answered,
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
  })
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
    answered: Boolean(raw.answered ?? fallback.answered),
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
  })
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

  const systemInstruction = `You are Yappy, a friendly English speaking coach for Yappply's free 60-second test.
Return ONLY JSON matching the schema. Base every note on the learner's actual words.
overall is 0–100. Do not add a qualifier to level — the server sets it:
Beginner when overall is 65 or less, Intermediate from 66 to 90, Advanced only above 90.
usedStrongerWords is true only when the learner actually used precise, specific vocabulary. Set it false when they stayed with basic words (good, nice, very, thing, stuff, a lot) and never upgraded them.
If usedStrongerWords is false AND there are more than 2 grammarFixes AND more than 2 of point/reason/example/ending are missing, set overall to 65 or below. That learner is a Beginner.
fillers lists filler words/phrases they used (umm, like, basically…).
paceWpm is estimated words per minute for the full 60-second answer.
grammarFixes: every clear grammar mistake from their speech, up to 6, each with a natural correction. Do not stop at one example when you hear more.
strongerWords: up to 4 weak → stronger swaps from their speech. Leave this empty when usedStrongerWords is true.
rewritten: a polished 2–4 sentence version of THEIR answer to the topic.
pitch: one short quote from Yappy referring to what they said.
Be constructive and specific.`

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
        temperature: 0.35,
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
