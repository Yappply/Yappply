import { User } from '../models/User.mjs'
import { UserProgress } from '../models/UserProgress.mjs'

const DEFAULT_EMAIL = 'admin@yappply.com'
const DEFAULT_PASSWORD = 'AdminYappply1!'
const DEFAULT_NAME = 'Yappply Admin'

/**
 * Ensure a single admin account exists.
 * Override with ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env.
 */
export async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD
  const name = (process.env.ADMIN_NAME || DEFAULT_NAME).trim() || DEFAULT_NAME

  let user = await User.findOne({ email })
  if (!user) {
    const passwordHash = await User.hashPassword(password)
    user = await User.create({
      name,
      email,
      passwordHash,
      level: 'advanced',
      role: 'admin',
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    await UserProgress.create({ userId: user._id })
    return { email, created: true, password }
  }

  let changed = false
  if (user.role !== 'admin') {
    user.role = 'admin'
    changed = true
  }
  if (process.env.ADMIN_PASSWORD) {
    user.passwordHash = await User.hashPassword(password)
    changed = true
  }
  if (changed) await user.save()

  return { email, created: false }
}
