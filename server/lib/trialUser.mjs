const TRIAL_EMAIL = 'trial@yappply.com'

export function isTrialUser(user) {
  if (!user) return false
  if (user.trial) return true
  return String(user.email || '').trim().toLowerCase() === TRIAL_EMAIL
}
