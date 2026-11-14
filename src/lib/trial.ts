const TRIAL_EMAIL = 'trial@yappply.com'

export function isTrialAccount(user?: { trial?: boolean; email?: string } | null) {
  if (!user) return false
  if (user.trial) return true
  return user.email?.trim().toLowerCase() === TRIAL_EMAIL
}
