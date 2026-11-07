'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AdminShell } from '../components/AdminShell'
import { ErrorLine, KpiCard, LoadingLine, RangePicker } from '../components/AdminWidgets'
import { useAdminData } from '../hooks/useAdminData'
import {
  fetchCosts,
  fmtDay,
  fmtNum,
  fmtPct,
  fmtTokens,
  fmtUsd,
  type AdminRange,
} from '../lib/adminApi'

function Panel({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section className="yp-panel yp-admin-panel">
      <div className="yp-panel-head">
        <h2>{title}</h2>
        {meta ? <span className="yp-panel-meta">{meta}</span> : null}
      </div>
      <div className="yp-admin-table-wrap">{children}</div>
    </section>
  )
}

export function AdminCostsPage() {
  const [range, setRange] = useState<AdminRange>('7d')
  const { data, loading, error, reload } = useAdminData(
    () => fetchCosts(range),
    range,
    'Could not load costs',
  )

  const pm = data?.projectedMonthly

  return (
    <AdminShell title="Costs" actions={<RangePicker value={range} onChange={setRange} />}>
      {loading && !data ? <LoadingLine>Loading costs...</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {data && pm ? (
        <div className={`yp-admin-stack ${loading ? 'yp-admin-refreshing' : ''}`}>
          <section className="yp-kpi-grid" aria-label="Cost summary">
            <KpiCard label="Spend in range" value={data.totals.costLabel} hint={`${data.days} day window`} />
            <KpiCard label="Gemini calls" value={fmtNum(data.totals.calls)} hint="In range" />
            <KpiCard label="Paying users" value={fmtNum(data.totals.activeUsers)} hint="With spend" />
            <KpiCard label="Month to date" value={pm.mtdLabel} hint={`${fmtUsd(pm.dailyRunRateUsd)} / day`} />
            <KpiCard
              label="Projected month"
              value={pm.projectedLabel}
              hint={
                pm.monthlyBudgetUsd > 0
                  ? `Budget ${fmtUsd(pm.monthlyBudgetUsd)}`
                  : 'No monthly budget set'
              }
            />
          </section>

          {pm.monthlyBudgetUsd > 0 ? (
            <section className={`yp-panel yp-budget ${pm.projectedOverBudget ? 'is-over' : ''}`}>
              <div className="yp-panel-head">
                <h2>Monthly budget</h2>
                <span className="yp-panel-meta">
                  {pm.budgetUsedPct}% used · day {fmtNum(pm.daysElapsed, 1)} of {pm.daysInMonth}
                </span>
              </div>
              <div
                className="yp-admin-bar"
                aria-hidden
                style={{ ['--pct' as string]: `${Math.min(100, pm.budgetUsedPct)}%` }}
              />
              <p className="yp-admin-note">
                {pm.projectedOverBudget
                  ? `At the current run rate this month is projected to reach ${pm.projectedLabel}, over the ${fmtUsd(
                      pm.monthlyBudgetUsd,
                    )} budget.`
                  : `Projected ${pm.projectedLabel} against a ${fmtUsd(pm.monthlyBudgetUsd)} budget.`}
              </p>
            </section>
          ) : null}

          <div className="yp-grid yp-admin-grid">
            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Per-user percentiles</h2>
                <span className="yp-panel-meta">{fmtNum(data.percentiles.users)} users with spend</span>
              </div>
              <ul className="yp-admin-kinds">
                <li>
                  <strong>Average</strong>
                  <span>{fmtUsd(data.percentiles.avg)}</span>
                </li>
                <li>
                  <strong>Median (p50)</strong>
                  <span>{fmtUsd(data.percentiles.median)}</span>
                </li>
                <li>
                  <strong>p90</strong>
                  <span>{fmtUsd(data.percentiles.p90)}</span>
                </li>
                <li>
                  <strong>p99</strong>
                  <span>{fmtUsd(data.percentiles.p99)}</span>
                </li>
              </ul>
            </section>

            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Spend concentration</h2>
                <span className="yp-panel-meta">Share of total in range</span>
              </div>
              <ul className="yp-admin-kinds">
                <li>
                  <strong>Top user</strong>
                  <span>{fmtUsd(data.concentration.top1Usd)}</span>
                  <span>{fmtPct(data.concentration.top1Share)} of spend</span>
                </li>
                <li>
                  <strong>Top 10 users</strong>
                  <span>{fmtUsd(data.concentration.top10Usd)}</span>
                  <span>{fmtPct(data.concentration.top10Share)} of spend</span>
                </li>
              </ul>
            </section>
          </div>

          <Panel title="By day" meta={`${data.byDay.length} days`}>
            <table className="yp-admin-table yp-admin-table-compact">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Cost</th>
                  <th>Share</th>
                  <th>Calls</th>
                  <th>Tokens (in / out)</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.byDay.map((d) => (
                  <tr key={d.day}>
                    <td>{fmtDay(d.day)}</td>
                    <td className="yp-admin-cost">{d.costLabel}</td>
                    <td>{d.sharePct}%</td>
                    <td>{fmtNum(d.calls)}</td>
                    <td>
                      {fmtTokens(d.inputTokens)} / {fmtTokens(d.outputTokens)}
                    </td>
                    <td>{fmtNum(d.errors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="By user" meta="Top 50 by spend">
            <table className="yp-admin-table yp-admin-table-compact">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Cost</th>
                  <th>Share</th>
                  <th>Calls</th>
                  <th>Tokens</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.byUser.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No spend in this range.</td>
                  </tr>
                ) : (
                  data.byUser.map((u) => (
                    <tr key={u.user.id}>
                      <td>
                        <div className="yp-admin-user">
                          <strong>
                            <Link href={`/admin/users/${u.user.id}`} className="yp-admin-link">
                              {u.user.name}
                            </Link>
                          </strong>
                          <span>{u.user.email}</span>
                        </div>
                      </td>
                      <td className="yp-admin-cost">{u.costLabel}</td>
                      <td>{u.sharePct}%</td>
                      <td>{fmtNum(u.calls)}</td>
                      <td>{fmtTokens(u.totalTokens)}</td>
                      <td>{fmtNum(u.errors)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Panel>

          <Panel title="By lesson" meta="Cost per lesson and per session">
            <table className="yp-admin-table yp-admin-table-compact">
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Cost</th>
                  <th>Per session</th>
                  <th>Sessions</th>
                  <th>Users</th>
                  <th>Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.byLesson.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No lesson spend in this range.</td>
                  </tr>
                ) : (
                  data.byLesson.map((l) => (
                    <tr key={l.lessonId}>
                      <td>
                        {l.lessonNumber != null ? `L${l.lessonNumber}. ` : ''}
                        {l.title}
                      </td>
                      <td className="yp-admin-cost">{l.costLabel}</td>
                      <td className="yp-admin-cost">{fmtUsd(l.costPerSession)}</td>
                      <td>{fmtNum(l.sessions)}</td>
                      <td>{fmtNum(l.users)}</td>
                      <td>{fmtNum(l.calls)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Panel>

          <div className="yp-grid yp-admin-grid">
            <Panel title="By call type">
              <table className="yp-admin-table yp-admin-table-compact">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Cost</th>
                    <th>Share</th>
                    <th>Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCallType.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No calls in this range.</td>
                    </tr>
                  ) : (
                    data.byCallType.map((c) => (
                      <tr key={c.callType}>
                        <td>{c.callType}</td>
                        <td className="yp-admin-cost">{c.costLabel}</td>
                        <td>{c.sharePct}%</td>
                        <td>{fmtNum(c.calls)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="By model">
              <table className="yp-admin-table yp-admin-table-compact">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Cost</th>
                    <th>Share</th>
                    <th>Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byModel.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No calls in this range.</td>
                    </tr>
                  ) : (
                    data.byModel.map((m) => (
                      <tr key={m.model}>
                        <td>
                          <code>{m.model}</code>
                        </td>
                        <td className="yp-admin-cost">{m.costLabel}</td>
                        <td>{m.sharePct}%</td>
                        <td>{fmtNum(m.calls)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel title="Most expensive sessions" meta="Top 50">
            <table className="yp-admin-table yp-admin-table-compact">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>User</th>
                  <th>Lesson</th>
                  <th>Cost</th>
                  <th>Minutes</th>
                  <th>Calls</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.bySession.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No session spend in this range.</td>
                  </tr>
                ) : (
                  data.bySession.map((s) => (
                    <tr key={s.sessionId}>
                      <td>{s.startedAt ? new Date(s.startedAt).toLocaleString() : '-'}</td>
                      <td>
                        {s.user ? (
                          <Link href={`/admin/users/${s.user.id}`} className="yp-admin-link">
                            {s.user.name}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{s.lessonTitle || s.lessonId || '-'}</td>
                      <td className="yp-admin-cost">{s.costLabel}</td>
                      <td>{fmtNum(s.minutes, 1)}</td>
                      <td>{fmtNum(s.calls)}</td>
                      <td>
                        <Link href={`/admin/sessions/${s.sessionId}`} className="yp-admin-link">
                          Replay
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Panel>
        </div>
      ) : null}
    </AdminShell>
  )
}
