import mongoose from 'mongoose'
import { LimitsConfig } from '../models/LimitsConfig.mjs'
import { PracticeSession } from '../models/PracticeSession.mjs'
import { UsageEvent } from '../models/UsageEvent.mjs'
import { User } from '../models/User.mjs'
import { nextZonedMidnight, normalizeTimeZone, startOfZonedDay } from './timeZones.mjs'

function asObjectId(id) {
  if (!id) return null
  if (id instanceof mongoose.Types.ObjectId) return id
  try {
    return new mongoose.Types.ObjectId(String(id))
  } catch {
    return null
  }
}

let cache = { at: 0, doc: null }

export async function getLimitsConfig() {
  if (Date.now() - cache.at < 30_000 && cache.doc) return cache.doc
  let doc = await LimitsConfig.findOne({ key: 'default' })
  if (!doc) {
    doc = await LimitsConfig.create({ key: 'default' })
  }
  cache = { at: Date.now(), doc }
  return doc
}

export function invalidateLimitsCache() {
  cache = { at: 0, doc: null }
}

function effectiveLimit(user, key, defaults) {
  const override = user?.limitsOverride?.[key]
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) return override
  return defaults[key]
}

/**
 * Enforce user status + practice hard limits before Gemini / session start.
 * Returns null if OK, or { statusCode, error, code }.
 */
export async function checkPracticeAllowed(
  user,
  { sessionId, userText = '', kind = 'generate', timeZone } = {},
) {
  if (!user) return { statusCode: 401, error: 'Please log in', code: 'auth' }
  if (user.role === 'admin') {
    return { statusCode: 403, error: 'Admin accounts cannot practice lessons', code: 'admin' }
  }

  const now = new Date()
  const tz = normalizeTimeZone(timeZone || user.timezone || 'UTC')
  if (user.status === 'banned') {
    return { statusCode: 403, error: 'This account has been banned', code: 'banned' }
  }
  if (user.status === 'suspended') {
    if (user.statusUntil && user.statusUntil > now) {
      return {
        statusCode: 403,
        error: `Practice suspended until ${user.statusUntil.toISOString().slice(0, 10)}`,
        code: 'suspended',
      }
    }
    // Auto-clear expired suspend
    user.status = 'active'
    user.statusUntil = undefined
    await user.save()
  }

  const limits = await getLimitsConfig()
  const defaults = {
    sessionsPerDay: limits.sessionsPerDay,
    speakingMinutesPerDay: limits.speakingMinutesPerDay,
    geminiCallsPerSession: limits.geminiCallsPerSession,
    inputTokensPerSession: limits.inputTokensPerSession,
    charsPerUserTurn: limits.charsPerUserTurn,
    apiRequestsPerUserPerMinute: limits.apiRequestsPerUserPerMinute,
  }

  const sessionsPerDay = effectiveLimit(user, 'sessionsPerDay', defaults)
  const speakingMinutesPerDay = effectiveLimit(user, 'speakingMinutesPerDay', defaults)
  const geminiCallsPerSession = effectiveLimit(user, 'geminiCallsPerSession', defaults)
  const inputTokensPerSession = effectiveLimit(user, 'inputTokensPerSession', defaults)
  const charsPerUserTurn = effectiveLimit(user, 'charsPerUserTurn', defaults)
  const rpm = defaults.apiRequestsPerUserPerMinute

  if (user.status === 'limited') {
    // Stricter: 1 session / local calendar day
    const dayStart = startOfZonedDay(now, tz)
    const todaySessions = await PracticeSession.countDocuments({
      userId: user._id,
      createdAt: { $gte: dayStart },
      isTest: { $ne: true },
    })
    if (kind === 'start' && todaySessions >= 1) {
      return {
        statusCode: 429,
        error:
          "You've already practiced today. Come back when the day changes to practice again.",
        code: 'limited_sessions',
        unlocksAt: nextZonedMidnight(now, tz).toISOString(),
      }
    }
  }

  const text = String(userText || '')
  if (text.length > charsPerUserTurn) {
    return {
      statusCode: 400,
      error: 'That turn is too long. Please speak shorter sentences.',
      code: 'chars_limit',
    }
  }

  const minuteAgo = new Date(Date.now() - 60_000)
  const recentCalls = await UsageEvent.countDocuments({
    userId: user._id,
    createdAt: { $gte: minuteAgo },
  })
  if (recentCalls >= rpm) {
    return { statusCode: 429, error: 'Too many requests. Please wait a moment.', code: 'rate_limited' }
  }

  if (kind === 'start') {
    const dayStart = startOfZonedDay(now, tz)
    const todaySessions = await PracticeSession.countDocuments({
      userId: user._id,
      createdAt: { $gte: dayStart },
      isTest: { $ne: true },
    })
    const maxSessions = user.status === 'limited' ? 1 : sessionsPerDay
    if (todaySessions >= maxSessions) {
      return {
        statusCode: 429,
        error:
          "You've already practiced today. Come back when the day changes to practice again.",
        code: 'sessions_day',
        unlocksAt: nextZonedMidnight(now, tz).toISOString(),
      }
    }

    const todayAgg = await PracticeSession.aggregate([
      {
        $match: {
          userId: user._id,
          createdAt: { $gte: dayStart },
          isTest: { $ne: true },
        },
      },
      { $group: { _id: null, ms: { $sum: '$durationMs' } } },
    ])
    const minutes = (todayAgg[0]?.ms || 0) / 60_000
    if (minutes >= speakingMinutesPerDay) {
      return {
        statusCode: 429,
        error:
          "You've already practiced today. Come back when the day changes to practice again.",
        code: 'minutes_day',
        unlocksAt: nextZonedMidnight(now, tz).toISOString(),
      }
    }
  }

  if (sessionId) {
    const calls = await UsageEvent.countDocuments({ sessionId })
    if (calls >= geminiCallsPerSession) {
      return {
        statusCode: 429,
        error: 'This practice call has reached its turn limit',
        code: 'calls_session',
      }
    }
    const sid = asObjectId(sessionId)
    const tokenAgg = await UsageEvent.aggregate([
      { $match: { sessionId: sid } },
      { $group: { _id: null, input: { $sum: '$inputTokens' } } },
    ])
    if ((tokenAgg[0]?.input || 0) >= inputTokensPerSession) {
      return {
        statusCode: 429,
        error: 'This practice call has reached its token limit',
        code: 'tokens_session',
      }
    }
  }

  await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } })
  return null
}

export async function checkSignupIpLimit(ip) {
  if (!ip) return null
  const limits = await getLimitsConfig()
  // Approximate via users created today — IP not stored on user yet; skip strict if no tracking
  void limits
  return null
}
