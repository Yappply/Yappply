/**
 * Calendar-day helpers in the learner's IANA timezone
 * (e.g. Asia/Karachi, America/New_York). Day changes at local midnight.
 */

const TZ_RE = /^[A-Za-z0-9_+\-/]{2,64}$/

export function normalizeTimeZone(raw, fallback = 'UTC') {
  const tz = String(raw || '').trim()
  if (!tz || !TZ_RE.test(tz)) return fallback
  try {
    // Throws RangeError for invalid IANA zones
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return tz
  } catch {
    return fallback
  }
}

function zonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = {}
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** YYYY-MM-DD in the given timezone. */
export function zonedDateString(date = new Date(), timeZone = 'UTC') {
  const tz = normalizeTimeZone(timeZone)
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Instant of local 00:00:00 on the calendar day of `date` in `timeZone`. */
export function startOfZonedDay(date = new Date(), timeZone = 'UTC') {
  const tz = normalizeTimeZone(timeZone)
  const p = zonedParts(date, tz)
  let utc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0)
  for (let i = 0; i < 4; i++) {
    const local = zonedParts(new Date(utc), tz)
    const asUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    )
    const desired = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0)
    const delta = desired - asUtc
    if (delta === 0) break
    utc += delta
  }
  return new Date(utc)
}

/** Instant of the next local midnight after `date` in `timeZone`. */
export function nextZonedMidnight(date = new Date(), timeZone = 'UTC') {
  const start = startOfZonedDay(date, timeZone)
  const intoTomorrow = new Date(start.getTime() + 36 * 60 * 60 * 1000)
  return startOfZonedDay(intoTomorrow, timeZone)
}

/**
 * Resolve timezone from request header, then user profile, then UTC.
 * Optionally persist a new valid header value onto the user doc.
 */
export function resolveRequestTimeZone(req, { persist = false } = {}) {
  const headerTz = normalizeTimeZone(
    req?.headers?.['x-client-timezone'] || req?.headers?.['X-Client-Timezone'],
    '',
  )
  const userTz = normalizeTimeZone(req?.user?.timezone, '')
  const tz = headerTz || userTz || 'UTC'

  if (persist && headerTz && req?.user && req.user.timezone !== headerTz) {
    req.user.timezone = headerTz
    // Fire-and-forget; callers that need guaranteed save can await themselves
    void req.user.save?.().catch(() => {})
  }

  return tz
}
