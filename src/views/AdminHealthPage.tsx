'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AdminShell } from '../components/AdminShell'
import { ErrorLine, KpiCard, LoadingLine } from '../components/AdminWidgets'
import { useAdminData } from '../hooks/useAdminData'
import {
  errMessage,
  fetchHealth,
  fetchLimits,
  fmtLatency,
  fmtNum,
  fmtPct,
  fmtWhen,
  saveLimits,
} from '../lib/adminApi'

const LIMIT_FIELDS: Array<{ key: string; label: string; hint: string; step?: string }> = [
  { key: 'sessionLengthMin', label: 'Session length (min)', hint: 'Max minutes per practice session' },
  { key: 'sessionsPerDay', label: 'Sessions per day', hint: 'Per user' },
  { key: 'speakingMinutesPerDay', label: 'Speaking minutes per day', hint: 'Per user' },
  { key: 'geminiCallsPerSession', label: 'Gemini calls per session', hint: 'Hard cap per session' },
  { key: 'inputTokensPerSession', label: 'Input tokens per session', hint: 'Hard cap per session' },
  { key: 'charsPerUserTurn', label: 'Characters per user turn', hint: 'Longest accepted message' },
  { key: 'apiRequestsPerUserPerMinute', label: 'API requests per user per minute', hint: 'Rate limit' },
  { key: 'signupsPerIpPerDay', label: 'Signups per IP per day', hint: 'Abuse protection' },
  {
    key: 'dailyCostFlagMultiplier',
    label: 'Daily cost flag multiplier',
    hint: 'Flag users above this multiple of the average',
    step: 'any',
  },
  {
    key: 'autoLimitCostMultiplier',
    label: 'Auto-limit cost multiplier',
    hint: 'Auto-limit users above this multiple',
    step: 'any',
  },
  { key: 'dailyBudgetUsd', label: 'Daily budget (USD)', hint: '0 disables', step: 'any' },
  { key: 'monthlyBudgetUsd', label: 'Monthly budget (USD)', hint: '0 disables', step: 'any' },
  {
    key: 'userDailyCostAlertUsd',
    label: 'User daily cost alert (USD)',
    hint: 'Alert when one user exceeds this per day',
    step: 'any',
  },
]

function HealthDot({ ok }: { ok: boolean }) {
  return <span className={`yp-health-dot ${ok ? 'is-ok' : 'is-bad'}`} aria-hidden />
}

function LimitsEditor() {
  const { data, loading, error, reload } = useAdminData(
    fetchLimits,
    'limits',
    'Could not load limits',
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')

  const limits = data?.limits
  useEffect(() => {
    if (!limits) return
    const next: Record<string, string> = {}
    for (const f of LIMIT_FIELDS) {
      const v = limits[f.key]
      next[f.key] = v === null || v === undefined ? '' : String(v)
    }
    setValues(next)
  }, [limits])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!limits) return
    setSaveError('')
    setSaveOk('')

    const payload: Record<string, number> = {}
    for (const f of LIMIT_FIELDS) {
      const raw = values[f.key]
      if (raw === undefined || raw === '') continue
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        setSaveError(`${f.label} must be a number.`)
        return
      }
      // Only send fields that changed.
      if (Number(limits[f.key]) !== n) payload[f.key] = n
    }
    if (Object.keys(payload).length === 0) {
      setSaveOk('No changes to save.')
      return
    }

    setSaving(true)
    try {
      const result = await saveLimits(payload, reason.trim())
      const n = Object.keys(result.changed || {}).length
      setSaveOk(`Saved ${n} change${n === 1 ? '' : 's'}.`)
      setReason('')
      await reload()
    } catch (err) {
      setSaveError(errMessage(err, 'Could not save limits'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="yp-panel">
      <div className="yp-panel-head">
        <h2>Usage limits</h2>
        <span className="yp-panel-meta">
          {limits?.updatedAt ? `Updated ${fmtWhen(String(limits.updatedAt))}` : 'Global defaults'}
        </span>
      </div>

      {loading && !data ? <LoadingLine>Loading limits...</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {limits ? (
        <form className="yp-limits-form" onSubmit={onSubmit}>
          <div className="yp-limits-grid">
            {LIMIT_FIELDS.map((f) => (
              <label key={f.key} className="yp-field">
                <span>{f.label}</span>
                <input
                  type="number"
                  step={f.step || '1'}
                  min={0}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
                <small className="yp-field-hint">{f.hint}</small>
              </label>
            ))}
          </div>

          <label className="yp-field">
            <span>Reason for change (optional)</span>
            <input
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Recorded in the audit trail"
            />
          </label>

          <div className="yp-admin-confirm-actions">
            <button type="submit" className="yp-btn yp-btn-main" disabled={saving}>
              {saving ? 'Saving...' : 'Save limits'}
            </button>
            {saveOk ? <p className="yp-admin-create-ok">{saveOk}</p> : null}
            {saveError ? <p className="yp-status error">{saveError}</p> : null}
          </div>
        </form>
      ) : null}
    </section>
  )
}

export function AdminHealthPage() {
  const { data, loading, error, reload } = useAdminData(fetchHealth, 'health', 'Could not load health')

  return (
    <AdminShell
      title="Health"
      actions={
        <button
          type="button"
          className="yp-btn yp-btn-soft"
          onClick={() => void reload()}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      }
    >
      {loading && !data ? <LoadingLine>Checking system health...</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {data ? (
        <>
          <section className="yp-health-status">
            <div className="yp-health-item">
              <HealthDot ok={data.mongo.ok} />
              <div>
                <strong>Database</strong>
                <span>{data.mongo.ok ? 'Connected' : `Unavailable (state ${data.mongo.readyState})`}</span>
              </div>
            </div>
            <div className="yp-health-item">
              <HealthDot ok={data.gemini.apiKeyConfigured} />
              <div>
                <strong>Gemini API key</strong>
                <span>{data.gemini.apiKeyConfigured ? 'Configured' : 'Missing'}</span>
              </div>
            </div>
            <div className="yp-health-item">
              <HealthDot ok={data.gemini.errorRateLastHour < 0.05} />
              <div>
                <strong>Error rate</strong>
                <span>{fmtPct(data.gemini.errorRateLastHour, 2)} last hour</span>
              </div>
            </div>
            <span className="yp-admin-meta">Checked {fmtWhen(data.checkedAt)}</span>
          </section>

          <section className="yp-kpi-grid" aria-label="Health metrics">
            <KpiCard label="Gemini calls (1h)" value={fmtNum(data.gemini.callsLastHour)} hint="Last hour" />
            <KpiCard label="Errors (1h)" value={fmtNum(data.gemini.errorsLastHour)} hint="Last hour" />
            <KpiCard label="Blocked (1h)" value={fmtNum(data.gemini.blockedLastHour)} hint="Last hour" />
            <KpiCard
              label="Latency p50"
              value={fmtLatency(data.latency.p50)}
              hint={`${fmtNum(data.latency.samples)} samples`}
            />
            <KpiCard label="Latency p95" value={fmtLatency(data.latency.p95)} hint="Last hour" />
            <KpiCard label="Rate limited (1h)" value={fmtNum(data.rateLimited.lastHour)} hint="Last hour" />
            <KpiCard label="Rate limited today" value={fmtNum(data.rateLimited.today)} hint="Since 00:00 UTC" />
            <KpiCard label="Active sessions" value={fmtNum(data.sessions.active)} hint="Started in last 2h" />
            <KpiCard
              label="Sessions ended in error"
              value={fmtNum(data.sessions.endedWithErrorToday)}
              hint="Today"
            />
          </section>

          <section className="yp-panel">
            <div className="yp-panel-head">
              <h2>Top error codes</h2>
              <span className="yp-panel-meta">Last hour</span>
            </div>
            {data.gemini.topErrorCodes.length === 0 ? (
              <p className="yp-empty">No errors in the last hour.</p>
            ) : (
              <ul className="yp-admin-kinds">
                {data.gemini.topErrorCodes.map((e) => (
                  <li key={e.code}>
                    <strong>
                      <code>{e.code}</code>
                    </strong>
                    <span>{fmtNum(e.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <LimitsEditor />
    </AdminShell>
  )
}
