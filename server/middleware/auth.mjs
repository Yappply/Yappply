import jwt from 'jsonwebtoken'
import { User } from '../models/User.mjs'
import { enforcePlanExpired } from '../lib/planAccess.mjs'

export function signToken(user) {
  const secret = process.env.JWT_SECRET || 'speakora-dev-secret-change-me'
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      tv: user.tokenVersion || 0,
    },
    secret,
    { expiresIn: user.role === 'admin' ? '8h' : '2d' },
  )
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
      res.status(401).json({ error: 'Please log in' })
      return
    }
    const secret = process.env.JWT_SECRET || 'speakora-dev-secret-change-me'
    const payload = jwt.verify(token, secret)
    const user = await User.findById(payload.sub).select('-passwordHash')
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    if ((user.tokenVersion || 0) !== (payload.tv || 0)) {
      res.status(401).json({ error: 'Session expired. Please log in again.' })
      return
    }
    if (user.status === 'banned') {
      res.status(403).json({ error: 'This account has been banned' })
      return
    }
    if (user.role !== 'admin' && (await enforcePlanExpired(user))) {
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
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' })
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
      next()
      return
    }
    const secret = process.env.JWT_SECRET || 'speakora-dev-secret-change-me'
    const payload = jwt.verify(token, secret)
    const user = await User.findById(payload.sub).select('-passwordHash')
    if (user && (user.tokenVersion || 0) === (payload.tv || 0) && user.status !== 'banned') {
      req.user = user
    }
  } catch {
    /* ignore */
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

export function clientMeta(req) {
  const ip =
    (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    ''
  const userAgent = req.headers['user-agent'] || ''
  return { ip, userAgent }
}
