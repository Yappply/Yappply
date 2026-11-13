'use client'

import { Fragment, useState, type FormEvent } from 'react'
import { AdminShell } from '../components/AdminShell'
import { ErrorLine, LoadingLine } from '../components/AdminWidgets'
import { useAdminData } from '../hooks/useAdminData'
import { fetchFreeTestLeads, fmtWhen, type FreeTestLeadRow } from '../lib/adminApi'

type ReportShape = {
  overall?: number | null
  level?: string
  strength?: string
  fixFirst?: string
  fillers?: string[]
  paceWpm?: number | null
  answered?: boolean
  answeredNote?: string
  structure?: { point?: boolean; reason?: boolean; example?: boolean; ending?: boolean }
  structureNote?: string
  grammarFixes?: Array<{ heard?: string; better?: string }>
  strongerWords?: Array<{ weak?: string; stronger?: string }>
  rewritten?: string
  watchTip?: string
  pitch?: string
  transcript?: string
}

function LeadDetail({ lead }: { lead: FreeTestLeadRow }) {
  const report = (lead.report || null) as ReportShape | null
  const structure = report?.structure || {}
  const grammar = Array.isArray(report?.grammarFixes) ? report.grammarFixes : []
  const swaps = Array.isArray(report?.strongerWords) ? report.strongerWords : []
  const fillers = Array.isArray(report?.fillers) ? report.fillers.filter(Boolean) : []
  const transcript = lead.transcript?.trim() || report?.transcript?.trim() || ''
  const parts = [
    ['Point', structure.point],
    ['Reason', structure.reason],
    ['Example', structure.example],
    ['Ending', structure.ending],
  ] as const

  return (
    <div className="yp-admin-lead-detail">
      <p>
        <strong>Email:</strong> {lead.email}
      </p>
      <p>
        <strong>Topic:</strong> {lead.topic}
      </p>
      {report ? (
        <>
          <p>
            <strong>Score:</strong> {report.overall ?? '—'} · <strong>Level:</strong>{' '}
            {report.level || '—'} · <strong>Pace:</strong>{' '}
            {report.paceWpm != null ? `${report.paceWpm} wpm` : '—'} · <strong>Answered:</strong>{' '}
            {report.answered ? 'Yes' : 'No'}
          </p>
          <p>
            <strong>Strength:</strong> {report.strength || '—'}
          </p>
          <p>
            <strong>Fix first:</strong> {report.fixFirst || '—'}
          </p>
          {report.answeredNote ? (
            <p>
              <strong>Answer note:</strong> {report.answeredNote}
            </p>
          ) : null}
          <p>
            <strong>Structure:</strong>{' '}
            {parts.map(([label, ok]) => `${label} ${ok ? 'yes' : 'no'}`).join(' · ')}
          </p>
          {report.structureNote ? <p>{report.structureNote}</p> : null}
          <p>
            <strong>Fillers:</strong> {fillers.length ? fillers.join(', ') : 'None marked'}
          </p>
          <p>
            <strong>Grammar fixes:</strong>{' '}
            {grammar.length
              ? grammar.map((item) => `${item.heard} → ${item.better}`).join(' · ')
              : 'None'}
          </p>
          <p>
            <strong>Stronger words:</strong>{' '}
            {swaps.length
              ? swaps.map((item) => `${item.weak} → ${item.stronger}`).join(' · ')
              : 'None'}
          </p>
          {report.rewritten ? (
            <p>
              <strong>Rewritten:</strong> {report.rewritten}
            </p>
          ) : null}
          {report.watchTip ? (
            <p>
              <strong>Watch next:</strong> {report.watchTip}
            </p>
          ) : null}
          {report.pitch ? (
            <p>
              <strong>Pitch:</strong> {report.pitch}
            </p>
          ) : null}
        </>
      ) : (
        <p>No detailed report was saved with this email.</p>
      )}
      <p>
        <strong>Transcript:</strong> {transcript || 'No speech captured'}
      </p>
    </div>
  )
}

export function AdminLeadsPage() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const { data, loading, error, reload } = useAdminData(
    () => fetchFreeTestLeads(q, 200),
    q,
    'Could not load free-test takers',
  )

  function onSearch(e: FormEvent) {
    e.preventDefault()
    setQ(search.trim())
  }

  return (
    <AdminShell
      title="Free test takers"
      actions={
        <button type="button" className="yp-btn yp-btn-soft" onClick={() => void reload()}>
          Refresh
        </button>
      }
    >
      <p className="yp-admin-meta" style={{ marginBottom: '1rem' }}>
        Everyone who unlocked a landing free-test report. The email and the full report are saved
        together: score, level, structure, grammar, vocabulary, transcript, and the rewrite.
      </p>

      <form className="yp-admin-filters" onSubmit={onSearch}>
        <label className="yp-field">
          <span>Search email or topic</span>
          <input
            className="yp-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name@email.com"
          />
        </label>
        <div className="yp-admin-filter-actions">
          <button type="submit" className="yp-btn yp-btn-main">
            Search
          </button>
          {q ? (
            <button
              type="button"
              className="yp-btn yp-btn-ghost"
              onClick={() => {
                setSearch('')
                setQ('')
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {loading && !data ? <LoadingLine>Loading test takers…</LoadingLine> : null}
      {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

      {data ? (
        <div className={loading ? 'yp-admin-refreshing' : undefined}>
          <p className="yp-admin-meta">
            {data.total} person{data.total === 1 ? '' : 's'} took the free test
          </p>
          <div className="yp-admin-table-wrap">
            <table className="yp-admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Topic</th>
                  <th>Score</th>
                  <th>Level</th>
                  <th>Spoke</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.leads.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      {q
                        ? 'No test takers match this search.'
                        : 'No free-test emails yet. They appear here after someone unlocks a report.'}
                    </td>
                  </tr>
                ) : (
                  data.leads.map((lead) => {
                    const open = openId === lead.id
                    const score = lead.overall != null ? Math.round(lead.overall) : null
                    return (
                      <Fragment key={lead.id}>
                        <tr>
                          <td>
                            <div className="yp-admin-user">
                              <strong>
                                <a href={`mailto:${lead.email}`} className="yp-admin-link">
                                  {lead.email}
                                </a>
                              </strong>
                            </div>
                          </td>
                          <td>{lead.topic}</td>
                          <td>{score != null ? score : '—'}</td>
                          <td>{lead.level || '—'}</td>
                          <td>{lead.durationSec}s</td>
                          <td>{fmtWhen(lead.createdAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="yp-btn yp-btn-soft"
                              onClick={() => setOpenId(open ? null : lead.id)}
                              aria-expanded={open}
                            >
                              {open ? 'Hide' : 'Details'}
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr>
                            <td colSpan={7}>
                              <LeadDetail lead={lead} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}
