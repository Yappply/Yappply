import { Router } from 'express'
import { User } from '../models/User.mjs'
import { requireAuth, signToken } from '../middleware/auth.mjs'
import {
  enforcePlanExpired,
  resolveSubscriptionEndsAt,
} from '../lib/planAccess.mjs'

const router = Router()

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    level: user.level,
    role: user.role || 'user',
    status: user.status || 'active',
    subscriptionEndsAt: resolveSubscriptionEndsAt(user).toISOString(),
  }
}

router.post('/register', (_req, res) => {
  res.status(403).json({
    error: 'Public signup is closed. Ask an admin to create your account.',
  })
})

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const user = await User.findOne({ email })
    if (!user || !(await user.verifyPassword(password))) {
      res.status(401).json({ error: 'Email or password is incorrect' })
      return
    }
    if (user.status === 'banned') {
      res.status(403).json({ error: 'This account has been banned' })
      return
    }
    if (await enforcePlanExpired(user)) {
      res.status(403).json({
        error: 'Your 30-day plan has ended. Ask an admin to renew your access.',
        code: 'plan_expired',
      })
      return
    }
    if (user.status === 'suspended') {
      res.status(403).json({
        error: user.statusReason
          ? `This account is suspended: ${user.statusReason}`
          : 'This account is suspended. Contact an admin.',
        code: 'suspended',
      })
      return
    }
    user.lastLoginAt = new Date()
    user.lastActiveAt = new Date()
    await user.save()
    const token = signToken(user)
    res.json({ token, user: publicUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not log in' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) })
})

router.patch('/me', requireAuth, async (req, res) => {
  try {
    if (['beginner', 'intermediate', 'advanced'].includes(req.body?.level)) {
      req.user.level = req.body.level
    }
    if (typeof req.body?.name === 'string' && req.body.name.trim().length >= 2) {
      req.user.name = req.body.name.trim()
    }
    if (typeof req.body?.timezone === 'string' && req.body.timezone.trim()) {
      try {
        Intl.DateTimeFormat('en-US', { timeZone: req.body.timezone.trim() }).format(new Date())
        req.user.timezone = req.body.timezone.trim()
      } catch {
        /* ignore invalid timezone */
      }
    }
    await req.user.save()
    res.json({ user: publicUser(req.user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not update profile' })
  }
})

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '')
    const newPassword = String(req.body?.newPassword || '')

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' })
      return
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: 'New password must be different from the current one' })
      return
    }

    const user = await User.findById(req.user._id)
    if (!user || !(await user.verifyPassword(currentPassword))) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }

    user.passwordHash = await User.hashPassword(newPassword)
    await user.save()
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not change password' })
  }
})

export default router
