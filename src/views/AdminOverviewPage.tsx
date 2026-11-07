'use client'

import { useState } from 'react'
import { AdminShell } from '../components/AdminShell'
import {
  BarList,
  ColumnChart,
  ErrorLine,
  KpiCard,
  LoadingLine,
  RangePicker,
} from '../components/AdminWidgets'
import { CreateParticipantForm } from '../components/CreateParticipantForm'
import { useAdminData } from '../hooks/useAdminData'
import {
  fetchOverview,
  fmtDay,
  fmtNum,
  fmtPct,
  fmtUsd,
  type AdminRange,
} from '../lib/adminApi'
import Link from 'next/link'

export function AdminOverviewPage() {
  const [range, setRange] = useState<AdminRange>('7d')
  const { data, loading, error, reload } = useAdminData(
    () => fetchOverview(range),
    range,
    'Could not load admin overview',
  )

  const k = data?.kpis
  const charts = data?.charts

  return (
    <AdminShell title="Overview" actions={<RangePicker value={range} onChange={setRange} />}>
      {loading && !data ? <LoadingLine>Loading overview...</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {data && k && charts ? (
        <>
          <section className="yp-admin-hero">
            <div>
              <p className="yp-admin-kicker">Yappply control</p>
              <h2>Usage, progress &amp; Gemini spend</h2>
              <p>
                {fmtNum(data.days)} day window compared with the previous {fmtNum(data.days)}{' '}
                day{data.days === 1 ? '' : 's'}.
                {' '}
                <Link href="/admin/leads" className="yp-admin-inline-link">
                  Free test takers
                </Link>
                {data.openFlags > 0 ? (
                  <>
                    {' '}
                    ·{' '}
                    <Link href="/admin/flags" className="yp-admin-inline-link">
                      {data.openFlags} open flag{data.openFlags === 1 ? '' : 's'} to review
                    </Link>
                  </>
                ) : null}
                .
              </p>
            </div>
            <div className={`yp-admin-key ${data.apiKey.configured ? 'is-ok' : 'is-bad'}`}>
              <span className="yp-admin-key-label">Gemini API key</span>
              <strong>
                {data.apiKey.configured ? data.apiKey.masked || 'Configured' : 'Not configured'}
              </strong>
              <span>
                {data.apiKey.configured
                  ? `Loaded from ${data.apiKey.source || 'env'}`
                  : 'Set GEMINI_API_KEY in .env'}
              </span>
            </div>
          </section>

          <section className="yp-kpi-grid" aria-label="Key metrics">
            <KpiCard label="Total users" value={fmtNum(k.totalUsers.value)} kpi={k.totalUsers} />
            <KpiCard label="New signups" value={fmtNum(k.newSignups.value)} kpi={k.newSignups} />
            <KpiCard label="Active users" value={fmtNum(k.dau.value)} kpi={k.dau} />
            <KpiCard label="Sessions" value={fmtNum(k.sessions.value)} kpi={k.sessions} />
            <KpiCard
              label="Minutes spoken"
              value={fmtNum(k.minutesSpoken.value, 1)}
              kpi={k.minutesSpoken}
            />
            <KpiCard
              label="Lessons completed"
              value={fmtNum(k.lessonsCompleted.value)}
              kpi={k.lessonsCompleted}
            />
            <KpiCard
              label="Gemini cost"
              value={data.labels.geminiCost}
              kpi={k.geminiCost}
              invertDelta
            />
            <KpiCard
              label="Cost / active user"
              value={data.labels.costPerActiveUser}
              kpi={k.costPerActiveUser}
              invertDelta
            />
            <KpiCard
              label="Cost / completed lesson"
              value={data.labels.costPerCompletedLesson}
              kpi={k.costPerCompletedLesson}
              invertDelta
            />
            <KpiCard
              label="Error rate"
              value={fmtPct(k.errorRate.value, 2)}
              kpi={k.errorRate}
              invertDelta
            />
            <KpiCard
              label="Flagged users"
              value={fmtNum(k.flaggedUsers.value)}
              hint="Open flags"
            />
          </section>

          <div className="yp-grid yp-admin-grid">
            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Daily cost</h2>
                <span className="yp-panel-meta">{data.labels.geminiCost} total</span>
              </div>
              <ColumnChart
                items={charts.dailyCost.map((d) => ({
                  key: d.day,
                  label: fmtDay(d.day),
                  value: Number(d.total) || 0,
                  title: `${fmtDay(d.day)}: ${fmtUsd(Number(d.total))}`,
                }))}
              />
            </section>

            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Daily active users</h2>
                <span className="yp-panel-meta">Practising users per day</span>
              </div>
              <ColumnChart
                items={charts.dailyActive.map((d) => ({
                  key: d.day,
                  label: fmtDay(d.day),
                  value: d.users,
                  title: `${fmtDay(d.day)}: ${d.users} active, ${d.signups} signups`,
                }))}
              />
            </section>
          </div>

          <div className="yp-grid yp-admin-grid">
            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Top expensive users</h2>
                <span className="yp-panel-meta">This period</span>
              </div>
              <BarList
                empty="No Gemini spend in this period."
                items={charts.topExpensiveUsers.map((row) => ({
                  key: row.user.id,
                  label: row.user.name,
                  value: row.costUsd,
                  display: row.costLabel,
                  href: `/admin/users/${row.user.id}`,
                  sub: `${row.user.email} · ${fmtNum(row.calls)} calls · ${row.sharePct}% of spend`,
                }))}
              />
            </section>

            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Session length</h2>
                <span className="yp-panel-meta">Sessions by duration</span>
              </div>
              <BarList
                empty="No sessions in this period."
                items={charts.sessionLengthBuckets.map((b) => ({
                  key: b.label,
                  label: b.label,
                  value: b.count,
                  display: fmtNum(b.count),
                }))}
              />
            </section>
          </div>

          <div className="yp-grid yp-admin-grid">
            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Cost by call type</h2>
                <span className="yp-panel-meta">Daily breakdown</span>
              </div>
              {charts.dailyCostCallTypes.length === 0 ? (
                <p className="yp-empty">No Gemini calls in this period.</p>
              ) : (
                <div className="yp-admin-table-wrap">
                  <table className="yp-admin-table yp-admin-table-compact">
                    <thead>
                      <tr>
                        <th>Day</th>
                        {charts.dailyCostCallTypes.map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charts.dailyCost.map((d) => (
                        <tr key={d.day}>
                          <td>{fmtDay(d.day)}</td>
                          {charts.dailyCostCallTypes.map((t) => (
                            <td key={t} className="yp-admin-cost">
                              {fmtUsd(Number(d[t]))}
                            </td>
                          ))}
                          <td className="yp-admin-cost">
                            <strong>{fmtUsd(Number(d.total))}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="yp-panel">
              <div className="yp-panel-head">
                <h2>Streaks</h2>
                <span className="yp-panel-meta">Users on a current streak</span>
              </div>
              <BarList
                items={charts.streakCounts.map((s) => ({
                  key: String(s.days),
                  label: s.label,
                  value: s.users,
                  display: fmtNum(s.users),
                }))}
              />
            </section>
          </div>

        </>
      ) : null}

      <section className="yp-panel yp-admin-create">
        <div className="yp-panel-head">
          <h2>Create participant</h2>
          <span className="yp-panel-meta">New learner accounts for Yappply</span>
        </div>
        <CreateParticipantForm onCreated={() => void reload()} />
      </section>
    </AdminShell>
  )
}
