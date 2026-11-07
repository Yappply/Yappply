'use client'

import { Fragment, useState, type FormEvent } from 'react'
import { AdminShell } from '../components/AdminShell'
import { ErrorLine, LoadingLine } from '../components/AdminWidgets'
import { useAdminData } from '../hooks/useAdminData'
import { fetchFreeTestLeads, fmtWhen, type FreeTestLeadRow } from '../lib/adminApi'

function LeadDetail({ lead }: { lead: FreeTestLeadRow }) {
  return (
    <div className="yp-admin-lead-detail">
      <p>
        <strong>Topic:</strong> {lead.topic}
      </p>
      <p>
        <strong>Transcript:</strong>{' '}
        {lead.transcript?.trim() ? lead.transcript : 'No speech captured'}
      </p>
      {lead.report ? (
        <dl className="yp-flag-evidence">
          {(['overall', 'level', 'strength', 'fixFirst', 'paceWpm', 'answeredNote', 'pitch'] as const).map(
            (key) => {
              const value = (lead.report as Record<string, unknown>)?.[key]
              if (value == null || value === '') return null
              return (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              )
            },
          )}
        </dl>
      ) : null}
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
        Everyone who unlocked a landing free-test report. Their email is saved when they open the
        full report.
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
