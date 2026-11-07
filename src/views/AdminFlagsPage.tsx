'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AdminShell } from '../components/AdminShell'
import { ErrorLine, LoadingLine, StatusBadge } from '../components/AdminWidgets'
import { useAdminData } from '../hooks/useAdminData'
import {
  errMessage,
  fetchFlags,
  fmtWhen,
  postFlagAction,
  scanFlags,
  type AdminFlag,
} from '../lib/adminApi'

function evidenceText(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function FlagCard({ flag, onDone }: { flag: AdminFlag; onDone: () => void }) {
  const [mode, setMode] = useState<'dismiss' | 'actioned' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!mode) return
    setBusy(true)
    setError('')
    try {
      await postFlagAction(flag.id, mode, note.trim())
      onDone()
    } catch (err) {
      setError(errMessage(err, 'Could not update flag'))
      setBusy(false)
    }
  }

  const evidence = Object.entries(flag.evidence || {})

  return (
    <li className="yp-flag-card">
      <div className="yp-flag-head">
        <div>
          <strong className="yp-flag-rule">{flag.rule}</strong>
          <span className="yp-admin-meta">Raised {fmtWhen(flag.createdAt)}</span>
        </div>
        {flag.user ? (
          <div className="yp-flag-user">
            <Link href={`/admin/users/${flag.user.id}`} className="yp-admin-link">
              {flag.user.name}
            </Link>
            <span className="yp-admin-meta">{flag.user.email}</span>
            {flag.user.status ? <StatusBadge status={flag.user.status} /> : null}
          </div>
        ) : (
          <Link href={`/admin/users/${flag.userId}`} className="yp-admin-link">
            View user
          </Link>
        )}
      </div>

      {evidence.length > 0 ? (
        <dl className="yp-flag-evidence">
          {evidence.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{evidenceText(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {flag.sessionIds.length > 0 ? (
        <p className="yp-flag-sessions">
          {flag.sessionIds.slice(0, 5).map((sid, i) => (
            <Link key={sid} href={`/admin/sessions/${sid}`} className="yp-admin-link">
              Session {i + 1}
            </Link>
          ))}
        </p>
      ) : null}

      {mode ? (
        <form className="yp-admin-confirm" onSubmit={submit}>
          <label className="yp-field">
            <span>{mode === 'dismiss' ? 'Dismiss note' : 'Action taken'} (optional)</span>
            <textarea
              className="yp-admin-textarea"
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'dismiss' ? 'Why is this not an issue?' : 'What did you do?'}
              autoFocus
            />
          </label>
          {error ? <p className="yp-status error">{error}</p> : null}
          <div className="yp-admin-confirm-actions">
            <button type="submit" className="yp-btn yp-btn-main" disabled={busy}>
              {busy ? 'Saving...' : mode === 'dismiss' ? 'Dismiss flag' : 'Mark actioned'}
            </button>
            <button
              type="button"
              className="yp-btn yp-btn-ghost"
              onClick={() => setMode(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="yp-admin-confirm-actions">
          <button type="button" className="yp-btn yp-btn-soft" onClick={() => setMode('dismiss')}>
            Dismiss
          </button>
          <button type="button" className="yp-btn yp-btn-soft" onClick={() => setMode('actioned')}>
            Mark actioned
          </button>
        </div>
      )}
    </li>
  )
}

export function AdminFlagsPage() {
  const { data, loading, error, reload } = useAdminData(
    () => fetchFlags('open'),
    'open',
    'Could not load flags',
  )
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')

  async function runScan() {
    setScanning(true)
    setScanMsg('')
    try {
      await scanFlags()
      setScanMsg('Scan complete.')
      await reload()
    } catch (err) {
      setScanMsg(errMessage(err, 'Scan failed'))
    } finally {
      setScanning(false)
    }
  }

  return (
    <AdminShell
      title="Flags"
      actions={
        <button
          type="button"
          className="yp-btn yp-btn-soft"
          onClick={() => void runScan()}
          disabled={scanning}
        >
          {scanning ? 'Scanning...' : 'Run abuse scan'}
        </button>
      }
    >
      {scanMsg ? <p className="yp-admin-meta">{scanMsg}</p> : null}
      {loading && !data ? <LoadingLine>Loading flags...</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {data ? (
        <section className="yp-panel">
          <div className="yp-panel-head">
            <h2>Open flags</h2>
            <span className="yp-panel-meta">{data.openCount} open</span>
          </div>
          {data.items.length === 0 ? (
            <p className="yp-empty">No open flags. Nothing needs review right now.</p>
          ) : (
            <ul className="yp-flag-list">
              {data.items.map((f) => (
                <FlagCard key={f.id} flag={f} onDone={() => void reload()} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </AdminShell>
  )
}
