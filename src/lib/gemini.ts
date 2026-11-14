import type { ChatMessage, Topic, TurnMode, VoiceReply } from '../types'
import { authHeaders } from './api'
import { bumpPracticeTurn, getPracticeContext } from './practiceContext'
import type { Level } from './storage'

const SYSTEM = `You are Yappy — a friendly English practice partner on a live voice call for BEGINNERS.

WHO YOU ARE:
- A curious friend having a real chat — not a form, not a quiz, not an interview.
- You remember what they already said and build on it.
- You dig into what they just said before you change the subject.
- Patient, clear, warm. Simple English only.

WHO YOU ARE NOT:
- Not an interviewer. Not a call-center agent. Not a robot reading a checklist.
- Not Gen Z / slangy. No "yass", "lit", "vibe", "no cap", "bestie", "hype", "OMG", "lol", or "Heyyy".
- Never sound bored, cold, or too formal.

MEMORY (critical):
- Keep the lesson context for the whole call.
- Use facts they already shared (name, city, study/work, family, hobbies, goals).
- Refer back naturally: "You said you live in …" / "Earlier you told me …"
- Never ask again for a fact they already answered clearly.

CONVERSATION STYLE (critical):
- React to THEIR words first, then ask ONE curious follow-up about that same thing.
- Stay on one life topic for several turns. Explore feelings, examples, people, places, times, likes/dislikes.
- Example: they say "I live in Islamabad" → city feel, famous place, what they like — BEFORE birthday or work.
- Example: they say "I paint and cook" → which they like more, last time, who with — BEFORE goals.
- Do NOT rush to the next checklist item after one short answer.
- Do NOT sound like an interview ("Next question…", "Moving on…", "Please state…").
- Almost never say "Thank you" / "Thanks". Never start with "Very good!" every turn.
- Appreciate briefly and CHANGE the phrase every turn: "Nice!", "Oh I see.", "That is interesting.", "Lovely.", "Cool.", "I like that.", "Wonderful.", "Okay, got it."
- Use ONLY simple everyday words. Short sentences (about 5–14 words).
- One natural follow-up question at the end of every chat turn, including right after they repeat a correction correctly.
- After a correct repeat: praise in one short phrase AND ask the next lesson question in that SAME reply. Never stop after praise alone ("Wonderful." with no question is wrong).
- When correcting: "Almost. Please say: … Now you try."

30-MINUTE PACING:
- This call can last up to 30 minutes. Stretch each lesson topic with new angles.
- Prefer depth over speed. Do not finish the whole checklist in a few minutes.
- If a topic still has unused angles, stay there. Invent a fresh simple follow-up from their last answer.
- Only advance when the current topic feels explored, or THIS TURN ACTION says to advance.
- If many topics remain and time is short, move a bit faster. If time remains and topics are few, dig deeper.

ANTI-REPETITION (hard rules for the WHOLE call):
- NEVER ask the same question twice in this lecture — not after 5 minutes, not after 20, not at the end.
- Same meaning counts as the same question (e.g. "Where do you live?" = "Which city do you live in?").
- NEVER reuse anything listed under FORBIDDEN QUESTIONS / ASKED THIS CALL.
- Before you ask, check the full forbidden list. Invent a brand-new angle instead.
- Never repeat the same opener or praise phrase turn after turn.
- If the learner repeats an idea, acknowledge once with a NEW phrase, then ask a NEW angle.

ADAPTIVE:
- If they only study (not work), do NOT push a job interview question. Ask lightly about class, then move on.
- If they only work, skip deep school questions.
- If they say they have no goals / no siblings, accept it kindly, ask one soft follow-up, then move on.

YOU LEAD THE LESSON:
- Cover checklist topics in order as deep friendly chat across ~30 minutes.
- Help them speak about their real life with detail.
- You are responsible for turning the chat back to TODAY'S lesson whenever it drifts.

STAY ON TODAY'S TOPIC (critical):
- Today's lesson title and blurb are the main subject of the whole call.
- If they drift to weather, random news, or another lesson, warmly steer back with a NEW question about today's topic.
- Checklist topics (when given) are the only allowed subjects.
- Never abandon the day's lesson to fill time with unrelated chat.

PRACTICE RULES (compulsory for grammar / structure mistakes):
- You MUST catch and correct grammar mistakes and sentence-structure mistakes. This is required, not optional.
- If the learner's English is broken, incomplete, or wrongly structured, use mode "practice". Do not ignore it to keep chatting.
- If their sentence is already correct English, use mode "chat". Do NOT invent a "nicer" version.
- Real mistakes you MUST correct (examples):
  - "I working in office" → "I work in an office."
  - "She go school every day" → "She goes to school every day."
  - "My name Ahmed" → "My name is Ahmed."
  - "I live Islamabad" → "I live in Islamabad."
  - "I am go to market" → "I go to the market."
  - "He don't like tea" → "He doesn't like tea."
  - "There have many people" → "There are many people."
  - "I can to speak English" → "I can speak English."
  - Word order / missing be / missing articles / wrong tense / subject-verb disagreement
- In practice mode: set correctedSentence to one short correct sentence with THEIR meaning, say "Almost. Please say: … Now you try.", and do NOT ask a new topic question.
- Keep correctedSentence simple (about 4–14 words). One sentence only. Keep their meaning and facts.
- NEVER use practice for:
  - already-correct sentences
  - tiny fine answers like "Yes.", "Okay.", "I am a student.", "I live in Lahore."
  - style preference only
  - accent or pronunciation-only issues
  - inventing jobs/facts they did not say (never "I work as an AI")
- If audio is extremely unclear nonsense: mode "chat", ask them to say the idea again simply.
- If close enough to practiceTarget → mode "chat". Praise once, then ask ONE new lesson question in the SAME reply. The reply must end with "?". Never stop after praise.
- Max 3 practice tries on the SAME correctedSentence. After 3 failed tries: say the correct sentence once, then CONTINUE the lesson in chat. Never stay stuck on that sentence.
- If you are unsure but the sentence looks broken or incomplete, choose mode "practice".

Reply length: 1–3 short sentences.

Return STRICT JSON only:
{
  "reply": "exactly what Yappy says out loud",
  "mode": "chat" | "practice",
  "correctedSentence": "string or null",
  "hadCorrection": true
}
`

function levelHint(level: Level): string {
  switch (level) {
    case 'beginner':
      return 'Learner level: beginner. Use the easiest words and shortest sentences.'
    case 'advanced':
      return 'Learner level: still keep language SIMPLE. A little longer answers OK, but no hard words.'
    default:
      return 'Learner level: easy. Keep words simple and sentences short.'
  }
}

function bandHint(topic: Topic): string {
  // One continuous beginner path — keep language simple for every lesson number.
  if (topic.number <= 10) {
    return `Lesson ${topic.number} of 30. Use the tiniest words. One idea per sentence.`
  }
  return `Lesson ${topic.number} of 30. Still simple words and short sentences. No intermediate or expert language.`
}

function phraseHint(topic: Topic): string {
  if (!topic.phrases?.length) return ''
  if (topic.agenda?.length) {
    return (
      'Helper phrases for this checklist lesson (use lightly while covering agenda items): ' +
      `${topic.phrases.map((p) => `"${p}"`).join(' | ')}`
    )
  }
  return (
    'STORY LESSON — pull out a real story. Ask what happened, who was there, and how they felt. ' +
    'Use these helper phrases inside the conversation when useful (not as a long list drill): ' +
    `${topic.phrases.map((p) => `"${p}"`).join(' | ')}`
  )
}

type AgendaFocus = {
  explored: string[]
  remaining: { id: string; label: string; ask: string }[]
  /** Topic we are currently digging into */
  focus: {
    id: string
    label: string
    ask: string
    explore: string[]
    turnsOnFocus: number
    minTurns: number
    readyToAdvance: boolean
  } | null
  /** Study/work branch from learner answers */
  branch: 'unknown' | 'study' | 'work' | 'both'
  nextAction: string
}

function detectStudyWorkBranch(learnerText: string): AgendaFocus['branch'] {
  const studies =
    /\b(study|studies|studying|student|school|college|university|class)\b/.test(learnerText)
  const works =
    /\b(work|works|working|job|office|employee|business|engineer|teacher|manager)\b/.test(
      learnerText,
    )
  const onlyStudy =
    studies &&
    (/\bonly study|just study|i study\b/.test(learnerText) ||
      /\bi (am|'m) a student\b/.test(learnerText)) &&
    !works
  const onlyWork =
    works &&
    !studies &&
    !/\bstudy|student|school|college|university\b/.test(learnerText)

  if (studies && works) return 'both'
  if (onlyStudy || (studies && !works)) return 'study'
  if (onlyWork || (works && !studies)) return 'work'
  return 'unknown'
}

function itemTouched(
  item: NonNullable<Topic['agenda']>[number],
  learnerText: string,
  messages: ChatMessage[],
): boolean {
  const hit = item.hints.some((h) => learnerText.includes(h.toLowerCase()))
  const nameGuess =
    item.id === 'name' &&
    messages.some((m) => m.role === 'user' && m.text.trim().split(/\s+/).length <= 8)
  return hit || nameGuess
}

/** Count learner turns spent on this item after earlier items were already touched. */
function turnsOnCurrentItem(
  agenda: NonNullable<Topic['agenda']>,
  itemIndex: number,
  messages: ChatMessage[],
): number {
  const item = agenda[itemIndex]
  if (!item) return 0
  const userTurns = messages.filter((m) => m.role === 'user')
  if (!userTurns.length) return 0

  // Do not start this topic's clock until previous topics have been touched at least once
  let earliestStart = 0
  if (itemIndex > 0) {
    for (let prev = 0; prev < itemIndex; prev++) {
      const prevItem = agenda[prev]
      let lastPrev = -1
      for (let i = 0; i < userTurns.length; i++) {
        const text = userTurns[i].text.toLowerCase()
        if (itemTouched(prevItem, text, [userTurns[i]])) lastPrev = i
      }
      if (lastPrev >= 0) earliestStart = Math.max(earliestStart, lastPrev)
    }
  }

  let firstTouch = -1
  for (let i = earliestStart; i < userTurns.length; i++) {
    const text = userTurns[i].text.toLowerCase()
    if (itemTouched(item, text, [userTurns[i]])) {
      firstTouch = i
      break
    }
  }
  // If they answered this topic early (before previous finished), still count from first mention
  if (firstTouch < 0) {
    for (let i = 0; i < userTurns.length; i++) {
      const text = userTurns[i].text.toLowerCase()
      if (itemTouched(item, text, [userTurns[i]])) {
        firstTouch = i
        break
      }
    }
  }
  if (firstTouch < 0) return 0

  // Prefer counting from when we "arrived" at this topic (after previous)
  const start = Math.max(firstTouch, earliestStart)
  return Math.max(1, userTurns.length - start)
}

/** Depth-first agenda: stay on a topic until explored, then advance. */
function agendaCoverage(topic: Topic, messages: ChatMessage[]): AgendaFocus {
  const agenda = topic.agenda || []
  if (!agenda.length) {
    return {
      explored: [],
      remaining: [],
      focus: null,
      branch: 'unknown',
      nextAction: '',
    }
  }

  const learnerText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.text.toLowerCase())
    .join(' \n ')

  const branch = detectStudyWorkBranch(learnerText)

  const explored: string[] = []
  let focusIndex = -1

  for (let i = 0; i < agenda.length; i++) {
    const item = agenda[i]

    // Soft-skip job depth if they only study (after education, or after one light turn)
    if (item.id === 'job' && branch === 'study') {
      const jobTurns = turnsOnCurrentItem(agenda, i, messages)
      if (explored.includes('Education') || jobTurns >= 1 || /i am a student|just a student/.test(learnerText)) {
        explored.push(item.label)
        continue
      }
    }
    // Soft-skip education depth if they only work
    if (item.id === 'education' && branch === 'work') {
      const eduTurns = turnsOnCurrentItem(agenda, i, messages)
      if (eduTurns >= 1 || explored.includes('Study or work')) {
        explored.push(item.label)
        continue
      }
    }

    const touched = itemTouched(item, learnerText, messages)
    const minTurns = item.minTurns ?? 3
    const turns = touched ? turnsOnCurrentItem(agenda, i, messages) : 0
    const ready = touched && turns >= minTurns

    if (ready) {
      explored.push(item.label)
      continue
    }

    // First not-yet-explored item is the focus
    focusIndex = i
    break
  }

  const remaining = agenda
    .filter((a) => !explored.includes(a.label))
    .map((a) => ({ id: a.id, label: a.label, ask: a.ask }))

  if (focusIndex < 0) {
    return {
      explored,
      remaining: [],
      focus: null,
      branch,
      nextAction:
        'All topics explored. Give a short friendly summary of who they are (name, place, study/work, hobbies, goals). Then say the introduction chat is complete. No thank-you spam.',
    }
  }

  const focusItem = agenda[focusIndex]
  const turnsOnFocus = itemTouched(focusItem, learnerText, messages)
    ? turnsOnCurrentItem(agenda, focusIndex, messages)
    : 0
  const minTurns = focusItem.minTurns ?? 3
  const readyToAdvance = turnsOnFocus >= minTurns && itemTouched(focusItem, learnerText, messages)
  const explore = focusItem.explore || []

  // Avoid explore prompts Yappy already asked anywhere in this lecture
  const askedAll = collectAskedQuestions(messages)
  const recentLearner = messages
    .filter((m) => m.role === 'user')
    .slice(-6)
    .map((m) => m.text.toLowerCase())
    .join(' ')
  const freshExplore = explore.filter((q) => {
    if (isQuestionAlreadyAsked(q, askedAll)) return false
    const key = q
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4)
    return !key.some((w) => recentLearner.includes(w) && recentLearner.split(w).length > 2)
  })

  let nextAction: string
  if (!itemTouched(focusItem, learnerText, messages)) {
    nextAction =
      `CURRENT TOPIC (just opening): ${focusItem.label}. Ask naturally: "${focusItem.ask}". ` +
      `Do NOT jump ahead to later topics. Do not re-ask anything already answered in KNOWN FACTS.`
  } else if (!readyToAdvance) {
    const suggestion =
      freshExplore[0] ||
      'Invent ONE brand-new simple follow-up about the detail they just shared (people, place, time, feeling, example). Never repeat an earlier question.'
    nextAction =
      `STAY on "${focusItem.label}" — keep elongating this topic. ` +
      `Turns on this topic: ${turnsOnFocus} of ~${minTurns}+ needed. ` +
      `React to their exact words, then ask a NEW follow-up. Suggested angle: "${suggestion}". ` +
      `Do NOT re-ask "${focusItem.ask}". Do NOT ask about the next checklist item yet. Do NOT sound like an interview.`
  } else {
    const next = agenda[focusIndex + 1]
    if (next) {
      const nextAskUsed = isQuestionAlreadyAsked(next.ask, askedAll)
      nextAction = nextAskUsed
        ? `You have explored "${focusItem.label}" enough. Bridge into "${next.label}" with a NEW question about that topic — do not reuse "${next.ask}" or any ASKED THIS CALL item. React to their last answer first.`
        : `You have explored "${focusItem.label}" enough. Bridge smoothly into "${next.label}": "${next.ask}". Still react to their last answer first. Never repeat an old question from this lecture.`
    } else {
      nextAction =
        'Checklist topics look done. Stay on TODAY\'s lesson with a warm wrap-up: summarize what you learned, then ask one gentle NEW reflection question. Do not restart old checklist questions. Do not leave the lesson.'
    }
  }

  if (focusItem.id === 'job' && branch === 'study') {
    nextAction +=
      ' They mainly STUDY — do not ask what their job is. One light question about being a student in class is enough, then move on.'
  }

  return {
    explored,
    remaining,
    focus: {
      id: focusItem.id,
      label: focusItem.label,
      ask: focusItem.ask,
      explore,
      turnsOnFocus,
      minTurns,
      readyToAdvance,
    },
    branch,
    nextAction,
  }
}

function recentLucyOpeners(messages: ChatMessage[]): string {
  const recent = messages
    .filter((m) => m.role === 'coach')
    .slice(-8)
    .map((m) => {
      const first = m.text.trim().split(/[.!?]/)[0]?.trim() || m.text.trim()
      return first.slice(0, 48)
    })
    .filter(Boolean)
  if (!recent.length) return ''
  return (
    'Do NOT reuse these recent openers/praise lines (vary every turn): ' +
    recent.map((r) => `"${r}"`).join(' | ')
  )
}

function extractQuestions(text: string): string[] {
  const parts = text
    .split(/(?<=[?])\s+|\n+/)
    .map((p) => p.trim())
    .filter((p) => p.includes('?'))
  const loose = text.match(/[^.!?\n]{8,120}\?/g) || []
  return [...parts, ...loose]
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter((q) => q.length >= 8)
}

const QUESTION_STOP =
  /\b(please|can you|could you|would you|tell me|what about|how about|so|and|okay|ok|nice|oh|wow|well|then|now|also|just|really|maybe)\b/g

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(QUESTION_STOP, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function questionContentWords(q: string): Set<string> {
  return new Set(
    normalizeQuestion(q)
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^(the|you|your|are|was|were|did|does|have|has|had|for|with|from|this|that|they|them|their|about)$/.test(w)),
  )
}

function questionsSimilar(a: string, b: string): boolean {
  const na = normalizeQuestion(a)
  const nb = normalizeQuestion(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const wa = questionContentWords(a)
  const wb = questionContentWords(b)
  if (wa.size === 0 || wb.size === 0) return false
  let shared = 0
  for (const w of wa) {
    if (wb.has(w)) shared += 1
  }
  const overlap = shared / Math.max(wa.size, wb.size)
  return overlap >= 0.72 || (shared >= 3 && overlap >= 0.55)
}

function collectAskedQuestions(messages: ChatMessage[]): string[] {
  const ordered: string[] = []
  const norms: string[] = []
  for (const m of messages.filter((x) => x.role === 'coach')) {
    for (const q of extractQuestions(m.text)) {
      const clean = q.replace(/\s+/g, ' ').trim().slice(0, 100)
      if (clean.length < 8) continue
      if (norms.some((n) => questionsSimilar(n, clean))) continue
      ordered.push(clean)
      norms.push(clean)
    }
  }
  return ordered
}

function isQuestionAlreadyAsked(candidate: string, asked: string[]): boolean {
  return asked.some((prev) => questionsSimilar(prev, candidate))
}

function forbiddenQuestions(messages: ChatMessage[]): string {
  const list = collectAskedQuestions(messages)
  if (!list.length) return ''
  // Keep the FULL lecture list — this is what stops repeats after 20+ minutes
  return (
    `ASKED THIS CALL — FULL LIST (${list.length}). Never ask any of these again, even rephrased: ` +
    list.map((q) => `"${q}"`).join(' | ')
  )
}

function learnerMemory(messages: ChatMessage[]): string {
  const pairs: string[] = []
  for (let i = 0; i < messages.length - 1; i++) {
    const a = messages[i]
    const b = messages[i + 1]
    if (a.role !== 'coach' || b.role !== 'user') continue
    const ask = extractQuestions(a.text)[0] || a.text.split(/[.!]/)[0] || a.text
    const answer = b.text.trim()
    if (!answer) continue
    pairs.push(`Q: ${ask.trim().slice(0, 70)} → A: ${answer.slice(0, 90)}`)
  }
  if (!pairs.length) return ''
  return (
    'KNOWN FACTS FROM THIS WHOLE CALL (use these; do not re-ask): ' +
    pairs.join(' || ')
  )
}

function lessonAnchor(topic: Topic): string {
  const phraseBit = topic.phrases?.length
    ? ` Useful lesson phrases: ${topic.phrases.slice(0, 8).map((p) => `"${p}"`).join(' | ')}.`
    : ''
  return (
    `TODAY'S LESSON ANCHOR (never leave this lecture): Lesson ${topic.number} — "${topic.title}". ` +
    `${topic.blurb}.${phraseBit} ` +
    'If the learner drifts, warmly turn the conversation back to this lesson with a NEW on-topic question.'
  )
}

function steerBackHint(topic: Topic, userText: string): string {
  const text = userText.toLowerCase()
  const lessonWords = tokenize(`${topic.title} ${topic.blurb} ${(topic.phrases || []).join(' ')}`)
  const userWords = tokenize(userText)
  let hit = 0
  for (const w of userWords) {
    if (lessonWords.has(w)) hit += 1
  }
  const offTopicNoise =
    /\b(weather|football score|cricket score|news|politics|youtube|instagram|tiktok|movie star)\b/.test(
      text,
    )
  if (!offTopicNoise && (userWords.size === 0 || hit > 0 || userText.trim().length < 12)) {
    return ''
  }
  if (offTopicNoise || (userWords.size >= 4 && hit === 0)) {
    return (
      `STEER BACK: their last turn looks off today's lesson "${topic.title}". ` +
      `Acknowledge briefly, then ask a NEW simple question that returns to this lesson. Do not follow the off-topic path.`
    )
  }
  return ''
}

function pacingHint(elapsedMs?: number, remainingTopics?: number): string {
  if (elapsedMs == null || !Number.isFinite(elapsedMs)) return ''
  const minutes = Math.max(0, Math.round(elapsedMs / 60000))
  const left = Math.max(0, 30 - minutes)
  if (minutes < 8) {
    return `PACING: only ~${minutes} min used, ~${left} min left. Stay deep on the current topic. Do not rush ahead. Never recycle old questions.`
  }
  if (minutes < 20) {
    return `PACING: ~${minutes} min used, ~${left} min left. Keep exploring with BRAND-NEW angles only. Advance only when THIS TURN ACTION says so.`
  }
  if ((remainingTopics ?? 0) > 2) {
    return `PACING: ~${minutes} min used, ~${left} min left, and several topics remain. One solid NEW follow-up, then advance. Do not repeat earlier questions from this call.`
  }
  return `PACING: ~${minutes} min used, ~${left} min left. Late-call risk of repeats is HIGH. Dig deeper with completely fresh follow-ups tied to today's lesson. Never reuse ASKED THIS CALL items.`
}

function agendaHint(topic: Topic, messages: ChatMessage[], elapsedMs?: number): string {
  if (!topic.agenda?.length) return ''
  const { explored, remaining, focus, branch, nextAction } = agendaCoverage(topic, messages)
  const order = topic.agenda
    .map((a, i) => {
      const extras =
        a.explore?.length
          ? ` Explore angles: ${a.explore.map((e) => `"${e}"`).join('; ')}`
          : ''
      return `${i + 1}. ${a.label} — open once with "${a.ask}". Stay ~${a.minTurns ?? 3}+ turns with NEW follow-ups.${extras}`
    })
    .join('\n')

  return [
    'LESSON CHECKLIST — DEEP 30-MINUTE CONVERSATION (HARD RULES):',
    'Goal: sustain an engaging lesson chat for up to ~30 minutes. Cover topics IN ORDER, with real depth.',
    'NEVER do interview style (one short Q → next topic). That is forbidden.',
    'For each topic: open once → react → several curious follow-ups about THEIR answer → then move on.',
    'Examples of good depth: city → famous places / what they like; hobbies → favorite / last time; family → older-younger / time together.',
    'Do NOT say thank you / thanks. Vary short appreciation. Never "Very good!" every turn.',
    'Do NOT talk about weather, news, or anything outside this list.',
    'Never re-ask any question from earlier in THIS lecture — check the full ASKED THIS CALL list every turn.',
    'If the learner leaves the lesson, steer them back to the current focus / today\'s checklist.',
    'Topics in order:',
    order,
    explored.length
      ? `Already explored (do not restart these): ${explored.join(', ')}.`
      : 'Nothing explored yet — open the first topic warmly.',
    remaining.length
      ? `Still ahead: ${remaining.map((r) => r.label).join(', ')}.`
      : 'All topics explored — reflective wrap-up on TODAY\'s lesson only, still no repeated questions.',
    focus
      ? `FOCUS NOW: ${focus.label} (turns ${focus.turnsOnFocus}/${focus.minTurns}+). Opening ask was "${focus.ask}" — only use it if not answered yet.`
      : '',
    branch !== 'unknown' ? `Study/work branch detected: ${branch}. Adapt education vs job questions.` : '',
    pacingHint(elapsedMs, remaining.length),
    `THIS TURN ACTION: ${nextAction}`,
    recentLucyOpeners(messages),
    forbiddenQuestions(messages),
    learnerMemory(messages),
  ]
    .filter(Boolean)
    .join('\n')
}

function historyBlock(messages: ChatMessage[], keep = 8): string {
  return messages
    .slice(-keep)
    .map((m) => `${m.role === 'user' ? 'Learner' : 'Yappy'}: ${m.text}`)
    .join('\n')
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

function repetitionHint(messages: ChatMessage[], userText: string): string {
  const currentNorm = userText.trim().toLowerCase()
  const earlierUser = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.text.trim())
    .filter(Boolean)
    .filter((t) => t.toLowerCase() !== currentNorm)
    .slice(-4)

  if (earlierUser.length < 1) return ''

  const current = tokenize(userText)
  if (current.size === 0) return ''

  let maxOverlap = 0
  for (const prev of earlierUser) {
    const earlier = tokenize(prev)
    if (earlier.size === 0) continue
    let shared = 0
    for (const w of current) {
      if (earlier.has(w)) shared += 1
    }
    const overlap = shared / Math.max(current.size, earlier.size)
    if (overlap > maxOverlap) maxOverlap = overlap

    const b = prev.toLowerCase()
    if (
      currentNorm === b ||
      (currentNorm.length > 12 && (currentNorm.includes(b) || b.includes(currentNorm)))
    ) {
      maxOverlap = Math.max(maxOverlap, 0.9)
    }
  }

  if (maxOverlap < 0.45) return ''

  return (
    'REPETITION DETECTED: the learner is saying similar things again. ' +
    'Say okay once, then ask a NEW simple question in THIS lesson only.'
  )
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1].trim() : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON in model response')
  return JSON.parse(body.slice(start, end + 1))
}

const ABSURD_CORRECTION =
  /\b(as an ai|as a ai|i am an? ai|i'?m an? ai|robot|chatgpt|language model|artificial intelligence)\b/i

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Reject invented / nonsense practice, and reject "corrections" of already-correct speech. */
function isSensibleCorrection(userText: string, corrected: string | null): boolean {
  if (!corrected) return false
  const clean = corrected.trim()
  if (clean.length < 4 || clean.length > 140) return false
  if (ABSURD_CORRECTION.test(clean)) return false
  if (!/[a-z]/i.test(clean)) return false
  if (
    !/\b(i|i'm|im|my|he|she|they|we|you|it|this|that|there)\b/i.test(clean) &&
    clean.split(/\s+/).length < 3
  ) {
    return false
  }

  const userNorm = normalizeForCompare(userText)
  const fixNorm = normalizeForCompare(clean)
  // Exact same text → not a real correction
  if (userNorm === fixNorm) return false

  const user = tokens(userText)
  const fix = tokens(clean)
  if (fix.size === 0) return false

  let shared = 0
  for (const w of fix) {
    if (user.has(w)) shared += 1
  }
  // Small function-word fixes ("in", "is", "to", "a") may share little content — still OK if short
  const smallFix = Math.abs(fixNorm.length - userNorm.length) <= 12 && fix.size <= user.size + 3
  if (user.size >= 3 && shared === 0 && !smallFix) return false

  return true
}

const GRAMMAR_MISTAKE_PATTERNS: RegExp[] = [
  /\bi\s+working\b/,
  /\bi\s+going\b(?!\s+to\b)/,
  /\bi\s+living\b/,
  /\bi\s+studying\b(?!\s+at\b|\s+in\b)/,
  /\b(he|she)\s+go\b/,
  /\b(he|she)\s+have\b/,
  /\b(he|she)\s+don't\b/,
  /\bi am go\b/,
  /\bi am come\b/,
  /\bi am want\b/,
  /\bi am like\b/,
  /\bi liking\b/,
  /\bi wanting\b/,
  /\bdon't can\b/,
  /\bcan not to\b/,
  /\bcan to\b/,
  /\bmust to\b/,
  /\bshould to\b/,
  /\bmy name\s+(?!is\b)[a-z]/,
  /\bi live (?!in\b|near\b|with\b|at\b)[a-z]/,
  /\bi work (?!in\b|at\b|as\b|with\b|for\b)[a-z]/,
  /\bi study (?!in\b|at\b|with\b)[a-z]/,
  /\bthere (have|has)\b/,
  /\bi no (have|like|want|know)\b/,
  /\bhe no\b/,
  /\bshe no\b/,
  /\bi very like\b/,
  /\bmore better\b/,
  /\bmore easier\b/,
  /\bi didn't went\b/,
  /\bi didn't saw\b/,
  /\bi didn't came\b/,
  /\bi am agree\b/,
  /\bi interested\b(?!\s+in\b)/,
  /\bi born\b/,
  /\bi from\b(?!\s+[A-Z])/, // "I from Pakistan" without am
]

export function hasClearGrammarIssue(userText: string): boolean {
  const t = userText.trim()
  if (t.length < 3) return false
  // Tiny answers that are fine
  if (/^(yes|no|okay|ok|yeah|yep|sure|hello|hi|thanks|thank you)[.!]?$/i.test(t)) return false
  const lower = t.toLowerCase()
  if (GRAMMAR_MISTAKE_PATTERNS.some((p) => p.test(lower))) return true
  // Missing "be" after subject pronoun + noun/adjective: "I student", "She happy"
  if (/\b(i|he|she|they|we|you)\s+(student|teacher|doctor|engineer|happy|sad|busy|tired|hungry|from)\b/i.test(lower)) {
    return true
  }
  // Broken continuous without be: "I going", already covered; "He working"
  if (/\b(he|she|they|we|you)\s+\w+ing\b/i.test(lower) && !/\b(he|she|they|we|you)\s+(am|is|are|was|were|be)\b/i.test(lower)) {
    if (!/\b(he|she|they|we|you)\s+(something|anything|nothing|everything)\b/i.test(lower)) {
      return /\bing\b/.test(lower)
    }
  }
  return false
}

/** Flag clearly broken patterns — force practice when found. */
function grammarIssueHint(userText: string): string {
  if (!hasClearGrammarIssue(userText)) return ''
  return (
    'GRAMMAR ALERT (compulsory): this learner sentence has a grammar or structure mistake. ' +
    'You MUST use mode "practice" with a short correctedSentence that keeps THEIR meaning. ' +
    'Do not stay in chat. Do not skip the correction.'
  )
}

/** Lightweight local fixes when the model skips an obvious mistake. */
function localGrammarFix(userText: string): string | null {
  const t = userText.trim().replace(/\s+/g, ' ')
  if (!t) return null
  let out = t
  const rules: Array<[RegExp, string]> = [
    [/\bI working\b/i, 'I work'],
    [/\bI going\b(?!\s+to\b)/i, 'I go'],
    [/\bI living\b/i, 'I live'],
    [/\bI am go\b/i, 'I go'],
    [/\bI am come\b/i, 'I come'],
    [/\bI am want\b/i, 'I want'],
    [/\bI am like\b/i, 'I like'],
    [/\bI liking\b/i, 'I like'],
    [/\bI wanting\b/i, 'I want'],
    [/\bMy name (?!is\b)/i, 'My name is '],
    [/\bI live (?!in\b|near\b|with\b|at\b)/i, 'I live in '],
    [/\bI work (?!in\b|at\b|as\b|with\b|for\b)/i, 'I work in '],
    [/\bI study (?!in\b|at\b|with\b)/i, 'I study at '],
    [/\b(He|She) go\b/i, '$1 goes'],
    [/\b(He|She) have\b/i, '$1 has'],
    [/\b(He|She) don't\b/i, "$1 doesn't"],
    [/\bcan to\b/i, 'can'],
    [/\bmust to\b/i, 'must'],
    [/\bshould to\b/i, 'should'],
    [/\bthere (have|has)\b/i, 'there are'],
    [/\bI no (have|like|want|know)\b/i, "I don't $1"],
    [/\bI didn't went\b/i, "I didn't go"],
    [/\bI didn't saw\b/i, "I didn't see"],
    [/\bI didn't came\b/i, "I didn't come"],
    [/\bI am agree\b/i, 'I agree'],
    [/\bI interested\b(?!\s+in\b)/i, 'I am interested'],
    [/\bI born\b/i, 'I was born'],
    [/\bI from\b/i, 'I am from'],
    [/\bI student\b/i, 'I am a student'],
    [/\bI teacher\b/i, 'I am a teacher'],
    [/\bI doctor\b/i, 'I am a doctor'],
  ]
  for (const [re, rep] of rules) {
    if (re.test(out)) out = out.replace(re, rep)
  }
  out = out.replace(/\s+/g, ' ').trim()
  if (!out.endsWith('.') && !out.endsWith('?') && !out.endsWith('!')) out += '.'
  out = out.charAt(0).toUpperCase() + out.slice(1)
  if (normalizeForCompare(out) === normalizeForCompare(t)) return null
  if (!isSensibleCorrection(t, out)) return null
  return out
}

function replyHasQuestion(reply: string): boolean {
  return /\?/.test(reply)
}

function withQuestionMark(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'Can you tell me a little more?'
  return trimmed.endsWith('?') ? trimmed : `${trimmed.replace(/[.!\s]+$/, '')}?`
}

/** After a correct repeat, pick one unused lesson question so praise is never the whole turn. */
function questionAfterPractice(topic: Topic, messages: ChatMessage[]): string {
  if (topic.agenda?.length) {
    const { focus, remaining } = agendaCoverage(topic, messages)
    const asked = collectAskedQuestions(messages)
    if (focus) {
      const fresh = (focus.explore || []).find((q) => !isQuestionAlreadyAsked(q, asked))
      if (fresh && !focus.readyToAdvance) return withQuestionMark(fresh)
      const next = remaining[0]
      if (focus.readyToAdvance && next?.ask && !isQuestionAlreadyAsked(next.ask, asked)) {
        return withQuestionMark(next.ask)
      }
      if (fresh) return withQuestionMark(fresh)
      return withQuestionMark(`What else can you tell me about ${focus.label}`)
    }
    if (remaining[0]?.ask) return withQuestionMark(remaining[0].ask)
  }
  return withQuestionMark(`What else can you tell me about ${topic.title}`)
}

function praiseThenQuestion(reply: string, question: string): string {
  if (replyHasQuestion(reply)) return reply.trim()
  const praise = reply.trim().split(/[.!?]/)[0]?.trim() || 'Nice'
  return `${praise}. ${withQuestionMark(question)}`
}

function normalize(
  data: unknown,
  practiceTarget: string | null,
  userText: string,
): VoiceReply {
  const d = data as Partial<VoiceReply> & { correctedSentence?: string | null }
  const reply =
    typeof d.reply === 'string' && d.reply.trim()
      ? d.reply.trim()
      : 'Okay. Tell me a little more about that.'

  let mode: TurnMode = d.mode === 'practice' || d.mode === 'chat' ? d.mode : 'chat'
  let correctedSentence =
    typeof d.correctedSentence === 'string' && d.correctedSentence.trim()
      ? d.correctedSentence.trim()
      : null
  let hadCorrection = Boolean(d.hadCorrection)

  if (mode === 'practice') {
    hadCorrection = true
    if (!correctedSentence) correctedSentence = practiceTarget
    if (!isSensibleCorrection(userText, correctedSentence)) {
      mode = 'chat'
      correctedSentence = null
      hadCorrection = false
    }
  } else {
    correctedSentence = null
    hadCorrection = false
  }

  return { reply, mode, correctedSentence, hadCorrection }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function generateViaProxy(
  prompt: string,
  opts: { callType?: string; userText?: string } = {},
): Promise<string> {
  const practice = getPracticeContext()
  const turnIndex = bumpPracticeTurn()
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      systemInstruction: SYSTEM,
      prompt,
      sessionId: practice.sessionId,
      lessonId: practice.lessonId,
      turnIndex,
      callType: opts.callType || 'conversation',
      userText: opts.userText || '',
    }),
  })
  const json = (await res.json()) as { text?: string; error?: string }
  if (!res.ok) {
    throw new Error(json.error || `Generate failed (${res.status})`)
  }
  if (!json.text) throw new Error('Empty model response')
  return json.text
}

export async function warmGemini(): Promise<void> {
  try {
    await fetch('/api/warm', { method: 'POST', headers: authHeaders() })
  } catch {
    /* ignore */
  }
}

export async function converseTurn(params: {
  topic: Topic
  level: Level
  messages: ChatMessage[]
  userText: string
  confidence?: number
  practiceTarget: string | null
  practiceAttempts: number
  elapsedMs?: number
}): Promise<VoiceReply> {
  const {
    topic,
    level,
    messages,
    userText,
    confidence,
    practiceTarget,
    practiceAttempts,
    elapsedMs,
  } = params

  const veryLowConfidence = typeof confidence === 'number' && confidence < 0.4
  const confNote =
    typeof confidence === 'number'
      ? `Speech confidence: ${(confidence * 100).toFixed(0)}%${
          veryLowConfidence
            ? ' (VERY LOW — if the text is near nonsense, stay in chat and ask them to repeat. If the text still shows a clear grammar mistake, you may still use practice.)'
            : confidence < 0.7
              ? ' (a bit unclear — still correct clear grammar mistakes with practice mode)'
              : ''
        }`
      : ''

  const practiceNote = practiceTarget
    ? `PRACTICE MODE ON. practiceTarget="${practiceTarget}". attempts=${practiceAttempts} of 3. Learner must repeat that exact sentence. If close enough OR already correct → mode=chat. Praise in ONE short phrase, then ask ONE new lesson question in the SAME reply. The reply MUST end with "?". Never stop after praise alone. If still wrong and attempts < 3 → mode=practice again with the SAME correctedSentence and no new question. If attempts already reached 3 → mode=chat: say the correct sentence once, then CONTINUE with a new lesson question. Do not stay stuck on this sentence. Never invent jobs like "AI".`
    : `Compulsory: correct REAL grammar and sentence-structure mistakes with mode="practice" and a short correctedSentence keeping THEIR meaning. If the sentence is already right, mode MUST be "chat". If the sentence is broken/incomplete/wrong structure, you MUST use practice — do not skip it. Never invent facts/jobs. If unsure but it looks broken, choose practice.`

  const divertNote = practiceTarget ? '' : repetitionHint(messages, userText)
  const checklist = agendaHint(topic, messages, elapsedMs)
  const asked = collectAskedQuestions(messages)
  const historyKeep = topic.agenda?.length ? 60 : 28
  const focusLabel =
    topic.agenda?.length && checklist.includes('FOCUS NOW:')
      ? checklist.match(/FOCUS NOW: ([^(]+)/)?.[1]?.trim()
      : topic.title

  const buildPrompt = (extra = '') =>
    [
      levelHint(level),
      bandHint(topic),
      phraseHint(topic),
      lessonAnchor(topic),
      checklist,
      'Use simple words only. Short sentences. No slang. No Gen Z talk.',
      topic.agenda?.length
        ? 'Lead a deep friendly chat for up to ~30 minutes on TODAY\'s lesson only. Keep full-call memory. Explore the CURRENT topic before advancing. Never repeat any earlier question from this lecture.'
        : 'YOU lead a natural conversation for up to ~30 minutes on TODAY\'s lesson only. Keep full-call memory. Never repeat any earlier question from this lecture.',
      pacingHint(elapsedMs, topic.agenda?.length ? undefined : 0),
      recentLucyOpeners(messages),
      forbiddenQuestions(messages),
      learnerMemory(messages),
      steerBackHint(topic, userText),
      'Recent chat:',
      historyBlock(messages, historyKeep) || '(just starting)',
      `Learner just said: "${userText}"`,
      confNote,
      practiceNote,
      grammarIssueHint(userText),
      divertNote,
      extra,
      practiceTarget
        ? 'If their repeat is close enough or already correct: mode=chat, one short praise, then ONE new lesson question in that SAME reply. The reply MUST contain "?". Do not stop after praise. If the repeat is still wrong, mode=practice and do not ask a new question. JSON only.'
        : topic.agenda?.length
          ? 'Simple English. You MUST practice-correct clear grammar/structure mistakes. If already correct, stay in chat. Then use KNOWN FACTS and ask ONE brand-new follow-up (not in ASKED THIS CALL) unless THIS TURN ACTION says to advance. If they drifted, steer back. No thank you. JSON only.'
          : 'Simple English. You MUST practice-correct clear grammar/structure mistakes. If already correct, stay in chat and ask ONE brand-new question not in ASKED THIS CALL. If they drifted, steer back. JSON only.',
    ]
      .filter(Boolean)
      .join('\n')

  const callType = practiceTarget ? 'correction' : 'conversation'
  const text = await generateViaProxy(buildPrompt(), { callType, userText })
  let normalized = normalize(extractJson(text), practiceTarget, userText)

  // Model skipped an obvious grammar mistake — force one practice retry, then local fallback
  if (normalized.mode === 'chat' && !practiceTarget && hasClearGrammarIssue(userText)) {
    try {
      const retryRaw = await generateViaProxy(
        buildPrompt(
          'CRITICAL RETRY: the learner sentence has a grammar/structure mistake. ' +
            'You MUST return mode "practice" with correctedSentence (short, their meaning). Do not use chat.',
        ),
        { callType: 'correction', userText },
      )
      const retried = normalize(extractJson(retryRaw), practiceTarget, userText)
      if (retried.mode === 'practice' && retried.correctedSentence) {
        normalized = retried
      }
    } catch {
      /* fall through to local fix */
    }
    if (normalized.mode !== 'practice') {
      const local = localGrammarFix(userText)
      if (local) {
        normalized = {
          reply: `Almost. Please say: ${local} Now you try.`,
          mode: 'practice',
          correctedSentence: local,
          hadCorrection: true,
        }
      }
    }
  }

  // If Yappy reused an old question, regenerate once with a hard ban
  if (normalized.mode === 'chat' && !practiceTarget) {
    const newQs = extractQuestions(normalized.reply)
    const reused = newQs.find((q) => isQuestionAlreadyAsked(q, asked))
    if (reused) {
      try {
        const retryRaw = await generateViaProxy(
          buildPrompt(
            `CRITICAL RETRY: your previous question was a REPEAT of "${reused}". ` +
              `Ask a completely different NEW question about "${focusLabel || topic.title}". ` +
              'Do not reuse any item from ASKED THIS CALL.',
          ),
          { callType: 'conversation', userText },
        )
        const retried = normalize(extractJson(retryRaw), practiceTarget, userText)
        const retryQs = extractQuestions(retried.reply)
        const stillBad = retryQs.some((q) => isQuestionAlreadyAsked(q, asked))
        if (!stillBad) {
          normalized = retried
        } else {
          normalized = {
            reply: `That is interesting. Tell me one new thing about ${focusLabel || topic.title}.`,
            mode: 'chat',
            correctedSentence: null,
            hadCorrection: false,
          }
        }
      } catch {
        normalized = {
          reply: `Okay. What is one more simple detail about ${focusLabel || topic.title}?`,
          mode: 'chat',
          correctedSentence: null,
          hadCorrection: false,
        }
      }
    }
  }

  // A correct repeat must praise AND ask the next question in the same turn.
  if (practiceTarget && practiceAttempts < 3 && normalized.mode === 'chat' && !replyHasQuestion(normalized.reply)) {
    try {
      const retryRaw = await generateViaProxy(
        buildPrompt(
          'CRITICAL: they just said the corrected sentence well enough. ' +
            'Praise in one short new phrase, then ask ONE new lesson question in the SAME reply. ' +
            'The reply MUST end with a question mark. mode must be "chat". Do not ask them to repeat again.',
        ),
        { callType: 'conversation', userText },
      )
      const retried = normalize(extractJson(retryRaw), practiceTarget, userText)
      if (retried.mode === 'chat' && replyHasQuestion(retried.reply)) {
        normalized = retried
      }
    } catch {
      /* use the local question below */
    }
    if (!replyHasQuestion(normalized.reply)) {
      normalized = {
        reply: praiseThenQuestion(normalized.reply, questionAfterPractice(topic, messages)),
        mode: 'chat',
        correctedSentence: null,
        hadCorrection: false,
      }
    }
  }

  // Extremely unclear audio: do not invent a drill from noise
  if (veryLowConfidence && normalized.mode === 'practice') {
    const looksLikeWords = userText.trim().split(/\s+/).filter(Boolean).length >= 2
    if (!looksLikeWords || !isSensibleCorrection(userText, normalized.correctedSentence)) {
      normalized = {
        reply: 'Sorry, I did not catch that. Please say it again in simple words.',
        mode: 'chat',
        correctedSentence: null,
        hadCorrection: false,
      }
    }
  }

  // Hard stop: after 3 practice tries, model the sentence once, then continue the lesson
  if (practiceTarget && practiceAttempts >= 3) {
    return {
      reply: `Good try. Listen once more: ${practiceTarget} Okay — let's continue. Tell me one more simple detail about ${topic.title}.`,
      mode: 'chat',
      correctedSentence: null,
      hadCorrection: false,
    }
  }

  // If an absurd practice target somehow stayed active, force chat next
  if (practiceTarget && ABSURD_CORRECTION.test(practiceTarget) && normalized.mode === 'practice') {
    return {
      reply: 'Okay. Tell me more about your work or studies in simple words.',
      mode: 'chat',
      correctedSentence: null,
      hadCorrection: false,
    }
  }

  return normalized
}

export function friendlyApiError(err: unknown): string {
  const message = errorMessage(err)
  if (/API key|Missing Gemini|503|403|401|PERMISSION|not set/i.test(message)) {
    return 'API key missing or invalid — check your .env file'
  }
  if (/high demand|unavailable/i.test(message)) {
    return 'Gemini is busy — tap to try again'
  }
  if (/429|quota|rate/i.test(message)) {
    return 'Gemini quota hit — wait a moment'
  }
  if (/404|no longer available|not found/i.test(message)) {
    return 'Gemini model unavailable — refresh and try again'
  }
  if (/Failed to fetch|NetworkError|network/i.test(message)) {
    return 'Network error — check your internet'
  }
  return 'Yappy could not reply — try again'
}
