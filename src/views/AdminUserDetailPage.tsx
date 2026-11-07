'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AdminShell } from '../components/AdminShell'
import { ErrorLine, LoadingLine, StatusBadge } from '../components/AdminWidgets'
import { useAdminData } from '../hooks/useAdminData'
import {
  errMessage,
  fetchUser,
  fmtDuration,
  fmtNum,
  fmtTokens,
  fmtWhen,
  postUserAction,
  type AdminLessonStat,
  type AdminUsageSummary,
  type UserActionName,
  type UserActionPayload,
} from '../lib/adminApi'

interface ActionDef {
  action: UserActionName
  label: string
  description: string
  needsReason: boolean
  danger?: boolean
  confirmLabel: string
}

const ACTIONS: ActionDef[] = [
  {
    action: 'limit',
    label: 'Limit',
    description: 'Mark the account as limited. Optionally set an end date.',
    needsReason: true,
    confirmLabel: 'Apply limit',
  },
  {
    action: 'suspend',
    label: 'Suspend',
    description: 'Temporarily block access and sign the user out. A duration is required.',
    needsReason: true,
    confirmLabel: 'Suspend user',
  },
  {
    action: 'ban',
    label: 'Ban',
    description: 'Permanently block access and sign the user out.',
    needsReason: true,
    danger: true,
    confirmLabel: 'Ban user',
  },
  {
    action: 'reactivate',
    label: 'Allow access',
    description:
      'Return the account to active status. If the 30-day plan has ended, this also renews it for another 30 days so the user can log in again.',
    needsReason: false,
    confirmLabel: 'Allow access',
  },
  {
    action: 'renew_plan',
    label: 'Renew plan',
    description: 'Extend the subscription by 30 days from today and clear any plan-expired flag.',
    needsReason: false,
    confirmLabel: 'Renew 30 days',
  },
  {
    action: 'force_logout',
    label: 'Force logout',
    description: 'Invalidate all current sessions. The user can log in again.',
    needsReason: false,
    confirmLabel: 'Force logout',
  },
  {
    action: 'reset_progress',
    label: 'Reset progress',
    description: 'Clears lessons, streaks and practice counters. Usage and cost history is kept.',
    needsReason: true,
    danger: true,
    confirmLabel: 'Reset progress',
  },
  {
    action: 'delete',
    label: 'Delete',
    description:
      'Anonymises the account, wipes transcripts and progress and bans login. Cost history is kept for accounting. This cannot be undone.',
    needsReason: true,
    danger: true,
    confirmLabel: 'Delete user',
  },
]

function UsageBlock({ title, usage }: { title: string; usage: AdminUsageSummary }) {
  return (
    <div className="yp-admin-usage-card">
      <span className="yp-kpi-label">{title}</span>
      <strong className="yp-kpi-value">{usage.costLabel}</strong>
      <span className="yp-admin-meta">
        {fmtNum(usage.calls)} calls · {fmtTokens(usage.totalTokens)} tokens
      </span>
      <span className="yp-admin-meta">
        {fmtNum(usage.sessions)} sessions · {fmtNum(usage.minutes, 1)} min · {usage.activeDays}{' '}
        active day{usage.activeDays === 1 ? '' : 's'}
      </span>
      {usage.errors > 0 ? (
        <span className="yp-admin-meta">{fmtNum(usage.errors)} errors</span>
      ) : null}
    </div>
  )
}

function LessonGrid({
  stats,
  total,
}: {
  stats: AdminLessonStat[]
  total: number
}) {
  const byNumber = new Map(stats.map((s) => [s.lessonNumber, s]))
  const cells = Array.from({ length: total }, (_, i) => i + 1)
  return (
    <div className="yp-lesson-grid" role="list">
      {cells.map((n) => {
        const s = byNumber.get(n)
        const state = s ? (s.completed ? 'is-done' : 'is-progress') : 'is-none'
        const title = s
          ? `L${n}. ${s.title} - ${s.completed ? 'Completed' : 'In progress'}, ${s.attempts} attempt${
              s.attempts === 1 ? '' : 's'
            }, ${fmtDuration(s.totalDurationMs)}${
              s.bestOverall != null ? `, best ${Math.round(s.bestOverall)}` : ''
            }`
          : `Lesson ${n} - not started`
        return (
          <div key={n} className={`yp-lesson-cell ${state}`} role="listitem" title={title}>
            <strong>{n}</strong>
            {s ? (
              <span>{s.bestOverall != null ? Math.round(s.bestOverall) : `${s.attempts}x`}</span>
            ) : (
              <span>-</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function AdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const { data, loading, error, reload } = useAdminData(
    () => fetchUser(id),
    id,
    'Could not load user',
  )

  const [active, setActive] = useState<ActionDef | null>(null)
  const [reason, setReason] = useState('')
  const [days, setDays] = useState('7')
  const [until, setUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionOk, setActionOk] = useState('')

  const [notes, setNotes] = useState('')
  const [notesBusy, setNotesBusy] = useState(false)
  const [notesMsg, setNotesMsg] = useState('')

  const savedNotes = data?.adminNotes
  useEffect(() => {
    if (savedNotes !== undefined) setNotes(savedNotes)
  }, [savedNotes])

  function openAction(def: ActionDef) {
    setActive(def)
    setReason('')
    setDays('7')
    setUntil('')
    setActionError('')
    setActionOk('')
  }

  async function submitAction(e: FormEvent) {
    e.preventDefault()
    if (!active) return
    setActionError('')
    if (active.needsReason && reason.trim().length < 3) {
      setActionError('Please enter a reason (at least 3 characters).')
      return
    }

    const payload: UserActionPayload = { action: active.action, reason: reason.trim() }
    if (active.action === 'suspend') {
      const n = Number(days)
      if (!Number.isFinite(n) || n <= 0) {
        setActionError('Enter a suspension length in days.')
        return
      }
      payload.days = n
    }
    if (active.action === 'limit' && until) {
      payload.until = new Date(`${until}T23:59:59`).toISOString()
    }

    setBusy(true)
    try {
      await postUserAction(id, payload)
      setActionOk(`${active.label} applied.`)
      setActive(null)
      await reload()
    } catch (err) {
      setActionError(errMessage(err, 'Action failed'))
    } finally {
      setBusy(false)
    }
  }

  async function saveNotes() {
    setNotesBusy(true)
    setNotesMsg('')
    try {
      await postUserAction(id, { action: 'set_notes', notes })
      setNotesMsg('Notes saved.')
      await reload()
    } catch (err) {
      setNotesMsg(errMessage(err, 'Could not save notes'))
    } finally {
      setNotesBusy(false)
    }
  }

  const user = data?.user
  const status = user?.effectiveStatus
  const deleted = Boolean(user?.email?.endsWith('@anon.local'))

  // Hide actions that make no sense for the current state.
  const available = ACTIONS.filter((a) => {
    if (deleted) return false
    if (a.action === 'reactivate') return status !== 'active'
    if (a.action === 'renew_plan') return status !== 'banned'
    if (a.action === 'limit') return status !== 'limited' && status !== 'banned'
    if (a.action === 'suspend') return status !== 'suspended' && status !== 'banned'
    if (a.action === 'ban') return status !== 'banned'
    return true
  })

  return (
    <AdminShell
      title={user ? user.name : 'User'}
      actions={
        <Link href="/admin/users" className="yp-btn yp-btn-soft">
          All users
        </Link>
      }
    >
      {loading && !data ? <LoadingLine>Loading user...</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {data && user ? (
        <>
          <section className="yp-panel">
            <div className="yp-panel-head">
              <h2>Profile</h2>
              <StatusBadge status={user.effectiveStatus} />
            </div>
            <dl className="yp-admin-dl">
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Level</dt>
                <dd>{user.level}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>
                  {fmtWhen(user.createdAt)} ({user.signupSource})
                </dd>
              </div>
              <div>
                <dt>Last active</dt>
                <dd>{fmtWhen(user.lastActiveAt)}</dd>
              </div>
              <div>
                <dt>Last login</dt>
                <dd>{fmtWhen(user.lastLoginAt)}</dd>
              </div>
              <div>
                <dt>Plan ends</dt>
                <dd>{fmtWhen(user.subscriptionEndsAt)}</dd>
              </div>
              <div>
                <dt>Lifetime cost</dt>
                <dd>{user.lifetimeCostLabel}</dd>
              </div>
              <div>
                <dt>Streak</dt>
                <dd>
                  {data.progress.currentStreak} current · {data.progress.longestStreak} best
                </dd>
              </div>
              {user.statusReason ? (
                <div className="yp-admin-dl-wide">
                  <dt>Status reason</dt>
                  <dd>
                    {user.statusReason}
                    {user.statusUntil ? ` (until ${fmtWhen(user.statusUntil)})` : ''}
                  </dd>
                </div>
              ) : null}
              {user.hasLimitsOverride ? (
                <div className="yp-admin-dl-wide">
                  <dt>Custom limits</dt>
                  <dd>
                    {Object.entries(user.limitsOverride)
                      .filter(([, v]) => typeof v === 'number')
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="yp-panel">
            <div className="yp-panel-head">
              <h2>Account actions</h2>
              <span className="yp-panel-meta">Logged to the audit trail</span>
            </div>

            {deleted ? (
              <p className="yp-empty">This account has been deleted.</p>
            ) : (
              <div className="yp-admin-actions">
                {available.map((a) => (
                  <button
                    key={a.action}
                    type="button"
                    className={`yp-btn ${a.danger ? 'yp-btn-danger' : 'yp-btn-soft'} ${
                      active?.action === a.action ? 'is-selected' : ''
                    }`}
                    onClick={() => openAction(a)}
                    disabled={busy}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {actionOk && !active ? <p className="yp-admin-create-ok">{actionOk}</p> : null}

            {active ? (
              <form
                className={`yp-admin-confirm ${active.danger ? 'is-danger' : ''}`}
                onSubmit={submitAction}
              >
                <h3>{active.label}</h3>
                <p className="yp-admin-note">{active.description}</p>

                {active.action === 'suspend' ? (
                  <label className="yp-field">
                    <span>Suspend for (days)</span>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                    />
                  </label>
                ) : null}

                {active.action === 'limit' ? (
                  <label className="yp-field">
                    <span>Limited until (optional)</span>
                    <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                  </label>
                ) : null}

                <label className="yp-field">
                  <span>Reason{active.needsReason ? '' : ' (optional)'}</span>
                  <textarea
                    className="yp-admin-textarea"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why are you doing this?"
                    autoFocus
                  />
                </label>

                {actionError ? <p className="yp-status error">{actionError}</p> : null}

                <div className="yp-admin-confirm-actions">
                  <button
                    type="submit"
                    className={`yp-btn ${active.danger ? 'yp-btn-danger-solid' : 'yp-btn-main'}`}
                    disabled={busy}
                  >
                    {busy ? 'Working...' : active.confirmLabel}
                  </button>
                  <button
                    type="button"
                    className="yp-btn yp-btn-ghost"
                    onClick={() => setActive(null)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="yp-panel">
            <div className="yp-panel-head">
              <h2>Usage</h2>
              <span className="yp-panel-meta">Gemini spend and activity</span>
            </div>
            <div className="yp-admin-usage-grid">
              <div className="yp-admin-usage-card">
                <span className="yp-kpi-label">Lifetime</span>
                <strong className="yp-kpi-value">{data.usage.lifetime.costLabel}</strong>
                <span className="yp-admin-meta">
                  {fmtNum(data.usage.lifetime.calls)} calls ·{' '}
                  {fmtTokens(data.usage.lifetime.totalTokens)} tokens
                </span>
                <span className="yp-admin-meta">
                  {fmtNum(data.usage.lifetime.sessions)} sessions ·{' '}
                  {fmtNum(data.usage.lifetime.minutes, 1)} min
                </span>
                {data.usage.lifetime.errors > 0 ? (
                  <span className="yp-admin-meta">{fmtNum(data.usage.lifetime.errors)} errors</span>
                ) : null}
              </div>
              <UsageBlock title="Last 7 days" usage={data.usage.last7d} />
              <UsageBlock title="Last 30 days" usage={data.usage.last30d} />
            </div>

            {data.usage.byCallType.length > 0 ? (
              <div className="yp-admin-table-wrap">
                <table className="yp-admin-table yp-admin-table-compact">
                  <thead>
                    <tr>
                      <th>Call type</th>
                      <th>Cost</th>
                      <th>Share</th>
                      <th>Calls</th>
                      <th>Tokens</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.usage.byCallType.map((c) => (
                      <tr key={c.callType}>
                        <td>{c.callType}</td>
                        <td className="yp-admin-cost">{c.costLabel}</td>
                        <td>{c.sharePct}%</td>
                        <td>{fmtNum(c.calls)}</td>
                        <td>{fmtTokens(c.totalTokens)}</td>
                        <td>{fmtNum(c.errors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="yp-panel">
            <div className="yp-panel-head">
              <h2>Lesson progress</h2>
              <span className="yp-panel-meta">
                {data.progress.lessonsCompleted}/{data.progress.lessonsTotal} complete ·{' '}
                {fmtDuration(data.progress.totalPracticeMs)} practice
              </span>
            </div>
            <LessonGrid stats={data.lessonStats} total={data.progress.lessonsTotal} />
            <p className="yp-lesson-legend">
              <span className="yp-lesson-key is-done" /> Completed
              <span className="yp-lesson-key is-progress" /> In progress
              <span className="yp-lesson-key is-none" /> Not started
              <span className="yp-admin-meta">Cell number is the lesson; value is best score or attempts.</span>
            </p>
          </section>

          <section className="yp-panel yp-admin-panel">
            <div className="yp-panel-head">
              <h2>Recent sessions</h2>
              <span className="yp-panel-meta">Latest {data.recentSessions.length}</span>
            </div>
            <div className="yp-admin-table-wrap">
              <table className="yp-admin-table yp-admin-table-compact">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Lesson</th>
                    <th>Result</th>
                    <th>Duration</th>
                    <th>Turns</th>
                    <th>Score</th>
                    <th>Cost</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.recentSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No sessions yet.</td>
                    </tr>
                  ) : (
                    data.recentSessions.map((s) => (
                      <tr key={s.id}>
                        <td>{fmtWhen(s.startedAt)}</td>
                        <td>
                          L{s.lessonNumber}. {s.lessonTitle}
                          {s.isTest ? <span className="yp-admin-badge">Test</span> : null}
                        </td>
                        <td>
                          {s.completed ? 'Completed' : s.status}
                          {s.endReason ? (
                            <span className="yp-admin-meta">{s.endReason}</span>
                          ) : null}
                        </td>
                        <td>{fmtNum(s.minutes, 1)}m</td>
                        <td>{s.turns}</td>
                        <td>{s.overall != null ? Math.round(s.overall) : '-'}</td>
                        <td className="yp-admin-cost">{s.costLabel}</td>
                        <td>
                          <Link href={`/admin/sessions/${s.id}`} className="yp-admin-link">
                            Replay
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="yp-grid yp-admin-grid">
            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Open flags</h2>
                <span className="yp-panel-meta">{data.openFlags.length} open</span>
              </div>
              {data.openFlags.length === 0 ? (
                <p className="yp-empty">No open flags for this user.</p>
              ) : (
                <ul className="yp-admin-list">
                  {data.openFlags.map((f) => (
                    <li key={f.id}>
                      <strong>{f.rule}</strong>
                      <span className="yp-admin-meta">{fmtWhen(f.createdAt)}</span>
                      {f.sessionIds.slice(0, 3).map((sid) => (
                        <Link key={sid} href={`/admin/sessions/${sid}`} className="yp-admin-link">
                          Session replay
                        </Link>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
              <p className="yp-admin-foot">
                <Link href="/admin/flags">Review all flags</Link>
              </p>
            </section>

            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Admin notes</h2>
                <span className="yp-panel-meta">Visible to admins only</span>
              </div>
              <textarea
                className="yp-admin-textarea"
                rows={5}
                maxLength={5000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this user"
                disabled={deleted}
              />
              <div className="yp-admin-confirm-actions">
                <button
                  type="button"
                  className="yp-btn yp-btn-main"
                  onClick={() => void saveNotes()}
                  disabled={notesBusy || deleted || notes === (data.adminNotes || '')}
                >
                  {notesBusy ? 'Saving...' : 'Save notes'}
                </button>
                {notesMsg ? <span className="yp-admin-meta">{notesMsg}</span> : null}
              </div>
            </section>
          </div>

          <section className="yp-panel yp-admin-panel">
            <div className="yp-panel-head">
              <h2>Audit trail</h2>
              <span className="yp-panel-meta">Recent admin actions on this user</span>
            </div>
            {data.audit.length === 0 ? (
              <p className="yp-empty">No admin actions recorded.</p>
            ) : (
              <div className="yp-admin-table-wrap">
                <table className="yp-admin-table yp-admin-table-compact">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((a) => (
                      <tr key={a.id}>
                        <td>{fmtWhen(a.createdAt)}</td>
                        <td>{a.admin?.name || '-'}</td>
                        <td>
                          <code>{a.action}</code>
                        </td>
                        <td>{a.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AdminShell>
  )
}
