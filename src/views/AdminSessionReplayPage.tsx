'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AdminShell } from '../components/AdminShell'
import { BarList, ErrorLine, LoadingLine, StatusBadge } from '../components/AdminWidgets'
import { useAdminData } from '../hooks/useAdminData'
import {
  fetchSession,
  fmtLatency,
  fmtNum,
  fmtTokens,
  fmtWhen,
} from '../lib/adminApi'

function roleLabel(role: string) {
  if (role === 'user') return 'Learner'
  if (role === 'model' || role === 'assistant' || role === 'lucy') return 'Yappy'
  return role || 'Message'
}

function isLearner(role: string) {
  return role === 'user'
}

function mistakeText(m: unknown): string {
  if (typeof m === 'string') return m
  if (m && typeof m === 'object') {
    const o = m as Record<string, unknown>
    const parts = [o.mistake, o.wrong, o.original, o.correction, o.right, o.text, o.note]
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
    if (parts.length) return parts.join(' -> ')
    return JSON.stringify(m)
  }
  return String(m)
}

export function AdminSessionReplayPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const { data, loading, error, reload } = useAdminData(
    () => fetchSession(id),
    id,
    'Could not load session',
  )

  const s = data?.session
  const user = data?.user
  const scores = s?.scores ? Object.entries(s.scores) : []

  return (
    <AdminShell
      title={s ? `Session: L${s.lessonNumber}. ${s.lessonTitle}` : 'Session replay'}
      actions={
        user ? (
          <Link href={`/admin/users/${user.id}`} className="yp-btn yp-btn-soft">
            View user
          </Link>
        ) : (
          <Link href="/admin/users" className="yp-btn yp-btn-soft">
            All users
          </Link>
        )
      }
    >
      {loading && !data ? <LoadingLine>Loading session...</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {data && s ? (
        <>
          <section className="yp-panel">
            <div className="yp-panel-head">
              <h2>Summary</h2>
              {s.isTest ? <span className="yp-admin-badge">Test session</span> : null}
            </div>
            <dl className="yp-admin-dl">
              {user ? (
                <div>
                  <dt>Learner</dt>
                  <dd>
                    <Link href={`/admin/users/${user.id}`} className="yp-admin-link">
                      {user.name}
                    </Link>{' '}
                    <StatusBadge status={user.effectiveStatus} />
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Started</dt>
                <dd>{fmtWhen(s.startedAt)}</dd>
              </div>
              <div>
                <dt>Ended</dt>
                <dd>{fmtWhen(s.endedAt)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{fmtNum(s.minutes, 1)} min</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{s.completed ? 'Completed' : s.status}</dd>
              </div>
              <div>
                <dt>End reason</dt>
                <dd>{s.endReason || '-'}</dd>
              </div>
              <div>
                <dt>Turns</dt>
                <dd>
                  {s.turnCount} · {s.corrections} corrections · {s.practiceSuccesses} practice wins
                </dd>
              </div>
              <div>
                <dt>Best streak</dt>
                <dd>{s.maxStreak}</dd>
              </div>
              <div>
                <dt>Overall score</dt>
                <dd>{s.overall != null ? Math.round(s.overall) : '-'}</dd>
              </div>
              <div>
                <dt>Total cost</dt>
                <dd>{s.costLabel}</dd>
              </div>
              <div>
                <dt>Tokens (in / out)</dt>
                <dd>
                  {fmtTokens(s.totalInputTokens)} / {fmtTokens(s.totalOutputTokens)}
                </dd>
              </div>
              {s.promptVersion ? (
                <div>
                  <dt>Prompt version</dt>
                  <dd>{s.promptVersion}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {scores.length > 0 || s.topMistakes.length > 0 ? (
            <div className="yp-grid yp-admin-grid">
              <section className="yp-panel">
                <div className="yp-panel-head">
                  <h2>Scores</h2>
                  <span className="yp-panel-meta">Out of 100</span>
                </div>
                {scores.length === 0 ? (
                  <p className="yp-empty">No scores recorded.</p>
                ) : (
                  <BarList
                    items={scores.map(([k, v]) => ({
                      key: k,
                      label: k,
                      value: Number(v) || 0,
                      display: String(Math.round(Number(v) || 0)),
                    }))}
                  />
                )}
              </section>
              <section className="yp-panel">
                <div className="yp-panel-head">
                  <h2>Top mistakes</h2>
                </div>
                {s.topMistakes.length === 0 ? (
                  <p className="yp-empty">None recorded.</p>
                ) : (
                  <ul className="yp-admin-list">
                    {s.topMistakes.map((m, i) => (
                      <li key={i}>{mistakeText(m)}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          <section className="yp-panel">
            <div className="yp-panel-head">
              <h2>Transcript</h2>
              <span className="yp-panel-meta">
                {data.turns.length} turn{data.turns.length === 1 ? '' : 's'} · {data.events.length}{' '}
                Gemini call{data.events.length === 1 ? '' : 's'}
              </span>
            </div>

            {data.turns.length === 0 ? (
              <p className="yp-empty">
                No transcript stored for this session. It may have been deleted with the account.
              </p>
            ) : (
              <ol className="yp-transcript">
                {data.turns.map((t) => (
                  <li key={t.turnIndex} className="yp-transcript-turn">
                    <div className="yp-transcript-turnhead">
                      <span>Turn {t.turnIndex}</span>
                    </div>

                    {t.messages.map((m, i) => (
                      <div
                        key={i}
                        className={`yp-bubble ${isLearner(m.role) ? 'is-user' : 'is-model'} ${
                          m.correction ? 'is-correction' : ''
                        }`}
                      >
                        <span className="yp-bubble-role">
                          {roleLabel(m.role)}
                          {m.correction ? ' · correction' : ''}
                          {m.practiceAttempts > 0
                            ? ` · ${m.practiceAttempts} practice attempt${m.practiceAttempts === 1 ? '' : 's'}`
                            : ''}
                        </span>
                        <p>{m.text}</p>
                        {m.at ? <span className="yp-bubble-time">{fmtWhen(m.at)}</span> : null}
                      </div>
                    ))}

                    {t.events.length > 0 ? (
                      <div className="yp-turn-cost">
                        <span>
                          <strong>{t.costLabel}</strong> cost
                        </span>
                        <span>
                          {fmtTokens(t.inputTokens)} in / {fmtTokens(t.outputTokens)} out
                        </span>
                        <span>{fmtLatency(t.latencyMs)} slowest</span>
                        <span>
                          {t.events.length} call{t.events.length === 1 ? '' : 's'}
                          {t.events.some((e) => e.status !== 'ok' && e.status !== 'success')
                            ? ` · ${t.events.filter((e) => e.status !== 'ok' && e.status !== 'success').length} not ok`
                            : ''}
                        </span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {data.events.length > 0 ? (
            <section className="yp-panel yp-admin-panel">
              <div className="yp-panel-head">
                <h2>Gemini calls</h2>
                <span className="yp-panel-meta">Per-call tokens and cost</span>
              </div>
              <div className="yp-admin-table-wrap">
                <table className="yp-admin-table yp-admin-table-compact">
                  <thead>
                    <tr>
                      <th>Turn</th>
                      <th>Type</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Think</th>
                      <th>Latency</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => (
                      <tr key={e.id}>
                        <td>{e.turnIndex}</td>
                        <td>{e.callType}</td>
                        <td>
                          <code>{e.model}</code>
                        </td>
                        <td>
                          {e.status}
                          {e.errorCode ? <span className="yp-admin-meta">{e.errorCode}</span> : null}
                        </td>
                        <td>{fmtTokens(e.inputTokens)}</td>
                        <td>{fmtTokens(e.outputTokens)}</td>
                        <td>{fmtTokens(e.thinkingTokens)}</td>
                        <td>{fmtLatency(e.latencyMs)}</td>
                        <td className="yp-admin-cost">{e.costLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  )
}
