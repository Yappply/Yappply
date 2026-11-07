import { User } from '../models/User.mjs'
import { UserFlag } from '../models/UserFlag.mjs'
import { UsageEvent } from '../models/UsageEvent.mjs'
import { DailyUserUsage } from '../models/DailyUserUsage.mjs'
import { getLimitsConfig } from './limits.mjs'
import { enforcePlanExpired } from './planAccess.mjs'

function utcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

async function openFlag(userId, rule, evidence = {}, sessionIds = []) {
  const existing = await UserFlag.findOne({ userId, rule, status: 'open' })
  if (existing) {
    existing.evidence = { ...existing.evidence, ...evidence, updatedAt: new Date() }
    if (sessionIds.length) {
      existing.sessionIds = [...new Set([...(existing.sessionIds || []).map(String), ...sessionIds.map(String)])]
    }
    await existing.save()
    return existing
  }
  return UserFlag.create({ userId, rule, evidence, sessionIds })
}

/**
 * Raise automatic abuse flags from recent usage.
 */
export async function scanAbuseFlags() {
  const limits = await getLimitsConfig()
  const today = utcDateString()
  let flagged = 0

  // Flag / suspend accounts whose 30-day plan has ended
  const now = new Date()
  const expiredCandidates = await User.find({
    role: { $ne: 'admin' },
    status: { $nin: ['banned'] },
    $or: [
      { subscriptionEndsAt: { $lte: now } },
      { subscriptionEndsAt: null, createdAt: { $lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
    ],
  }).limit(500)
  for (const user of expiredCandidates) {
    if (await enforcePlanExpired(user, now)) flagged += 1
  }

  const dayRows = await DailyUserUsage.find({ date: today }).lean()
  if (!dayRows.length) return { flagged }

  const costs = dayRows.map((r) => r.costUsd || 0).filter((c) => c > 0).sort((a, b) => a - b)
  const median =
    costs.length === 0
      ? 0
      : costs.length % 2
        ? costs[(costs.length - 1) / 2]
        : (costs[costs.length / 2 - 1] + costs[costs.length / 2]) / 2

  for (const row of dayRows) {
    const user = await User.findById(row.userId)
    if (!user || user.role === 'admin') continue

    if (median > 0 && row.costUsd >= median * (limits.dailyCostFlagMultiplier || 5)) {
      await openFlag(user._id, 'daily_cost_high', {
        costUsd: row.costUsd,
        median,
        multiplier: limits.dailyCostFlagMultiplier,
      })
      flagged += 1

      if (row.costUsd >= median * (limits.autoLimitCostMultiplier || 10) && user.status === 'active') {
        user.status = 'limited'
        user.statusReason = 'Auto-limited: daily cost far above median'
        await user.save()
        await openFlag(user._id, 'auto_limited_high_cost', {
          costUsd: row.costUsd,
          median,
        })
      }
    }

    if ((row.errorCount || row.errors || 0) >= 10) {
      await openFlag(user._id, 'high_error_rate', {
        errors: row.errorCount || row.errors,
        calls: row.calls,
      })
      flagged += 1
    }
  }

  // Repeated char-limit blocks today
  const dayStart = new Date(`${today}T00:00:00.000Z`)
  const blocked = await UsageEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: dayStart },
        status: 'blocked',
        errorCode: 'chars_limit',
      },
    },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ])
  for (const b of blocked) {
    if (b.count >= 3) {
      await openFlag(b._id, 'repeated_char_limit', { count: b.count })
      flagged += 1
    }
  }

  return { flagged }
}
