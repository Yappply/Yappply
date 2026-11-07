'use client'

type PracticeLimitModalProps = {
  open: boolean
  title?: string
  message: string
  unlocksAt?: string | null
  onClose: () => void
}

function formatUnlockTime(unlocksAt?: string | null) {
  if (!unlocksAt) return null
  const d = new Date(unlocksAt)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function PracticeLimitModal({
  open,
  title = 'Come back tomorrow',
  message,
  unlocksAt,
  onClose,
}: PracticeLimitModalProps) {
  if (!open) return null
  const when = formatUnlockTime(unlocksAt)

  return (
    <div className="yp-limit-overlay" role="presentation" onClick={onClose}>
      <div
        className="yp-limit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="yp-limit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="yp-tag lime">Daily practice</span>
        <h2 id="yp-limit-title">{title}</h2>
        <p>{message}</p>
        {when ? (
          <p className="yp-limit-when">
            Unlocks when your day changes · <strong>{when}</strong>
          </p>
        ) : (
          <p className="yp-limit-when">The next lecture unlocks when your local day changes.</p>
        )}
        <button type="button" className="yp-btn yp-btn-main" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}

export function limitModalCopy(code?: string): { title: string; message: string } {
  switch (code) {
    case 'lesson_locked_until_tomorrow':
      return {
        title: 'Next lecture unlocks tomorrow',
        message:
          'You finished today’s lesson. The next lecture unlocks when the day changes in your local time — come back then to continue.',
      }
    case 'lesson_locked':
      return {
        title: 'This lecture is locked',
        message:
          'Only one lesson is open at a time. Complete the current lecture (full 30 minutes). The next one unlocks when your local day changes.',
      }
    case 'sessions_day':
    case 'minutes_day':
    case 'limited_sessions':
      return {
        title: 'You’ve practiced today',
        message:
          'You can take only one practice session per day. Come back when the day changes to practice again or unlock the next lecture.',
      }
    default:
      return {
        title: 'Come back tomorrow',
        message:
          'Practice opens again when your local day changes. The next lecture unlocks then as well.',
      }
  }
}
