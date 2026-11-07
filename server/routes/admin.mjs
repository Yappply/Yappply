import crypto from 'node:crypto'
import { Router } from 'express'
import mongoose from 'mongoose'
import { User } from '../models/User.mjs'
import { UserProgress } from '../models/UserProgress.mjs'
import { PracticeSession } from '../models/PracticeSession.mjs'
import { UsageEvent } from '../models/UsageEvent.mjs'
import { LimitsConfig } from '../models/LimitsConfig.mjs'
import { DailyUserUsage } from '../models/DailyUserUsage.mjs'
import { UserFlag } from '../models/UserFlag.mjs'
import { AdminAuditLog } from '../models/AdminAuditLog.mjs'
import { FreeTestLead } from '../models/FreeTestLead.mjs'
import { requireAuth, requireAdmin, clientMeta } from '../middleware/auth.mjs'
import { writeAudit } from '../lib/audit.mjs'
import { pricingCatalog } from '../lib/pricing.mjs'
import { getLimitsConfig, invalidateLimitsCache } from '../lib/limits.mjs'
import { scanAbuseFlags } from '../lib/flagScanner.mjs'
import {
  dismissPlanExpiredFlags,
  isPlanExpired,
  renewPlanFrom,
} from '../lib/planAccess.mjs'
import { resolveApiKey } from '../geminiApi.mjs'

const router = Router()
router.use(requireAuth, requireAdmin)

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const TOTAL_LESSONS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const PLAN_DAYS = 30
const MAX_RANGE_DAYS = 366
const LEVELS = ['beginner', 'intermediate', 'advanced']
const USER_STATUSES = ['active', 'limited', 'suspended', 'banned']
const OVERRIDE_KEYS = [
  'sessionsPerDay',
  'speakingMinutesPerDay',
  'geminiCallsPerSession',
  'inputTokensPerSession',
  'charsPerUserTurn',
]
const USER_SORT_FIELDS = ['createdAt', 'lastActiveAt', 'lifetimeCostUsd', 'name']
const SESSION_BUCKET_LABELS = ['0-5', '5-10', '10-15', '15-20', '20-25', '25-30']
const STREAK_THRESHOLDS = [1, 3, 7, 14]

/** Allowed fields for PUT /limits, with validation bounds. */
const LIMIT_FIELDS = {
  sessionLengthMin: { min: 1, max: 180, int: true },
  sessionsPerDay: { min: 1, max: 100, int: true },
  speakingMinutesPerDay: { min: 1, max: 1440, int: true },
  geminiCallsPerSession: { min: 1, max: 5000, int: true },
  inputTokensPerSession: { min: 1000, max: 50_000_000, int: true },
  charsPerUserTurn: { min: 10, max: 10_000, int: true },
  apiRequestsPerUserPerMinute: { min: 1, max: 1000, int: true },
  signupsPerIpPerDay: { min: 1, max: 1000, int: true },
  dailyCostFlagMultiplier: { min: 1, max: 1000 },
  autoLimitCostMultiplier: { min: 1, max: 1000 },
  dailyBudgetUsd: { min: 0, max: 1_000_000 },
  monthlyBudgetUsd: { min: 0, max: 10_000_000 },
  userDailyCostAlertUsd: { min: 0, max: 100_000 },
}

/** Mongo expression: session duration in ms (falls back to durationSec). */
const SESSION_MS_EXPR = {
  $cond: [
    { $gt: [{ $ifNull: ['$durationMs', 0] }, 0] },
    '$durationMs',
    { $multiply: [{ $ifNull: ['$durationSec', 0] }, 1000] },
  ],
}

/** Mongo expression: session counts as a completed lesson. */
const SESSION_COMPLETED_EXPR = {
  $or: [{ $eq: ['$completed', true] }, { $eq: ['$status', 'completed'] }],
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function roundUsd(n) {
  return Math.round((Number(n) || 0) * 1_000_000) / 1_000_000
}

export function formatUsd(n) {
  const v = Number(n) || 0
  if (v === 0) return '$0.00'
  if (v < 0.01) return `$${v.toFixed(6)}`
  return `$${v.toFixed(4)}`
}

function round(n, digits = 2) {
  const f = 10 ** digits
  return Math.round((Number(n) || 0) * f) / f
}

function safeDiv(a, b) {
  return b > 0 ? a / b : 0
}

function maskApiKey(key) {
  if (!key) return null
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Resolve ?range=today|7d|30d|custom&from=&to= into a half-open window
 * [from, to) aligned to UTC days, plus the previous window of equal length.
 */
export function parseRange(query = {}) {
  const now = new Date()
  const todayEnd = new Date(startOfUtcDay(now).getTime() + DAY_MS)
  let key = ['today', '7d', '30d', 'custom'].includes(query.range) ? query.range : '7d'
  let from
  let to = todayEnd

  if (key === 'custom') {
    const f = parseDate(query.from)
    const t = parseDate(query.to)
    if (f && t) {
      const a = startOfUtcDay(f)
      const b = startOfUtcDay(t)
      from = a <= b ? a : b
      to = new Date((a <= b ? b : a).getTime() + DAY_MS)
    } else {
      key = '7d'
    }
  }

  if (!from) {
    const days = key === 'today' ? 1 : key === '30d' ? 30 : 7
    from = new Date(todayEnd.getTime() - days * DAY_MS)
  }

  if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
    from = new Date(to.getTime() - MAX_RANGE_DAYS * DAY_MS)
  }

  const spanMs = to.getTime() - from.getTime()
  return {
    key,
    from,
    to,
    days: Math.round(spanMs / DAY_MS),
    prevFrom: new Date(from.getTime() - spanMs),
    prevTo: from,
  }
}

function rangeInfo(r) {
  return {
    range: r.key,
    from: r.from.toISOString(),
    to: new Date(r.to.getTime() - 1).toISOString(),
    days: r.days,
    prevFrom: r.prevFrom.toISOString(),
    prevTo: new Date(r.prevTo.getTime() - 1).toISOString(),
  }
}

/** List of YYYY-MM-DD keys covering [from, to). */
function dayKeys(from, to) {
  const out = []
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) out.push(dayKey(t))
  return out
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function kpi(value, prev = null) {
  const v = Number.isFinite(value) ? value : 0
  const p = prev === null || prev === undefined ? null : Number(prev) || 0
  return {
    value: v,
    prev: p,
    deltaPct: p !== null && p > 0 ? round(((v - p) / p) * 100, 1) : null,
  }
}

function isValidId(id) {
  return mongoose.isValidObjectId(id) && String(id).length === 24
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id))
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clampInt(value, fallback, min, max) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function dayStringMinusDays(days) {
  return dayKey(Date.now() - days * DAY_MS)
}

function route(label, handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      console.error(`[admin] ${label}:`, err)
      if (!res.headersSent) res.status(500).json({ error: `Could not ${label}` })
    }
  }
}

function effectiveStatus(user) {
  if (user.status === 'banned') return 'banned'
  if (user.role !== 'admin') {
    const ends = user.subscriptionEndsAt
      ? new Date(user.subscriptionEndsAt)
      : user.createdAt
        ? new Date(new Date(user.createdAt).getTime() + PLAN_DAYS * DAY_MS)
        : null
    if (ends && ends.getTime() <= Date.now()) return 'suspended'
  }
  if (user.status === 'suspended' && user.statusUntil && new Date(user.statusUntil) <= new Date()) {
    return 'active'
  }
  return user.status || 'active'
}

function statusBadge(user) {
  const status = effectiveStatus(user)
  const tones = { active: 'success', limited: 'warning', suspended: 'warning', banned: 'danger' }
  const planEnded =
    user.role !== 'admin' &&
    (() => {
      const ends = user.subscriptionEndsAt
        ? new Date(user.subscriptionEndsAt)
        : user.createdAt
          ? new Date(new Date(user.createdAt).getTime() + PLAN_DAYS * DAY_MS)
          : null
      return Boolean(ends && ends.getTime() <= Date.now())
    })()
  return {
    status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    tone: tones[status] || 'neutral',
    reason: user.statusReason || (planEnded ? '30-day plan ended' : ''),
    until: user.statusUntil || null,
  }
}

function baseUserFields(user) {
  const badge = statusBadge(user)
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    level: user.level,
    role: user.role || 'user',
    status: user.status || 'active',
    effectiveStatus: badge.status,
    statusReason: user.statusReason || '',
    statusUntil: user.statusUntil || null,
    badge,
    limitsOverride: user.limitsOverride || {},
    hasLimitsOverride: OVERRIDE_KEYS.some((k) => typeof user.limitsOverride?.[k] === 'number'),
    lifetimeCostUsd: roundUsd(user.lifetimeCostUsd),
    lifetimeCostLabel: formatUsd(user.lifetimeCostUsd),
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt || null,
    lastLoginAt: user.lastLoginAt || null,
    subscriptionEndsAt: user.subscriptionEndsAt || null,
    signupSource: user.signupSource || 'direct',
  }
}

function userBrief(user) {
  return user
    ? { id: String(user._id), name: user.name, email: user.email, status: effectiveStatus(user) }
    : null
}

async function loadUserBriefs(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))]
  if (!unique.length) return new Map()
  const users = await User.find({ _id: { $in: unique } })
    .select('name email status statusUntil')
    .lean()
  return new Map(users.map((u) => [String(u._id), userBrief(u)]))
}

function safeReason(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function serializeLessonStats(progress) {
  return [...(progress?.lessonStats || [])]
    .sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0))
    .map((s) => ({
      lessonId: s.lessonId,
      lessonNumber: s.lessonNumber,
      title: s.title,
      attempts: s.attempts || 0,
      completed: Boolean(s.completed),
      totalDurationMs: s.totalDurationMs || 0,
      totalTurns: s.totalTurns || 0,
      totalCorrections: s.totalCorrections || 0,
      bestStreak: s.bestStreak || 0,
      lastPracticedAt: s.lastPracticedAt || null,
      bestOverall: s.bestOverall ?? null,
      bestScores: s.bestScores || null,
      latestScores: s.latestScores || null,
    }))
}

function serializeProgress(progress) {
  const lessonsCompleted = Math.min(TOTAL_LESSONS, Number(progress?.lessonsCompleted) || 0)
  return {
    totalSessions: progress?.totalSessions || 0,
    totalPracticeMs: progress?.totalPracticeMs || 0,
    totalMinutes: round((progress?.totalPracticeMs || 0) / 60_000, 1),
    totalTurns: progress?.totalTurns || 0,
    totalCorrections: progress?.totalCorrections || 0,
    lessonsCompleted,
    lessonsTotal: TOTAL_LESSONS,
    progressPct: Math.round((lessonsCompleted / TOTAL_LESSONS) * 100),
    currentStreak: progress?.currentStreak || 0,
    longestStreak: progress?.longestStreak || 0,
    lastPracticeDate: progress?.lastPracticeDate || '',
  }
}

function serializeFlag(flag, userMap) {
  return {
    id: String(flag._id),
    userId: String(flag.userId),
    user: userMap?.get(String(flag.userId)) || null,
    rule: flag.rule,
    evidence: flag.evidence || {},
    sessionIds: (flag.sessionIds || []).map(String),
    status: flag.status,
    note: flag.note || '',
    reviewedBy: flag.reviewedBy ? String(flag.reviewedBy) : null,
    reviewedAt: flag.reviewedAt || null,
    createdAt: flag.createdAt,
    updatedAt: flag.updatedAt,
  }
}

function serializeAudit(row) {
  const admin = row.adminId && typeof row.adminId === 'object' && row.adminId.name ? row.adminId : null
  return {
    id: String(row._id),
    adminId: String(admin?._id || row.adminId),
    admin: admin ? { id: String(admin._id), name: admin.name, email: admin.email } : null,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId || '',
    before: row.before ?? null,
    after: row.after ?? null,
    reason: row.reason || '',
    ip: row.ip || '',
    createdAt: row.createdAt,
  }
}

function pickLimits(doc) {
  const o = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc }
  const out = {}
  for (const key of Object.keys(LIMIT_FIELDS)) out[key] = o[key]
  out.updatedAt = o.updatedAt || null
  return out
}

/** Group UsageEvent rows by a field, filling cost/tokens/calls/errors. */
const usageGroupStage = (idExpr) => ({
  $group: {
    _id: idExpr,
    costUsd: { $sum: '$costUsd' },
    calls: { $sum: 1 },
    inputTokens: { $sum: '$inputTokens' },
    outputTokens: { $sum: { $add: ['$outputTokens', { $ifNull: ['$thinkingTokens', 0] }] } },
    totalTokens: { $sum: '$totalTokens' },
    errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
  },
})

function shapeUsageRow(row, totalCost = 0) {
  return {
    costUsd: roundUsd(row.costUsd),
    costLabel: formatUsd(row.costUsd),
    sharePct: totalCost > 0 ? round((row.costUsd / totalCost) * 100, 1) : 0,
    calls: row.calls || 0,
    inputTokens: row.inputTokens || 0,
    outputTokens: row.outputTokens || 0,
    totalTokens: row.totalTokens || 0,
    errors: row.errors || 0,
  }
}

/* -------------------------------------------------------------------------- */
/* GET /overview                                                               */
/* -------------------------------------------------------------------------- */

async function periodStats(from, to) {
  const window = { $gte: from, $lt: to }
  const [sessionAgg, usageAgg, newSignups] = await Promise.all([
    PracticeSession.aggregate([
      { $match: { createdAt: window, isTest: { $ne: true } } },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          ms: { $sum: SESSION_MS_EXPR },
          completed: { $sum: { $cond: [SESSION_COMPLETED_EXPR, 1, 0] } },
          users: { $addToSet: '$userId' },
        },
      },
      { $project: { sessions: 1, ms: 1, completed: 1, activeUsers: { $size: '$users' } } },
    ]),
    UsageEvent.aggregate([
      { $match: { createdAt: window } },
      {
        $group: {
          _id: null,
          costUsd: { $sum: '$costUsd' },
          events: { $sum: 1 },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
        },
      },
    ]),
    User.countDocuments({ role: { $ne: 'admin' }, createdAt: window }),
  ])

  const s = sessionAgg[0] || {}
  const u = usageAgg[0] || {}
  const dau = s.activeUsers || 0
  const lessonsCompleted = s.completed || 0
  const geminiCost = u.costUsd || 0
  return {
    newSignups,
    dau,
    sessions: s.sessions || 0,
    minutesSpoken: round((s.ms || 0) / 60_000, 1),
    lessonsCompleted,
    geminiCost: roundUsd(geminiCost),
    costPerActiveUser: roundUsd(safeDiv(geminiCost, dau)),
    costPerCompletedLesson: roundUsd(safeDiv(geminiCost, lessonsCompleted)),
    errorRate: round(safeDiv(u.errors || 0, u.events || 0), 4),
  }
}

router.get(
  '/overview',
  route('load admin overview', async (req, res) => {
    const r = parseRange(req.query)
    const window = { $gte: r.from, $lt: r.to }
    const days = dayKeys(r.from, r.to)
    const apiKey = resolveApiKey(process.env)

    const [
      totalUsers,
      current,
      previous,
      openFlags,
      flaggedUserIds,
      activeByDay,
      signupsByDay,
      costByDayType,
      tokensByDay,
      topUsers,
      bucketAgg,
      streakCounts,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      periodStats(r.from, r.to),
      periodStats(r.prevFrom, r.prevTo),
      UserFlag.countDocuments({ status: 'open' }),
      UserFlag.distinct('userId', { status: 'open' }),
      PracticeSession.aggregate([
        { $match: { createdAt: window, isTest: { $ne: true } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              userId: '$userId',
            },
          },
        },
        { $group: { _id: '$_id.day', users: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: { $ne: 'admin' }, createdAt: window } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            signups: { $sum: 1 },
          },
        },
      ]),
      UsageEvent.aggregate([
        { $match: { createdAt: window } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              callType: '$callType',
            },
            costUsd: { $sum: '$costUsd' },
          },
        },
      ]),
      UsageEvent.aggregate([
        { $match: { createdAt: window } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: { $add: ['$outputTokens', { $ifNull: ['$thinkingTokens', 0] }] } },
          },
        },
      ]),
      UsageEvent.aggregate([
        { $match: { createdAt: window } },
        usageGroupStage('$userId'),
        { $sort: { costUsd: -1 } },
        { $limit: 10 },
      ]),
      PracticeSession.aggregate([
        { $match: { createdAt: window, isTest: { $ne: true } } },
        { $addFields: { sessionMs: SESSION_MS_EXPR } },
        {
          $bucket: {
            groupBy: '$sessionMs',
            boundaries: [0, 5, 10, 15, 20, 25, 30].map((m) => m * 60_000),
            default: 'over',
            output: { count: { $sum: 1 } },
          },
        },
      ]),
      Promise.all(
        STREAK_THRESHOLDS.map((n) => UserProgress.countDocuments({ currentStreak: { $gte: n } })),
      ),
    ])

    const activeMap = new Map(activeByDay.map((x) => [x._id, x.users]))
    const signupMap = new Map(signupsByDay.map((x) => [x._id, x.signups]))
    const dailyActive = days.map((day) => ({
      day,
      users: activeMap.get(day) || 0,
      signups: signupMap.get(day) || 0,
    }))

    const callTypes = [...new Set(costByDayType.map((x) => x._id.callType || 'other'))].sort()
    const costMap = new Map()
    for (const x of costByDayType) {
      const day = x._id.day
      const row = costMap.get(day) || {}
      row[x._id.callType || 'other'] = (row[x._id.callType || 'other'] || 0) + x.costUsd
      costMap.set(day, row)
    }
    const dailyCost = days.map((day) => {
      const row = costMap.get(day) || {}
      const byType = {}
      let total = 0
      for (const t of callTypes) {
        byType[t] = roundUsd(row[t] || 0)
        total += row[t] || 0
      }
      return { day, total: roundUsd(total), ...byType }
    })

    const tokenMap = new Map(tokensByDay.map((x) => [x._id, x]))
    const dailyTokens = days.map((day) => {
      const t = tokenMap.get(day)
      return { day, input: t?.inputTokens || 0, output: t?.outputTokens || 0 }
    })

    const topMap = await loadUserBriefs(topUsers.map((x) => x._id))
    const topExpensiveUsers = topUsers.map((x) => ({
      user: topMap.get(String(x._id)) || { id: String(x._id), name: 'Unknown', email: '' },
      ...shapeUsageRow(x, current.geminiCost),
    }))

    const bucketMap = new Map(bucketAgg.map((b) => [b._id, b.count]))
    const sessionLengthBuckets = SESSION_BUCKET_LABELS.map((label, i) => ({
      label: `${label} min`,
      minMinutes: i * 5,
      maxMinutes: (i + 1) * 5,
      count: bucketMap.get(i * 5 * 60_000) || 0,
    }))
    const overCount = bucketMap.get('over') || 0
    if (overCount) {
      sessionLengthBuckets.push({ label: '30+ min', minMinutes: 30, maxMinutes: null, count: overCount })
    }

    const kpis = {
      totalUsers: kpi(totalUsers),
      newSignups: kpi(current.newSignups, previous.newSignups),
      dau: kpi(current.dau, previous.dau),
      sessions: kpi(current.sessions, previous.sessions),
      minutesSpoken: kpi(current.minutesSpoken, previous.minutesSpoken),
      lessonsCompleted: kpi(current.lessonsCompleted, previous.lessonsCompleted),
      geminiCost: kpi(current.geminiCost, previous.geminiCost),
      costPerActiveUser: kpi(current.costPerActiveUser, previous.costPerActiveUser),
      costPerCompletedLesson: kpi(current.costPerCompletedLesson, previous.costPerCompletedLesson),
      errorRate: kpi(current.errorRate, previous.errorRate),
      flaggedUsers: kpi(flaggedUserIds.length),
    }

    res.json({
      ...rangeInfo(r),
      kpis,
      labels: {
        geminiCost: formatUsd(current.geminiCost),
        costPerActiveUser: formatUsd(current.costPerActiveUser),
        costPerCompletedLesson: formatUsd(current.costPerCompletedLesson),
      },
      charts: {
        dailyActive,
        dailyCost,
        dailyCostCallTypes: callTypes,
        dailyTokens,
        topExpensiveUsers,
        sessionLengthBuckets,
        streakCounts: STREAK_THRESHOLDS.map((threshold, i) => ({
          days: threshold,
          label: `${threshold}+ day${threshold === 1 ? '' : 's'}`,
          users: streakCounts[i],
        })),
      },
      apiKey: {
        configured: Boolean(apiKey),
        masked: maskApiKey(apiKey),
        source: process.env.GEMINI_API_KEY
          ? 'GEMINI_API_KEY'
          : process.env.VITE_GEMINI_API_KEY
            ? 'VITE_GEMINI_API_KEY'
            : null,
      },
      openFlags,
    })
  }),
)

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

router.get(
  '/users',
  route('load users', async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100)
    const status = String(req.query.status || '').trim()
    const level = String(req.query.level || '').trim()
    const flagged = ['1', 'true', 'yes'].includes(String(req.query.flagged || '').toLowerCase())
    const sort = USER_SORT_FIELDS.includes(req.query.sort) ? req.query.sort : 'createdAt'
    const dir = String(req.query.dir).toLowerCase() === 'asc' ? 1 : -1
    const limit = clampInt(req.query.limit, 25, 1, 100)
    const page = clampInt(req.query.page, 1, 1, 100_000)

    const filter = { role: { $ne: 'admin' } }
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i')
      filter.$or = [{ name: rx }, { email: rx }]
    }
    if (USER_STATUSES.includes(status)) filter.status = status
    if (LEVELS.includes(level)) filter.level = level
    if (flagged) {
      const ids = await UserFlag.distinct('userId', { status: 'open' })
      filter._id = { $in: ids }
    }

    let query = User.find(filter)
      .select('-passwordHash')
      .sort({ [sort]: dir, _id: dir })
      .skip((page - 1) * limit)
      .limit(limit)
    if (sort === 'name') query = query.collation({ locale: 'en', strength: 2 })

    const [total, users] = await Promise.all([User.countDocuments(filter), query.lean()])
    const ids = users.map((u) => u._id)

    const [progressDocs, flagAgg] = await Promise.all([
      UserProgress.find({ userId: { $in: ids } }).lean(),
      UserFlag.aggregate([
        { $match: { userId: { $in: ids }, status: 'open' } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
    ])
    const progressMap = new Map(progressDocs.map((p) => [String(p.userId), p]))
    const flagMap = new Map(flagAgg.map((f) => [String(f._id), f.count]))

    const items = users.map((u) => {
      const progress = progressMap.get(String(u._id))
      return {
        ...baseUserFields(u),
        lessonsCompleted: Math.min(TOTAL_LESSONS, Number(progress?.lessonsCompleted) || 0),
        lessonsTotal: TOTAL_LESSONS,
        sessions: progress?.totalSessions || 0,
        minutes: round((progress?.totalPracticeMs || 0) / 60_000, 1),
        currentStreak: progress?.currentStreak || 0,
        openFlags: flagMap.get(String(u._id)) || 0,
      }
    })

    res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) })
  }),
)

router.post(
  '/users',
  route('create participant', async (req, res) => {
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const level = LEVELS.includes(req.body?.level) ? req.body.level : 'beginner'
    const planDays = Math.min(365, Math.max(1, Number(req.body?.planDays) || PLAN_DAYS))

    if (name.length < 2) {
      res.status(400).json({ error: 'Please enter the participant name' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }
    if (await User.findOne({ email })) {
      res.status(409).json({ error: 'An account with this email already exists' })
      return
    }

    const passwordHash = await User.hashPassword(password)
    const subscriptionEndsAt = new Date(Date.now() + planDays * DAY_MS)
    const user = await User.create({
      name,
      email,
      passwordHash,
      level,
      role: 'user',
      subscriptionEndsAt,
      signupSource: 'admin',
    })
    await UserProgress.create({ userId: user._id })

    await writeAudit({
      adminId: req.user._id,
      action: 'user.create',
      targetType: 'user',
      targetId: user._id,
      after: { name, email, level, planDays },
      ...clientMeta(req),
    })

    res.status(201).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        level: user.level,
        role: 'user',
        status: user.status,
        subscriptionEndsAt: subscriptionEndsAt.toISOString(),
        createdAt: user.createdAt,
      },
    })
  }),
)

async function usageSummaryFromDaily(userId, sinceDate) {
  const match = { userId }
  if (sinceDate) match.date = { $gte: sinceDate }
  const [row] = await DailyUserUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        costUsd: { $sum: '$costUsd' },
        sessions: { $sum: '$sessions' },
        minutes: { $sum: '$minutes' },
        turns: { $sum: '$turns' },
        inputTokens: { $sum: '$inputTokens' },
        outputTokens: { $sum: '$outputTokens' },
        totalTokens: { $sum: '$totalTokens' },
        calls: { $sum: '$calls' },
        errors: { $sum: { $ifNull: ['$errorCount', 0] } },
        activeDays: { $sum: 1 },
      },
    },
  ])
  return {
    costUsd: roundUsd(row?.costUsd),
    costLabel: formatUsd(row?.costUsd),
    sessions: row?.sessions || 0,
    minutes: round(row?.minutes, 1),
    turns: row?.turns || 0,
    inputTokens: row?.inputTokens || 0,
    outputTokens: row?.outputTokens || 0,
    totalTokens: row?.totalTokens || 0,
    calls: row?.calls || 0,
    errors: row?.errors || 0,
    activeDays: row?.activeDays || 0,
  }
}

router.get(
  '/users/:id',
  route('load user', async (req, res) => {
    if (!isValidId(req.params.id)) {
      res.status(400).json({ error: 'Invalid user id' })
      return
    }
    const userId = toObjectId(req.params.id)
    const user = await User.findById(userId).select('-passwordHash').lean()
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const [progress, lifetimeAgg, last7, last30, callTypeAgg, sessions, flags, audit] =
      await Promise.all([
        UserProgress.findOne({ userId }).lean(),
        UsageEvent.aggregate([{ $match: { userId } }, usageGroupStage(null)]),
        usageSummaryFromDaily(userId, dayStringMinusDays(6)),
        usageSummaryFromDaily(userId, dayStringMinusDays(29)),
        UsageEvent.aggregate([{ $match: { userId } }, usageGroupStage('$callType'), { $sort: { costUsd: -1 } }]),
        PracticeSession.find({ userId })
          .select('-transcript')
          .sort({ createdAt: -1 })
          .limit(30)
          .lean(),
        UserFlag.find({ userId, status: 'open' }).sort({ createdAt: -1 }).lean(),
        AdminAuditLog.find({ targetType: 'user', targetId: String(userId) })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate('adminId', 'name email')
          .lean(),
      ])

    // Per-session cost/tokens from events, as a fallback when the session totals are empty.
    const sessionIds = sessions.map((s) => s._id)
    const eventAgg = sessionIds.length
      ? await UsageEvent.aggregate([
          { $match: { sessionId: { $in: sessionIds } } },
          usageGroupStage('$sessionId'),
        ])
      : []
    const eventMap = new Map(eventAgg.map((e) => [String(e._id), e]))

    const life = lifetimeAgg[0]
    const lifetime = {
      ...shapeUsageRow(life || {}),
      costUsd: roundUsd(Math.max(life?.costUsd || 0, user.lifetimeCostUsd || 0)),
      costLabel: formatUsd(Math.max(life?.costUsd || 0, user.lifetimeCostUsd || 0)),
      sessions: progress?.totalSessions || 0,
      minutes: round((progress?.totalPracticeMs || 0) / 60_000, 1),
    }

    res.json({
      user: {
        ...baseUserFields(user),
        adminNotes: user.adminNotes || '',
        tokenVersion: user.tokenVersion || 0,
      },
      progress: serializeProgress(progress),
      usage: {
        lifetime,
        last7d: last7,
        last30d: last30,
        byCallType: callTypeAgg.map((c) => ({
          callType: c._id || 'other',
          ...shapeUsageRow(c, life?.costUsd || 0),
        })),
      },
      lessonStats: serializeLessonStats(progress),
      recentSessions: sessions.map((s) => {
        const ev = eventMap.get(String(s._id))
        const costUsd = s.totalCostUsd > 0 ? s.totalCostUsd : ev?.costUsd || 0
        const inputTokens = s.totalInputTokens > 0 ? s.totalInputTokens : ev?.inputTokens || 0
        const outputTokens = s.totalOutputTokens > 0 ? s.totalOutputTokens : ev?.outputTokens || 0
        const ms = s.durationMs > 0 ? s.durationMs : (s.durationSec || 0) * 1000
        return {
          id: String(s._id),
          lessonId: s.lessonId,
          lessonNumber: s.lessonNumber,
          lessonTitle: s.lessonTitle,
          status: s.status,
          completed: Boolean(s.completed || s.status === 'completed'),
          endReason: s.endReason || s.endedReason || '',
          durationMs: ms,
          minutes: round(ms / 60_000, 1),
          turns: s.turnCount || s.turns || 0,
          corrections: s.corrections || 0,
          overall: s.overall ?? null,
          isTest: Boolean(s.isTest),
          costUsd: roundUsd(costUsd),
          costLabel: formatUsd(costUsd),
          inputTokens,
          outputTokens,
          calls: ev?.calls || 0,
          startedAt: s.startedAt || s.createdAt,
          endedAt: s.endedAt || null,
        }
      }),
      openFlags: flags.map((f) => serializeFlag(f)),
      adminNotes: user.adminNotes || '',
      audit: audit.map(serializeAudit),
    })
  }),
)

/* -------------------------------------------------------------------------- */
/* POST /users/:id/actions                                                     */
/* -------------------------------------------------------------------------- */

const USER_ACTIONS = [
  'limit',
  'suspend',
  'ban',
  'reactivate',
  'renew_plan',
  'set_limits',
  'reset_progress',
  'force_logout',
  'delete',
  'set_notes',
]
const REASON_REQUIRED = ['limit', 'suspend', 'ban', 'reset_progress', 'delete']

function userSnapshot(user) {
  const o = typeof user.toObject === 'function' ? user.toObject() : user
  return {
    name: o.name,
    email: o.email,
    status: o.status,
    statusReason: o.statusReason || '',
    statusUntil: o.statusUntil || null,
    subscriptionEndsAt: o.subscriptionEndsAt || null,
    limitsOverride: o.limitsOverride || {},
    tokenVersion: o.tokenVersion || 0,
    adminNotes: o.adminNotes || '',
  }
}

async function resetUserProgress(userId) {
  await UserProgress.findOneAndUpdate(
    { userId },
    {
      $set: {
        totalSessions: 0,
        totalPracticeMs: 0,
        totalTurns: 0,
        totalCorrections: 0,
        lessonsCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastPracticeDate: '',
        lessonStats: [],
      },
    },
    { upsert: true, new: true },
  )
}

function parseSuspendUntil(body) {
  const until = parseDate(body.until)
  if (until) return until
  const days = Number(body.days)
  if (Number.isFinite(days) && days > 0) return new Date(Date.now() + Math.min(days, 3650) * DAY_MS)
  return null
}

function applyLimitsOverride(user, raw) {
  const next = {}
  for (const key of OVERRIDE_KEYS) {
    if (!(key in raw)) continue
    const v = raw[key]
    if (v === null || v === '' || v === undefined) continue // blank clears the override
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) return { error: `${key} must be a positive number` }
    next[key] = Math.round(n)
  }
  for (const key of OVERRIDE_KEYS) {
    if (key in raw) user.set(`limitsOverride.${key}`, key in next ? next[key] : undefined)
  }
  return { applied: next }
}

router.post(
  '/users/:id/actions',
  route('apply user action', async (req, res) => {
    if (!isValidId(req.params.id)) {
      res.status(400).json({ error: 'Invalid user id' })
      return
    }
    const body = req.body || {}
    const action = String(body.action || '')
    const reason = safeReason(body.reason)

    if (!USER_ACTIONS.includes(action)) {
      res.status(400).json({ error: `Unknown action. Use one of: ${USER_ACTIONS.join(', ')}` })
      return
    }
    if (REASON_REQUIRED.includes(action) && reason.length < 3) {
      res.status(400).json({ error: 'Please provide a reason for this action' })
      return
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    if (user.role === 'admin' || String(user._id) === String(req.user._id)) {
      res.status(403).json({ error: 'Actions cannot be applied to admin accounts' })
      return
    }

    const before = userSnapshot(user)
    const meta = clientMeta(req)
    let extra = null

    switch (action) {
      case 'limit':
        user.status = 'limited'
        user.statusReason = reason
        user.statusUntil = parseDate(body.until) || undefined
        break

      case 'suspend': {
        const until = parseSuspendUntil(body)
        if (!until || until <= new Date()) {
          res.status(400).json({ error: 'Provide a future "until" date (or "days") for suspension' })
          return
        }
        user.status = 'suspended'
        user.statusReason = reason
        user.statusUntil = until
        user.tokenVersion = (user.tokenVersion || 0) + 1
        break
      }

      case 'ban':
        user.status = 'banned'
        user.statusReason = reason
        user.statusUntil = undefined
        user.tokenVersion = (user.tokenVersion || 0) + 1
        break

      case 'reactivate': {
        // Restoring access after a 30-day plan end must also renew the plan,
        // otherwise the next login would re-suspend immediately.
        if (isPlanExpired(user) || String(user.statusReason || '') === '30-day plan ended') {
          renewPlanFrom(user)
        }
        user.status = 'active'
        user.statusReason = ''
        user.statusUntil = undefined
        await dismissPlanExpiredFlags(
          user._id,
          req.user._id,
          reason || 'Access restored by admin',
        )
        break
      }

      case 'renew_plan': {
        const ends = renewPlanFrom(user)
        user.status = 'active'
        user.statusReason = ''
        user.statusUntil = undefined
        await dismissPlanExpiredFlags(
          user._id,
          req.user._id,
          reason || 'Plan renewed by admin',
        )
        extra = { subscriptionEndsAt: ends.toISOString() }
        break
      }

      case 'set_limits': {
        const raw = body.limits ?? body.limitsOverride
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          res.status(400).json({ error: 'Provide a "limits" object' })
          return
        }
        const result = applyLimitsOverride(user, raw)
        if (result.error) {
          res.status(400).json({ error: result.error })
          return
        }
        break
      }

      case 'set_notes':
        user.adminNotes = String(body.notes ?? '').slice(0, 5000)
        break

      case 'reset_progress':
        await resetUserProgress(user._id)
        break

      case 'force_logout':
        user.tokenVersion = (user.tokenVersion || 0) + 1
        break

      case 'delete': {
        if (String(user.email).endsWith('@anon.local')) {
          res.status(409).json({ error: 'This account has already been deleted' })
          return
        }
        user.name = 'Deleted User'
        user.email = `deleted+${user._id}@anon.local`
        user.passwordHash = await User.hashPassword(crypto.randomBytes(24).toString('hex'))
        user.status = 'banned'
        user.statusReason = 'Account deleted'
        user.statusUntil = undefined
        user.adminNotes = ''
        user.tokenVersion = (user.tokenVersion || 0) + 1
        for (const key of OVERRIDE_KEYS) user.set(`limitsOverride.${key}`, undefined)

        // Wipe personal content; keep usage events and counters for cost accounting.
        const [sessionResult] = await Promise.all([
          PracticeSession.updateMany(
            { userId: user._id },
            { $set: { transcript: [], topMistakes: [] } },
          ),
          resetUserProgress(user._id),
          UserFlag.updateMany(
            { userId: user._id, status: 'open' },
            {
              $set: {
                status: 'dismissed',
                note: 'Account deleted',
                reviewedBy: req.user._id,
                reviewedAt: new Date(),
              },
            },
          ),
        ])
        extra = { transcriptsCleared: sessionResult.modifiedCount ?? 0 }
        break
      }

      default:
        break
    }

    if (user.isModified()) await user.save()

    await writeAudit({
      adminId: req.user._id,
      action: `user.${action}`,
      targetType: 'user',
      targetId: user._id,
      before,
      after: { ...userSnapshot(user), ...(extra || {}) },
      reason,
      ip: meta.ip,
    })

    res.json({ ok: true, action, user: baseUserFields(user.toObject()), ...(extra || {}) })
  }),
)

/* -------------------------------------------------------------------------- */
/* GET /costs                                                                  */
/* -------------------------------------------------------------------------- */

router.get(
  '/costs',
  route('load costs', async (req, res) => {
    const r = parseRange(req.query)
    const window = { $gte: r.from, $lt: r.to }
    const match = { $match: { createdAt: window } }
    const days = dayKeys(r.from, r.to)

    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()

    const [dayAgg, userAgg, lessonAgg, sessionAgg, callTypeAgg, modelAgg, mtdAgg, limits] =
      await Promise.all([
        UsageEvent.aggregate([
          match,
          usageGroupStage({ $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }),
        ]),
        UsageEvent.aggregate([match, usageGroupStage('$userId'), { $sort: { costUsd: -1 } }]),
        UsageEvent.aggregate([
          { $match: { createdAt: window, lessonId: { $exists: true, $nin: [null, ''] } } },
          {
            $group: {
              _id: '$lessonId',
              costUsd: { $sum: '$costUsd' },
              calls: { $sum: 1 },
              inputTokens: { $sum: '$inputTokens' },
              outputTokens: { $sum: { $add: ['$outputTokens', { $ifNull: ['$thinkingTokens', 0] }] } },
              totalTokens: { $sum: '$totalTokens' },
              errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
              sessions: { $addToSet: '$sessionId' },
              users: { $addToSet: '$userId' },
            },
          },
          {
            $addFields: { sessions: { $size: '$sessions' }, users: { $size: '$users' } },
          },
          { $sort: { costUsd: -1 } },
        ]),
        UsageEvent.aggregate([
          { $match: { createdAt: window, sessionId: { $exists: true, $ne: null } } },
          usageGroupStage('$sessionId'),
          { $sort: { costUsd: -1 } },
          { $limit: 50 },
        ]),
        UsageEvent.aggregate([match, usageGroupStage('$callType'), { $sort: { costUsd: -1 } }]),
        UsageEvent.aggregate([match, usageGroupStage('$model'), { $sort: { costUsd: -1 } }]),
        UsageEvent.aggregate([
          { $match: { createdAt: { $gte: monthStart, $lte: now } } },
          { $group: { _id: null, costUsd: { $sum: '$costUsd' } } },
        ]),
        getLimitsConfig(),
      ])

    const totalCost = userAgg.reduce((sum, u) => sum + u.costUsd, 0)

    // byDay (zero-filled)
    const dayMap = new Map(dayAgg.map((d) => [d._id, d]))
    const byDay = days.map((day) => ({ day, ...shapeUsageRow(dayMap.get(day) || {}, totalCost) }))

    // byUser (top 50) + per-user percentiles across everyone with spend
    const topUserRows = userAgg.slice(0, 50)
    const userMap = await loadUserBriefs(topUserRows.map((u) => u._id))
    const byUser = topUserRows.map((u) => ({
      user: userMap.get(String(u._id)) || { id: String(u._id), name: 'Unknown', email: '' },
      ...shapeUsageRow(u, totalCost),
    }))

    const perUser = userAgg.map((u) => u.costUsd).filter((c) => c > 0).sort((a, b) => a - b)
    const percentiles = {
      users: perUser.length,
      avg: roundUsd(safeDiv(totalCost, perUser.length)),
      median: roundUsd(percentile(perUser, 0.5)),
      p90: roundUsd(percentile(perUser, 0.9)),
      p99: roundUsd(percentile(perUser, 0.99)),
    }

    const top1 = userAgg[0]?.costUsd || 0
    const top10 = userAgg.slice(0, 10).reduce((sum, u) => sum + u.costUsd, 0)
    const concentration = {
      top1Share: round(safeDiv(top1, totalCost), 4),
      top10Share: round(safeDiv(top10, totalCost), 4),
      top1Usd: roundUsd(top1),
      top10Usd: roundUsd(top10),
    }

    // byLesson
    const lessonIds = lessonAgg.map((l) => l._id)
    const lessonMeta = lessonIds.length
      ? await PracticeSession.aggregate([
          { $match: { lessonId: { $in: lessonIds } } },
          {
            $group: {
              _id: '$lessonId',
              title: { $first: '$lessonTitle' },
              lessonNumber: { $first: '$lessonNumber' },
            },
          },
        ])
      : []
    const lessonMap = new Map(lessonMeta.map((l) => [l._id, l]))
    const byLesson = lessonAgg.map((l) => ({
      lessonId: l._id,
      lessonNumber: lessonMap.get(l._id)?.lessonNumber ?? null,
      title: lessonMap.get(l._id)?.title || l._id,
      sessions: l.sessions,
      users: l.users,
      costPerSession: roundUsd(safeDiv(l.costUsd, l.sessions)),
      ...shapeUsageRow(l, totalCost),
    }))

    // bySession (top 50)
    const sessionDocs = await PracticeSession.find({ _id: { $in: sessionAgg.map((s) => s._id) } })
      .select('userId lessonId lessonNumber lessonTitle status durationMs startedAt createdAt')
      .lean()
    const sessionMap = new Map(sessionDocs.map((s) => [String(s._id), s]))
    const sessionUsers = await loadUserBriefs(sessionDocs.map((s) => s.userId))
    const bySession = sessionAgg.map((s) => {
      const doc = sessionMap.get(String(s._id))
      return {
        sessionId: String(s._id),
        user: doc ? sessionUsers.get(String(doc.userId)) || null : null,
        lessonId: doc?.lessonId || null,
        lessonTitle: doc?.lessonTitle || null,
        status: doc?.status || null,
        minutes: round((doc?.durationMs || 0) / 60_000, 1),
        startedAt: doc?.startedAt || doc?.createdAt || null,
        ...shapeUsageRow(s, totalCost),
      }
    })

    const byCallType = callTypeAgg.map((c) => ({
      callType: c._id || 'other',
      ...shapeUsageRow(c, totalCost),
    }))
    const byModel = modelAgg.map((m) => ({ model: m._id || 'unknown', ...shapeUsageRow(m, totalCost) }))

    // Projection from month-to-date spend
    const mtd = mtdAgg[0]?.costUsd || 0
    const elapsedDays = Math.max((now.getTime() - monthStart.getTime()) / DAY_MS, 1 / 24)
    const projected = (mtd / elapsedDays) * daysInMonth
    const projectedMonthly = {
      mtdUsd: roundUsd(mtd),
      mtdLabel: formatUsd(mtd),
      dailyRunRateUsd: roundUsd(mtd / elapsedDays),
      projectedUsd: roundUsd(projected),
      projectedLabel: formatUsd(projected),
      daysElapsed: round(elapsedDays, 2),
      daysInMonth,
      monthlyBudgetUsd: limits.monthlyBudgetUsd,
      budgetUsedPct: round(safeDiv(mtd, limits.monthlyBudgetUsd) * 100, 1),
      projectedOverBudget: limits.monthlyBudgetUsd > 0 && projected > limits.monthlyBudgetUsd,
    }

    res.json({
      ...rangeInfo(r),
      totals: {
        costUsd: roundUsd(totalCost),
        costLabel: formatUsd(totalCost),
        calls: userAgg.reduce((sum, u) => sum + u.calls, 0),
        activeUsers: userAgg.length,
      },
      byDay,
      byUser,
      byLesson,
      bySession,
      byCallType,
      byModel,
      percentiles,
      concentration,
      projectedMonthly,
    })
  }),
)

/* -------------------------------------------------------------------------- */
/* Flags                                                                       */
/* -------------------------------------------------------------------------- */

router.get(
  '/flags',
  route('load flags', async (req, res) => {
    const status = String(req.query.status || 'open')
    const limit = clampInt(req.query.limit, 100, 1, 500)
    const filter = ['open', 'dismissed', 'actioned'].includes(status) ? { status } : {}

    const [flags, openCount] = await Promise.all([
      UserFlag.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      UserFlag.countDocuments({ status: 'open' }),
    ])
    const userMap = await loadUserBriefs(flags.map((f) => f.userId))
    res.json({
      status: filter.status || 'all',
      openCount,
      items: flags.map((f) => serializeFlag(f, userMap)),
    })
  }),
)

router.post(
  '/flags/scan',
  route('scan for abuse flags', async (req, res) => {
    const result = await scanAbuseFlags()
    await writeAudit({
      adminId: req.user._id,
      action: 'flag.scan',
      targetType: 'system',
      after: result,
      ...clientMeta(req),
    })
    res.json({ ok: true, ...result, openCount: await UserFlag.countDocuments({ status: 'open' }) })
  }),
)

router.post(
  '/flags/:id',
  route('update flag', async (req, res) => {
    if (!isValidId(req.params.id)) {
      res.status(400).json({ error: 'Invalid flag id' })
      return
    }
    const action = String(req.body?.action || '')
    const note = safeReason(req.body?.note, 1000)
    const nextStatus = action === 'dismiss' ? 'dismissed' : action === 'actioned' ? 'actioned' : null
    if (!nextStatus) {
      res.status(400).json({ error: 'Action must be "dismiss" or "actioned"' })
      return
    }

    const flag = await UserFlag.findById(req.params.id)
    if (!flag) {
      res.status(404).json({ error: 'Flag not found' })
      return
    }
    if (flag.status !== 'open') {
      res.status(409).json({ error: `Flag is already ${flag.status}` })
      return
    }

    const before = { status: flag.status, note: flag.note }
    flag.status = nextStatus
    flag.note = note
    flag.reviewedBy = req.user._id
    flag.reviewedAt = new Date()
    await flag.save()

    await writeAudit({
      adminId: req.user._id,
      action: `flag.${action}`,
      targetType: 'flag',
      targetId: flag._id,
      before,
      after: { status: flag.status, note: flag.note, rule: flag.rule, userId: String(flag.userId) },
      reason: note,
      ...clientMeta(req),
    })

    const userMap = await loadUserBriefs([flag.userId])
    res.json({ ok: true, flag: serializeFlag(flag.toObject(), userMap) })
  }),
)

/* -------------------------------------------------------------------------- */
/* GET /sessions/:id (replay)                                                  */
/* -------------------------------------------------------------------------- */

router.get(
  '/sessions/:id',
  route('load session', async (req, res) => {
    if (!isValidId(req.params.id)) {
      res.status(400).json({ error: 'Invalid session id' })
      return
    }
    const session = await PracticeSession.findById(req.params.id).lean()
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const [events, user, progress, sessionCount] = await Promise.all([
      UsageEvent.find({ sessionId: session._id }).sort({ turnIndex: 1, createdAt: 1 }).lean(),
      User.findById(session.userId).select('-passwordHash').lean(),
      UserProgress.findOne({ userId: session.userId }).lean(),
      PracticeSession.countDocuments({ userId: session.userId }),
    ])

    const shapeEvent = (e) => ({
      id: String(e._id),
      turnIndex: e.turnIndex || 0,
      callType: e.callType,
      model: e.model,
      status: e.status,
      errorCode: e.errorCode || '',
      latencyMs: e.latencyMs || 0,
      inputTokens: e.inputTokens || 0,
      outputTokens: e.outputTokens || 0,
      thinkingTokens: e.thinkingTokens || 0,
      cachedTokens: e.cachedTokens || 0,
      totalTokens: e.totalTokens || 0,
      userTextChars: e.userTextChars || 0,
      costUsd: roundUsd(e.costUsd),
      costLabel: formatUsd(e.costUsd),
      createdAt: e.createdAt,
    })

    // Group transcript messages and usage events by turn index.
    const turnMap = new Map()
    const getTurn = (index) => {
      if (!turnMap.has(index)) turnMap.set(index, { turnIndex: index, messages: [], events: [] })
      return turnMap.get(index)
    }
    for (const m of session.transcript || []) {
      getTurn(m.turnIndex || 0).messages.push({
        role: m.role,
        text: m.text,
        at: m.at || null,
        correction: Boolean(m.correction),
        practiceAttempts: m.practiceAttempts || 0,
      })
    }
    for (const e of events) getTurn(e.turnIndex || 0).events.push(shapeEvent(e))

    const turns = [...turnMap.values()]
      .sort((a, b) => a.turnIndex - b.turnIndex)
      .map((t) => {
        const cost = t.events.reduce((sum, e) => sum + e.costUsd, 0)
        return {
          ...t,
          costUsd: roundUsd(cost),
          costLabel: formatUsd(cost),
          inputTokens: t.events.reduce((sum, e) => sum + e.inputTokens, 0),
          outputTokens: t.events.reduce((sum, e) => sum + e.outputTokens + e.thinkingTokens, 0),
          latencyMs: t.events.reduce((max, e) => Math.max(max, e.latencyMs), 0),
        }
      })

    const eventCost = events.reduce((sum, e) => sum + (e.costUsd || 0), 0)
    const totalCost = session.totalCostUsd > 0 ? session.totalCostUsd : eventCost
    const durationMs = session.durationMs > 0 ? session.durationMs : (session.durationSec || 0) * 1000

    await writeAudit({
      adminId: req.user._id,
      action: 'session.view',
      targetType: 'session',
      targetId: session._id,
      after: { userId: String(session.userId) },
      ...clientMeta(req),
    })

    res.json({
      session: {
        id: String(session._id),
        userId: String(session.userId),
        lessonId: session.lessonId,
        lessonNumber: session.lessonNumber,
        lessonTitle: session.lessonTitle,
        status: session.status,
        completed: Boolean(session.completed || session.status === 'completed'),
        endReason: session.endReason || session.endedReason || '',
        durationMs,
        minutes: round(durationMs / 60_000, 1),
        turnCount: session.turnCount || session.turns || 0,
        corrections: session.corrections || 0,
        practiceSuccesses: session.practiceSuccesses || 0,
        maxStreak: session.maxStreak || 0,
        scores: session.scores || null,
        overall: session.overall ?? null,
        topMistakes: session.topMistakes || [],
        promptVersion: session.promptVersion || '',
        isTest: Boolean(session.isTest),
        totalInputTokens: session.totalInputTokens || events.reduce((s, e) => s + (e.inputTokens || 0), 0),
        totalOutputTokens:
          session.totalOutputTokens ||
          events.reduce((s, e) => s + (e.outputTokens || 0) + (e.thinkingTokens || 0), 0),
        costUsd: roundUsd(totalCost),
        costLabel: formatUsd(totalCost),
        startedAt: session.startedAt || session.createdAt,
        endedAt: session.endedAt || null,
      },
      transcript: (session.transcript || []).map((m) => ({
        role: m.role,
        text: m.text,
        turnIndex: m.turnIndex || 0,
        at: m.at || null,
        correction: Boolean(m.correction),
        practiceAttempts: m.practiceAttempts || 0,
      })),
      turns,
      events: events.map(shapeEvent),
      user: user
        ? {
            ...baseUserFields(user),
            sessionsTotal: sessionCount,
            lessonsCompleted: Math.min(TOTAL_LESSONS, Number(progress?.lessonsCompleted) || 0),
            currentStreak: progress?.currentStreak || 0,
            adminNotes: user.adminNotes || '',
          }
        : null,
    })
  }),
)

/* -------------------------------------------------------------------------- */
/* GET /health                                                                 */
/* -------------------------------------------------------------------------- */

router.get(
  '/health',
  route('load health', async (_req, res) => {
    const now = new Date()
    const hourAgo = new Date(now.getTime() - HOUR_MS)
    const twoHoursAgo = new Date(now.getTime() - 2 * HOUR_MS)
    const todayStart = startOfUtcDay(now)

    let mongoOk = mongoose.connection.readyState === 1
    if (mongoOk) {
      try {
        await mongoose.connection.db.admin().ping()
      } catch {
        mongoOk = false
      }
    }

    const [hourAgg, rateLimitedToday, latencyRows, errorSessionsToday, activeSessions, errorCodes] =
      await Promise.all([
        UsageEvent.aggregate([
          { $match: { createdAt: { $gte: hourAgo } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
              rateLimited: { $sum: { $cond: [{ $eq: ['$status', 'rate_limited'] }, 1, 0] } },
              blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
            },
          },
        ]),
        UsageEvent.countDocuments({ status: 'rate_limited', createdAt: { $gte: todayStart } }),
        UsageEvent.find({ createdAt: { $gte: hourAgo }, latencyMs: { $gt: 0 } })
          .select('latencyMs')
          .sort({ createdAt: -1 })
          .limit(20_000)
          .lean(),
        PracticeSession.countDocuments({
          createdAt: { $gte: todayStart },
          $or: [{ endReason: 'error' }, { endedReason: 'error' }],
        }),
        PracticeSession.countDocuments({ status: 'active', startedAt: { $gt: twoHoursAgo } }),
        UsageEvent.aggregate([
          { $match: { createdAt: { $gte: hourAgo }, status: 'error' } },
          { $group: { _id: '$errorCode', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
      ])

    const h = hourAgg[0] || {}
    const latencies = latencyRows.map((r) => r.latencyMs).sort((a, b) => a - b)

    res.json({
      checkedAt: now.toISOString(),
      mongo: { ok: mongoOk, readyState: mongoose.connection.readyState },
      gemini: {
        apiKeyConfigured: Boolean(resolveApiKey(process.env)),
        callsLastHour: h.total || 0,
        errorsLastHour: h.errors || 0,
        errorRateLastHour: round(safeDiv(h.errors || 0, h.total || 0), 4),
        blockedLastHour: h.blocked || 0,
        topErrorCodes: errorCodes.map((e) => ({ code: e._id || 'unknown', count: e.count })),
      },
      latency: {
        samples: latencies.length,
        p50: Math.round(percentile(latencies, 0.5)),
        p95: Math.round(percentile(latencies, 0.95)),
      },
      rateLimited: { lastHour: h.rateLimited || 0, today: rateLimitedToday },
      sessions: {
        endedWithErrorToday: errorSessionsToday,
        active: activeSessions,
      },
    })
  }),
)

/* -------------------------------------------------------------------------- */
/* Limits                                                                      */
/* -------------------------------------------------------------------------- */

router.get(
  '/limits',
  route('load limits', async (_req, res) => {
    const doc = await getLimitsConfig()
    res.json({ limits: pickLimits(doc) })
  }),
)

router.put(
  '/limits',
  route('update limits', async (req, res) => {
    const input = req.body?.limits && typeof req.body.limits === 'object' ? req.body.limits : req.body || {}
    const reason = safeReason(req.body?.reason)

    const update = {}
    for (const [key, spec] of Object.entries(LIMIT_FIELDS)) {
      if (!(key in input)) continue
      const n = Number(input[key])
      if (input[key] === '' || input[key] === null || !Number.isFinite(n)) {
        res.status(400).json({ error: `${key} must be a number` })
        return
      }
      if (n < spec.min || n > spec.max) {
        res.status(400).json({ error: `${key} must be between ${spec.min} and ${spec.max}` })
        return
      }
      update[key] = spec.int ? Math.round(n) : n
    }
    if (!Object.keys(update).length) {
      res.status(400).json({ error: 'No valid limit fields provided' })
      return
    }

    const beforeDoc = await getLimitsConfig()
    const before = pickLimits(beforeDoc)
    const updated = await LimitsConfig.findOneAndUpdate(
      { key: 'default' },
      { $set: update },
      { new: true, upsert: true, runValidators: true },
    )
    invalidateLimitsCache()

    const after = pickLimits(updated)
    const changed = {}
    for (const key of Object.keys(update)) {
      if (before[key] !== after[key]) changed[key] = { from: before[key], to: after[key] }
    }

    await writeAudit({
      adminId: req.user._id,
      action: 'limits.update',
      targetType: 'setting',
      targetId: 'limits:default',
      before,
      after: { ...after, changed },
      reason,
      ...clientMeta(req),
    })

    res.json({ ok: true, limits: after, changed })
  }),
)

/* -------------------------------------------------------------------------- */
/* Audit + pricing                                                             */
/* -------------------------------------------------------------------------- */

router.get(
  '/audit',
  route('load audit log', async (req, res) => {
    const limit = clampInt(req.query.limit, 50, 1, 200)
    const filter = {}
    if (req.query.targetType) filter.targetType = String(req.query.targetType)
    if (req.query.targetId) filter.targetId = String(req.query.targetId)
    if (req.query.action) filter.action = String(req.query.action)

    const rows = await AdminAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('adminId', 'name email')
      .lean()
    res.json({ items: rows.map(serializeAudit) })
  }),
)

router.get(
  '/pricing',
  route('load pricing', async (_req, res) => {
    res.json(await pricingCatalog())
  }),
)

router.get(
  '/free-test-leads',
  route('load free-test leads', async (req, res) => {
    const limit = clampInt(req.query.limit, 50, 1, 200)
    const q = String(req.query.q || '').trim()
    const filter = {}
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ email: rx }, { topic: rx }]
    }

    const [rows, total] = await Promise.all([
      FreeTestLead.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      FreeTestLead.countDocuments(filter),
    ])

    res.json({
      total,
      leads: rows.map((r) => ({
        id: r._id.toString(),
        email: r.email,
        topic: r.topic,
        transcript: r.transcript,
        durationSec: r.durationSec,
        overall: r.overall ?? r.report?.overall ?? null,
        level: r.level || r.report?.level || '',
        createdAt: r.createdAt,
        report: r.report || null,
      })),
    })
  }),
)

export default router
