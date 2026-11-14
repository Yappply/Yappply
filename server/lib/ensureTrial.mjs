import { User } from '../models/User.mjs'
import { UserProgress } from '../models/UserProgress.mjs'

const TRIAL_EMAIL = 'trial@yappply.com'
const TRIAL_PASSWORD = '12345678'
const TRIAL_NAME = 'Yappply Trial'

/** Keep the shared Introduction-only demo account available. */
export async function ensureTrialUser() {
  const email = TRIAL_EMAIL
  const passwordHash = await User.hashPassword(TRIAL_PASSWORD)
  const subscriptionEndsAt = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000)

  let user = await User.findOne({ email })
  if (!user) {
    user = await User.create({
      name: TRIAL_NAME,
      email,
      passwordHash,
      level: 'beginner',
      role: 'user',
      trial: true,
      status: 'active',
      subscriptionEndsAt,
    })
    await UserProgress.create({ userId: user._id })
    return { email, created: true }
  }

  user.name = user.name || TRIAL_NAME
  user.role = 'user'
  user.trial = true
  user.status = 'active'
  user.statusReason = ''
  user.passwordHash = passwordHash
  user.subscriptionEndsAt = subscriptionEndsAt
  await user.save()

  const progress = await UserProgress.findOne({ userId: user._id })
  if (!progress) await UserProgress.create({ userId: user._id })

  return { email, created: false }
}
