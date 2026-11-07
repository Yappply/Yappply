import { UserFlag } from '../models/UserFlag.mjs'

export const PLAN_DAYS = 30
export const DAY_MS = 24 * 60 * 60 * 1000
export const PLAN_EXPIRED_RULE = 'plan_expired'
export const PLAN_EXPIRED_REASON = '30-day plan ended'

export function resolveSubscriptionEndsAt(user) {
  if (user?.subscriptionEndsAt) return new Date(user.subscriptionEndsAt)
  const created = user?.createdAt ? new Date(user.createdAt) : new Date()
  return new Date(created.getTime() + PLAN_DAYS * DAY_MS)
}

export function isPlanExpired(user, now = new Date()) {
  if (!user || user.role === 'admin') return false
  if (user.status === 'banned') return false
  const ends = resolveSubscriptionEndsAt(user)
  return ends.getTime() <= now.getTime()
}

async function openPlanExpiredFlag(userId, evidence = {}) {
  const existing = await UserFlag.findOne({
    userId,
    rule: PLAN_EXPIRED_RULE,
    status: 'open',
  })
  if (existing) {
    existing.evidence = {
      ...existing.evidence,
      ...evidence,
      updatedAt: new Date().toISOString(),
    }
    await existing.save()
    return existing
  }
  return UserFlag.create({
    userId,
    rule: PLAN_EXPIRED_RULE,
    evidence,
  })
}

/**
 * Suspend a non-admin user whose 30-day plan has ended and raise an admin flag.
 * Returns true if the plan is expired (after enforcing).
 */
export async function enforcePlanExpired(user, now = new Date()) {
  if (!user || user.role === 'admin') return false
  if (!isPlanExpired(user, now)) return false

  const ends = resolveSubscriptionEndsAt(user)
  let changed = false

  if (user.status === 'active' || user.status === 'limited') {
    user.status = 'suspended'
    user.statusReason = PLAN_EXPIRED_REASON
    user.statusUntil = undefined
    user.tokenVersion = (user.tokenVersion || 0) + 1
    changed = true
  } else if (
    user.status === 'suspended' &&
    String(user.statusReason || '') !== PLAN_EXPIRED_REASON
  ) {
    // Keep other suspensions, but still flag plan expiry
  } else if (user.status === 'suspended' && !user.statusReason) {
    user.statusReason = PLAN_EXPIRED_REASON
    changed = true
  }

  if (!user.subscriptionEndsAt) {
    user.subscriptionEndsAt = ends
    changed = true
  }

  if (changed) await user.save()

  await openPlanExpiredFlag(user._id, {
    subscriptionEndsAt: ends.toISOString(),
    status: user.status,
  })

  return true
}

export function renewPlanFrom(user, { from = new Date(), days = PLAN_DAYS } = {}) {
  const base = from instanceof Date ? from : new Date(from)
  const start = base.getTime() > Date.now() ? base : new Date()
  user.subscriptionEndsAt = new Date(start.getTime() + Math.max(1, days) * DAY_MS)
  user.status = 'active'
  user.statusReason = ''
  user.statusUntil = undefined
  return user.subscriptionEndsAt
}

export async function dismissPlanExpiredFlags(userId, adminId, note = 'Plan renewed by admin') {
  await UserFlag.updateMany(
    { userId, rule: PLAN_EXPIRED_RULE, status: 'open' },
    {
      $set: {
        status: 'actioned',
        note,
        reviewedBy: adminId || undefined,
        reviewedAt: new Date(),
      },
    },
  )
}
