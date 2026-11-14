import { Router } from 'express'
import mongoose from 'mongoose'
import { requireAuth, clientMeta } from '../middleware/auth.mjs'
import { UserProgress } from '../models/UserProgress.mjs'
import { PracticeSession } from '../models/PracticeSession.mjs'
import { UsageEvent } from '../models/UsageEvent.mjs'
import { DailyUserUsage } from '../models/DailyUserUsage.mjs'
import { checkPracticeAllowed } from '../lib/limits.mjs'
import {
  buildLessonAccess,
  checkLessonStartAllowed,
  isLessonCompletedEnough,
} from '../lib/lessonAccess.mjs'
import {
  resolveRequestTimeZone,
  startOfZonedDay,
  zonedDateString,
} from '../lib/timeZones.mjs'
import {
  buildFallbackDetailedReport,
  evaluateLessonWithGemini,
} from '../lib/evaluateSession.mjs'
import { logUsageEvent } from '../lib/logUsageEvent.mjs'
import { isTrialUser } from '../lib/trialUser.mjs'

const TOTAL_LESSONS = 30

const router = Router()

function daysBetween(a, b) {
  const ms = Date.parse(b) - Date.parse(a)
  return Math.round(ms / 86400000)
}

async function getOrCreateProgress(userId) {
  let progress = await UserProgress.findOne({ userId })
  if (!progress) progress = await UserProgress.create({ userId })
  return progress
}

function startOfWeekMonday(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay() // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + diff)
  return date
}

function clampScore(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  return Math.max(1, Math.min(5, Math.round(v)))
}

function mergeBestScores(current, next) {
  if (!next) return current || undefined
  const keys = ['clarity', 'accuracy', 'pronunciation', 'completeness']
  const out = { ...(current || {}) }
  for (const key of keys) {
    const n = clampScore(next[key])
    if (n == null) continue
    const c = clampScore(out[key])
    out[key] = c == null ? n : Math.max(c, n)
  }
  return out
}

function avgScores(rows) {
  const keys = ['clarity', 'accuracy', 'pronunciation', 'completeness']
  const sums = Object.fromEntries(keys.map((k) => [k, 0]))
  const counts = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const row of rows) {
    for (const key of keys) {
      const v = clampScore(row?.[key])
      if (v == null) continue
      sums[key] += v
      counts[key] += 1
    }
  }
  const overall = {}
  for (const key of keys) {
    overall[key] = counts[key] > 0 ? Math.round((sums[key] / counts[key]) * 10) / 10 : null
  }
  return overall
}

router.get('/scores', requireAuth, async (req, res) => {
  try {
    const sessions = await PracticeSession.find({
      userId: req.user._id,
      scores: { $exists: true },
    })
      .select('lessonId lessonNumber lessonTitle scores overall completed createdAt detailedReport')
      .sort({ createdAt: -1 })
      .lean()

    const byLesson = new Map()
    for (const session of sessions) {
      const scores = session.scores
      if (!scores || typeof scores !== 'object') continue
      const sessionId = String(session._id)
      const hasReport = Boolean(session.detailedReport && typeof session.detailedReport === 'object')
      const overallVal = Number.isFinite(session.overall) ? Number(session.overall) : null
      const existing = byLesson.get(session.lessonId)
      if (!existing) {
        byLesson.set(session.lessonId, {
          lessonId: session.lessonId,
          lessonNumber: session.lessonNumber,
          title: session.lessonTitle,
          attempts: 1,
          completed: Boolean(session.completed),
          bestScores: {
            clarity: clampScore(scores.clarity),
            accuracy: clampScore(scores.accuracy),
            pronunciation: clampScore(scores.pronunciation),
            completeness: clampScore(scores.completeness),
          },
          latestScores: {
            clarity: clampScore(scores.clarity),
            accuracy: clampScore(scores.accuracy),
            pronunciation: clampScore(scores.pronunciation),
            completeness: clampScore(scores.completeness),
          },
          bestOverall: overallVal,
          lastPracticedAt: session.createdAt,
          bestSessionId: sessionId,
          reportSessionId: hasReport ? sessionId : sessionId,
          hasDetailedReport: hasReport,
        })
        continue
      }

      existing.attempts += 1
      if (session.completed) existing.completed = true
      existing.bestScores = mergeBestScores(existing.bestScores, scores)
      if (overallVal != null) {
        const better =
          existing.bestOverall == null ||
          overallVal > existing.bestOverall ||
          (overallVal === existing.bestOverall && hasReport && !existing.hasDetailedReport)
        if (better) {
          existing.bestOverall = Math.max(existing.bestOverall ?? overallVal, overallVal)
          existing.bestSessionId = sessionId
          if (hasReport || !existing.hasDetailedReport) {
            existing.reportSessionId = sessionId
            existing.hasDetailedReport = hasReport || existing.hasDetailedReport
          }
        }
      }
      if (hasReport && !existing.hasDetailedReport) {
        existing.reportSessionId = sessionId
        existing.hasDetailedReport = true
      }
    }

    const lessons = Array.from(byLesson.values()).sort(
      (a, b) => a.lessonNumber - b.lessonNumber,
    )
    const overall = avgScores(lessons.map((l) => l.bestScores))

    res.json({
      overall,
      lessons,
      lessonsScored: lessons.length,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load scores' })
  }
})

/** Latest / best detailed speaking report for a lesson (Scores → View report). */
router.get('/lessons/:lessonId/report', requireAuth, async (req, res) => {
  try {
    if (req.user?.role === 'admin') {
      res.status(403).json({ error: 'Admin accounts cannot practice lessons' })
      return
    }

    const lessonId = String(req.params.lessonId || '')
    if (!lessonId) {
      res.status(400).json({ error: 'lessonId is required' })
      return
    }

    const sessions = await PracticeSession.find({
      userId: req.user._id,
      lessonId,
      status: 'completed',
    })
      .sort({ overall: -1, createdAt: -1 })
      .limit(12)

    if (!sessions.length) {
      res.status(404).json({ error: 'No scored session found for this lesson' })
      return
    }

    let session =
      sessions.find((s) => s.detailedReport && typeof s.detailedReport === 'object') || sessions[0]

    if (session.detailedReport && typeof session.detailedReport === 'object') {
      res.json({
        sessionId: session._id.toString(),
        lessonId: session.lessonId,
        lessonNumber: session.lessonNumber,
        lessonTitle: session.lessonTitle,
        durationMs: session.durationMs,
        turns: session.turns,
        corrections: session.corrections,
        maxStreak: session.maxStreak,
        endedReason: session.endedReason || 'hangup',
        scores: session.scores || null,
        overall: session.overall ?? null,
        report: session.detailedReport,
        cached: true,
      })
      return
    }

    const transcript = Array.isArray(session.transcript) ? session.transcript : []
    const learnerSpeech = transcript
      .filter((t) => t?.role === 'user' && String(t.text || '').trim())
      .map((t) => String(t.text).trim())
      .join(' ')
      .slice(0, 4000)
    const transcriptPreview = transcript
      .map((t) => `${t.role === 'user' ? 'Learner' : 'Coach'}: ${String(t.text || '').slice(0, 400)}`)
      .join('\n')
      .slice(0, 3000)

    let report = null
    let cached = false
    const meta = clientMeta(req)
    const started = Date.now()

    if (learnerSpeech) {
      const denied = await checkPracticeAllowed(req.user, {
        sessionId: null,
        userText: '',
        kind: 'generate',
        timeZone: resolveRequestTimeZone(req),
      })
      if (!denied) {
        try {
          const { report: aiReport, model, usage } = await evaluateLessonWithGemini({
            lessonTitle: session.lessonTitle,
            lessonNumber: session.lessonNumber,
            learnerSpeech,
            transcriptPreview,
            mistakes: session.topMistakes || [],
            confidences: [],
            heuristicScores: session.scores || {},
            overall: session.overall,
          })
          report = aiReport
          void logUsageEvent({
            userId: req.user._id,
            sessionId: session._id,
            lessonId: session.lessonId,
            turnIndex: 0,
            callType: 'scoring',
            model,
            usage,
            latencyMs: Date.now() - started,
            status: 'ok',
            userTextChars: learnerSpeech.length,
            ...meta,
          })
        } catch (err) {
          console.warn('scores report evaluate failed', err)
        }
      }
    }

    if (!report) {
      report = buildFallbackDetailedReport({
        lessonTitle: session.lessonTitle,
        learnerSpeech,
        overall: session.overall,
        turns: session.turns,
        corrections: session.corrections,
      })
    }

    session.detailedReport = report
    await session.save()

    res.json({
      sessionId: session._id.toString(),
      lessonId: session.lessonId,
      lessonNumber: session.lessonNumber,
      lessonTitle: session.lessonTitle,
      durationMs: session.durationMs,
      turns: session.turns,
      corrections: session.corrections,
      maxStreak: session.maxStreak,
      endedReason: session.endedReason || 'hangup',
      scores: session.scores || null,
      overall: session.overall ?? null,
      report,
      cached,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load lesson report' })
  }
})

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const timeZone = resolveRequestTimeZone(req, { persist: true })
    const progress = await getOrCreateProgress(req.user._id)
    const recent = await PracticeSession.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean()

    const weekStart = startOfWeekMonday()
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const weekSessions = await PracticeSession.find({
      userId: req.user._id,
      createdAt: { $gte: weekStart, $lt: weekEnd },
    })
      .select('durationMs createdAt')
      .lean()

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const minutesByDay = Array.from({ length: 7 }, () => 0)
    for (const s of weekSessions) {
      const created = new Date(s.createdAt)
      const idx = Math.floor((created.getTime() - weekStart.getTime()) / 86400000)
      if (idx >= 0 && idx < 7) {
        minutesByDay[idx] += Math.max(0, Number(s.durationMs) || 0) / 60000
      }
    }
    const weekActivity = dayLabels.map((label, i) => ({
      label,
      minutes: Math.round(minutesByDay[i] * 10) / 10,
    }))

    // Practice days for streak calendar (local YYYY-MM-DD in learner timezone)
    const calLookback = new Date()
    calLookback.setUTCDate(calLookback.getUTCDate() - 100)
    const lookbackKey = zonedDateString(calLookback, timeZone)
    const practiceDayRows = await DailyUserUsage.find({
      userId: req.user._id,
      date: { $gte: lookbackKey },
      sessions: { $gt: 0 },
    })
      .select('date')
      .lean()
    const practiceDaySet = new Set(practiceDayRows.map((row) => row.date))
    // Also include session dates (covers older data before daily usage rows)
    const sessionDays = await PracticeSession.find({
      userId: req.user._id,
      createdAt: { $gte: calLookback },
    })
      .select('createdAt')
      .lean()
    for (const s of sessionDays) {
      practiceDaySet.add(zonedDateString(new Date(s.createdAt), timeZone))
    }
    const practiceDays = [...practiceDaySet].sort()

    // Live streak: break if last practice was before yesterday (local calendar)
    const todayLocal = zonedDateString(new Date(), timeZone)
    let currentStreak = progress.currentStreak || 0
    if (progress.lastPracticeDate) {
      const gap = daysBetween(progress.lastPracticeDate, todayLocal)
      if (gap > 1 && currentStreak !== 0) {
        currentStreak = 0
        progress.currentStreak = 0
        await progress.save()
      }
    } else {
      currentStreak = 0
    }

    const totalMinutes = Math.round(progress.totalPracticeMs / 60000)
    const accuracyHint =
      progress.totalTurns > 0
        ? Math.max(
            0,
            Math.round(
              (1 - progress.totalCorrections / Math.max(progress.totalTurns, 1)) * 100,
            ),
          )
        : null

    const dayStart = startOfZonedDay(new Date(), timeZone)
    const todaySessionCount = await PracticeSession.countDocuments({
      userId: req.user._id,
      createdAt: { $gte: dayStart },
      isTest: { $ne: true },
    })
    const practicedToday = todaySessionCount > 0 || progress.lastPracticeDate === todayLocal
    const lessonAccess = buildLessonAccess(progress.lessonStats, {
      practicedToday,
      totalLessons: isTrialUser(req.user) ? 1 : TOTAL_LESSONS,
      timeZone,
    })
    const resumableSession = await PracticeSession.findOne(resumableQuery(req.user._id))
      .sort({ updatedAt: -1 })
      .select('lessonId lessonNumber lessonTitle durationMs')
      .lean()

    res.json({
      user: {
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email,
        level: req.user.level,
      },
      stats: {
        totalSessions: progress.totalSessions,
        totalMinutes,
        totalTurns: progress.totalTurns,
        totalCorrections: progress.totalCorrections,
        lessonsCompleted: progress.lessonsCompleted,
        currentStreak,
        longestStreak: progress.longestStreak,
        lastPracticeDate: progress.lastPracticeDate || null,
        speakingScore: accuracyHint,
        practicedToday,
      },
      lessonAccess,
      resumable: resumableSession
        ? {
            lessonId: resumableSession.lessonId,
            lessonNumber: resumableSession.lessonNumber,
            lessonTitle: resumableSession.lessonTitle,
            durationMs: resumableSession.durationMs || 0,
            remainingMs: Math.max(0, LECTURE_MS - (resumableSession.durationMs || 0)),
          }
        : null,
      lessonStats: progress.lessonStats.map((l) => {
        const plain = typeof l.toObject === 'function' ? l.toObject() : { ...l }
        return {
          ...plain,
          unlocked: lessonAccess.unlockedLessonNumbers.includes(Number(plain.lessonNumber)),
          completedAt: plain.completedAt || null,
        }
      }),
      weekActivity,
      practiceDays,
      recentSessions: recent.map((s) => {
        const derivedScore =
          Number.isFinite(s.overall) && s.overall != null
            ? Math.round(s.overall)
            : s.turns > 0
              ? Math.max(0, Math.round((1 - s.corrections / Math.max(s.turns, 1)) * 100))
              : null
        return {
          id: s._id.toString(),
          lessonId: s.lessonId,
          lessonNumber: s.lessonNumber,
          lessonTitle: s.lessonTitle,
          durationMs: s.durationMs,
          turns: s.turns,
          corrections: s.corrections,
          practiceSuccesses: s.practiceSuccesses,
          maxStreak: s.maxStreak,
          completed: s.completed,
          endedReason: s.endedReason,
          overall: derivedScore,
          createdAt: s.createdAt,
        }
      }),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load dashboard' })
  }
})

const LECTURE_MS = 30 * 60 * 1000

function resumePayload(session) {
  return {
    durationMs: session.durationMs || 0,
    turns: session.turns || 0,
    corrections: session.corrections || 0,
    practiceSuccesses: session.practiceSuccesses || 0,
    maxStreak: session.maxStreak || 0,
    transcript: (session.transcript || []).map((t) => ({
      role: t.role === 'user' ? 'user' : 'coach',
      text: t.text || '',
    })),
  }
}

function resumableQuery(userId, lessonId) {
  const filter = {
    userId,
    isTest: { $ne: true },
    durationMs: { $lt: LECTURE_MS },
    endedReason: { $nin: ['timeup', 'time_limit'] },
  }
  if (lessonId) filter.lessonId = lessonId
  return filter
}

async function findResumableSession(userId, lessonId) {
  return PracticeSession.findOne(resumableQuery(userId, lessonId)).sort({ updatedAt: -1 })
}

function mapEndReason(endedReason) {
  if (endedReason === 'timeup' || endedReason === 'time_limit') return 'time_limit'
  if (endedReason === 'error') return 'error'
  if (endedReason === 'blocked') return 'blocked'
  return 'hung_up'
}

router.post('/sessions/start', requireAuth, async (req, res) => {
  try {
    const lessonId = String(req.body?.lessonId || '')
    const lessonNumber = Number(req.body?.lessonNumber)
    const lessonTitle = String(req.body?.lessonTitle || 'Lesson')
    if (!lessonId || !Number.isFinite(lessonNumber)) {
      res.status(400).json({ error: 'lessonId and lessonNumber are required' })
      return
    }

    const timeZone = resolveRequestTimeZone(req, { persist: true })
    const open = await findResumableSession(req.user._id, lessonId)
    if (open) {
      if (open.status === 'completed' || open.endedAt) open.progressCounted = true
      open.status = 'active'
      open.completed = false
      await open.save()
      res.json({
        sessionId: open._id.toString(),
        resume: resumePayload(open),
      })
      return
    }

    const denied = await checkPracticeAllowed(req.user, { kind: 'start', timeZone })
    if (denied) {
      res.status(denied.statusCode).json({
        error: denied.error,
        code: denied.code,
        unlocksAt: denied.unlocksAt || null,
      })
      return
    }

    const progress = await getOrCreateProgress(req.user._id)
    const dayStart = startOfZonedDay(new Date(), timeZone)
    const todayLocal = zonedDateString(new Date(), timeZone)
    const todaySessions = await PracticeSession.countDocuments({
      userId: req.user._id,
      createdAt: { $gte: dayStart },
      isTest: { $ne: true },
    })
    const lessonDenied = checkLessonStartAllowed(req.user, {
      lessonNumber,
      lessonStats: progress.lessonStats,
      practicedToday: todaySessions > 0 || progress.lastPracticeDate === todayLocal,
      timeZone,
    })
    if (lessonDenied) {
      res.status(lessonDenied.statusCode).json({
        error: lessonDenied.error,
        code: lessonDenied.code,
        unlocksAt: lessonDenied.unlocksAt || null,
      })
      return
    }

    const session = await PracticeSession.create({
      userId: req.user._id,
      lessonId,
      lessonNumber,
      lessonTitle,
      status: 'active',
      startedAt: new Date(),
    })
    res.status(201).json({ sessionId: session._id.toString() })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not start practice session' })
  }
})

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    if (req.user?.role === 'admin') {
      res.status(403).json({ error: 'Admin accounts cannot practice lessons' })
      return
    }
    const lessonId = String(req.body?.lessonId || '')
    const lessonNumber = Number(req.body?.lessonNumber)
    const lessonTitle = String(req.body?.lessonTitle || 'Lesson')
    const durationMs = Math.max(0, Number(req.body?.durationMs) || 0)
    const turns = Math.max(0, Number(req.body?.turns) || 0)
    const corrections = Math.max(0, Number(req.body?.corrections) || 0)
    const practiceSuccesses = Math.max(0, Number(req.body?.practiceSuccesses) || 0)
    const maxStreak = Math.max(0, Number(req.body?.maxStreak) || 0)
    const rawEnded = String(req.body?.endedReason || 'hangup')
    const endedReason = ['hangup', 'timeup', 'error', 'hung_up', 'time_limit', 'blocked'].includes(
      rawEnded,
    )
      ? rawEnded
      : 'hangup'
    const endReason = mapEndReason(endedReason)
    const existingId = req.body?.sessionId ? String(req.body.sessionId) : ''
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript.slice(0, 400) : []

    if (!lessonId || !Number.isFinite(lessonNumber)) {
      res.status(400).json({ error: 'lessonId and lessonNumber are required' })
      return
    }

    const pausing =
      endedReason !== 'timeup' && endedReason !== 'time_limit' && durationMs < LECTURE_MS

    if (pausing && existingId && mongoose.isValidObjectId(existingId)) {
      const paused = await PracticeSession.findOne({ _id: existingId, userId: req.user._id })
      if (paused && paused.status !== 'completed') {
        paused.status = 'paused'
        paused.durationMs = durationMs
        paused.durationSec = Math.round(durationMs / 1000)
        paused.turns = turns
        paused.turnCount = turns
        paused.corrections = corrections
        paused.practiceSuccesses = practiceSuccesses
        paused.maxStreak = maxStreak
        paused.completed = false
        paused.endedReason = 'hangup'
        paused.endReason = 'hung_up'
        paused.transcript = transcript.map((t, i) => ({
          role: t.role === 'user' ? 'user' : 'coach',
          text: String(t.text || '').slice(0, 4000),
          turnIndex: Number(t.turnIndex) || i,
          at: t.at ? new Date(t.at) : new Date(),
          correction: Boolean(t.correction),
          practiceAttempts: Number(t.practiceAttempts) || 0,
        }))
        await paused.save()
        res.json({ sessionId: paused._id.toString(), paused: true })
        return
      }
    }

    // Ignore tiny accidental opens with no practice
    if (durationMs < 5000 && turns < 1) {
      if (existingId && mongoose.isValidObjectId(existingId)) {
        await PracticeSession.deleteOne({ _id: existingId, userId: req.user._id, status: 'active' })
      }
      res.status(200).json({ skipped: true })
      return
    }

    const scores = req.body?.scores
    const overall = Number(req.body?.overall)
    const topMistakes = Array.isArray(req.body?.topMistakes) ? req.body.topMistakes.slice(0, 5) : []

    let session = null
    if (existingId && mongoose.isValidObjectId(existingId)) {
      session = await PracticeSession.findOne({ _id: existingId, userId: req.user._id })
    }

    const usageMatch = session
      ? { sessionId: session._id }
      : { userId: req.user._id, lessonId, createdAt: { $gte: new Date(Date.now() - durationMs - 120_000) } }
    const usageAgg = await UsageEvent.aggregate([
      { $match: usageMatch },
      {
        $group: {
          _id: null,
          input: { $sum: '$inputTokens' },
          output: { $sum: '$outputTokens' },
          cost: { $sum: '$costUsd' },
        },
      },
    ])
    const totalInputTokens = usageAgg[0]?.input || 0
    const totalOutputTokens = usageAgg[0]?.output || 0
    const totalCostUsd = usageAgg[0]?.cost || 0

    const payload = {
      lessonId,
      lessonNumber,
      lessonTitle,
      status: 'completed',
      durationMs,
      durationSec: Math.round(durationMs / 1000),
      turns,
      turnCount: turns,
      corrections,
      practiceSuccesses,
      maxStreak,
      completed: isLessonCompletedEnough(durationMs, endedReason),
      endedReason,
      endReason,
      endedAt: new Date(),
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      transcript: transcript.map((t, i) => ({
        role: t.role === 'user' ? 'user' : 'coach',
        text: String(t.text || '').slice(0, 4000),
        turnIndex: Number(t.turnIndex) || i,
        at: t.at ? new Date(t.at) : new Date(),
        correction: Boolean(t.correction),
        practiceAttempts: Number(t.practiceAttempts) || 0,
      })),
      scores:
        scores && typeof scores === 'object'
          ? {
              clarity: Number(scores.clarity) || undefined,
              accuracy: Number(scores.accuracy) || undefined,
              pronunciation: Number(scores.pronunciation) || undefined,
              completeness: Number(scores.completeness) || undefined,
            }
          : undefined,
      overall: Number.isFinite(overall) ? overall : undefined,
      topMistakes,
    }

    const alreadyCounted = Boolean(session?.progressCounted)
    const previousDuration = session?.durationMs || 0
    payload.progressCounted = true

    if (session) {
      Object.assign(session, payload)
      await session.save()
    } else {
      session = await PracticeSession.create({
        userId: req.user._id,
        startedAt: new Date(Date.now() - durationMs),
        ...payload,
      })
    }

    const progress = await getOrCreateProgress(req.user._id)
    if (!alreadyCounted) {
      progress.totalSessions += 1
      progress.totalPracticeMs += durationMs
      progress.totalTurns += turns
      progress.totalCorrections += corrections
    }

    const timeZone = resolveRequestTimeZone(req, { persist: true })
    const today = zonedDateString(new Date(), timeZone)
    if (!progress.lastPracticeDate) {
      progress.currentStreak = 1
    } else {
      const gap = daysBetween(progress.lastPracticeDate, today)
      if (gap === 0) {
        /* same local day — keep streak */
      } else if (gap === 1) {
        progress.currentStreak += 1
      } else {
        progress.currentStreak = 1
      }
    }
    progress.lastPracticeDate = today
    progress.longestStreak = Math.max(progress.longestStreak, progress.currentStreak)

    let lesson = progress.lessonStats.find((l) => l.lessonId === lessonId)
    if (!lesson) {
      lesson = {
        lessonId,
        lessonNumber,
        title: lessonTitle,
        attempts: 0,
        totalDurationMs: 0,
        totalTurns: 0,
        totalCorrections: 0,
        bestStreak: 0,
        completed: false,
        lastPracticedAt: new Date(),
      }
      progress.lessonStats.push(lesson)
    }
    if (!alreadyCounted) {
      lesson.attempts += 1
      lesson.totalDurationMs += durationMs
      lesson.totalTurns += turns
      lesson.totalCorrections += corrections
    } else {
      lesson.totalDurationMs += Math.max(0, durationMs - previousDuration)
    }
    lesson.bestStreak = Math.max(lesson.bestStreak, maxStreak)
    lesson.lastPracticedAt = new Date()
    if (session.completed) {
      if (!lesson.completed) {
        lesson.completed = true
        lesson.completedAt = new Date()
      } else {
        lesson.completed = true
        if (!lesson.completedAt) lesson.completedAt = new Date()
      }
    }

    if (scores && typeof scores === 'object') {
      const normalized = {}
      for (const key of ['clarity', 'accuracy', 'pronunciation', 'completeness']) {
        const value = clampScore(scores[key])
        if (value != null) normalized[key] = value
      }
      if (Object.keys(normalized).length) {
        lesson.latestScores = normalized
        lesson.bestScores = mergeBestScores(lesson.bestScores, normalized)
      }
      if (Number.isFinite(overall)) {
        lesson.bestOverall =
          lesson.bestOverall == null ? overall : Math.max(Number(lesson.bestOverall), overall)
      }
    }

    progress.lessonsCompleted = progress.lessonStats.filter((l) => l.completed).length
    progress.markModified('lessonStats')
    await progress.save()

    await DailyUserUsage.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $inc: {
          sessions: 1,
          minutes: durationMs / 60_000,
        },
      },
      { upsert: true },
    )

    res.status(201).json({
      sessionId: session._id.toString(),
      stats: {
        totalSessions: progress.totalSessions,
        lessonsCompleted: progress.lessonsCompleted,
        currentStreak: progress.currentStreak,
        totalCostUsd,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not save practice session' })
  }
})

/** Post-lesson AI evaluation → detailed IELTS-style report. */
router.post('/evaluate', requireAuth, async (req, res) => {
  try {
    if (req.user?.role === 'admin') {
      res.status(403).json({ error: 'Admin accounts cannot practice lessons' })
      return
    }

    const sessionId = req.body?.sessionId ? String(req.body.sessionId) : ''
    const lessonId = String(req.body?.lessonId || '')
    const lessonNumber = Number(req.body?.lessonNumber) || 0
    const lessonTitle = String(req.body?.lessonTitle || 'Lesson')
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript.slice(0, 400) : []
    const confidences = Array.isArray(req.body?.confidences)
      ? req.body.confidences.map(Number).filter((n) => Number.isFinite(n)).slice(0, 80)
      : []
    const mistakes = Array.isArray(req.body?.topMistakes) ? req.body.topMistakes.slice(0, 8) : []
    const scores = req.body?.scores && typeof req.body.scores === 'object' ? req.body.scores : {}
    const overall = Number(req.body?.overall)

    const learnerSpeech = transcript
      .filter((t) => t?.role === 'user' && String(t.text || '').trim())
      .map((t) => String(t.text).trim())
      .join(' ')
      .slice(0, 4000)

    const transcriptPreview = transcript
      .map((t) => `${t.role === 'user' ? 'Learner' : 'Coach'}: ${String(t.text || '').slice(0, 400)}`)
      .join('\n')
      .slice(0, 3000)

    if (!learnerSpeech && transcript.length === 0) {
      res.status(400).json({ error: 'No transcript to evaluate' })
      return
    }

    let session = null
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      session = await PracticeSession.findOne({ _id: sessionId, userId: req.user._id })
      if (session?.detailedReport && typeof session.detailedReport === 'object') {
        res.json({ report: session.detailedReport, cached: true })
        return
      }
    }

    // Post-session scoring: enforce auth/rate limits only (not turn length / session call caps).
    const denied = await checkPracticeAllowed(req.user, {
      sessionId: null,
      userText: '',
      kind: 'generate',
      timeZone: resolveRequestTimeZone(req),
    })
    if (denied) {
      res.status(denied.statusCode).json({ error: denied.error, code: denied.code })
      return
    }

    const meta = clientMeta(req)
    const started = Date.now()
    try {
      const { report, model, usage } = await evaluateLessonWithGemini({
        lessonTitle,
        lessonNumber,
        learnerSpeech,
        transcriptPreview,
        mistakes,
        confidences,
        heuristicScores: scores,
        overall: Number.isFinite(overall) ? overall : undefined,
      })

      void logUsageEvent({
        userId: req.user._id,
        sessionId: session?._id || null,
        lessonId,
        turnIndex: 0,
        callType: 'scoring',
        model,
        usage,
        latencyMs: Date.now() - started,
        status: 'ok',
        userTextChars: learnerSpeech.length,
        ...meta,
      })

      if (session) {
        session.detailedReport = report
        await session.save()
      }

      res.json({ report, cached: false })
    } catch (err) {
      console.error('evaluate failed', err)
      void logUsageEvent({
        userId: req.user._id,
        sessionId: session?._id || null,
        lessonId,
        turnIndex: 0,
        callType: 'scoring',
        model: 'gemini-3.5-flash-lite',
        usage: {},
        latencyMs: Date.now() - started,
        status: 'error',
        errorCode: 'evaluate_failed',
        userTextChars: learnerSpeech.length,
        ...meta,
      })
      res.status(502).json({ error: 'Could not generate detailed evaluation' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Evaluation failed' })
  }
})

export default router
