'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AdminShell } from '../components/AdminShell'
import { ErrorLine, LoadingLine, StatusBadge } from '../components/AdminWidgets'
import { CreateParticipantForm } from '../components/CreateParticipantForm'
import { useAdminData } from '../hooks/useAdminData'
import { fetchUsers, fmtNum, fmtWhen, type AdminUsersQuery } from '../lib/adminApi'

type SortKey = NonNullable<AdminUsersQuery['sort']>

const PAGE_SIZE = 25

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [level, setLevel] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [sort, setSort] = useState<SortKey>('createdAt')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const key = JSON.stringify({ q, status, level, flagged, sort, dir, page })
  const { data, loading, error, reload } = useAdminData(
    () => fetchUsers({ q, status, level, flagged, sort, dir, page, limit: PAGE_SIZE }),
    key,
    'Could not load users',
  )

  function onSearch(e: FormEvent) {
    e.preventDefault()
    setPage(1)
    setQ(search.trim())
  }

  function toggleSort(next: SortKey) {
    setPage(1)
    if (sort === next) {
      setDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(next)
      setDir(next === 'name' ? 'asc' : 'desc')
    }
  }

  function sortMark(col: SortKey) {
    if (sort !== col) return ''
    return dir === 'asc' ? ' (asc)' : ' (desc)'
  }

  function resetFilters() {
    setSearch('')
    setQ('')
    setStatus('')
    setLevel('')
    setFlagged(false)
    setPage(1)
  }

  const hasFilters = Boolean(q || status || level || flagged)

  return (
    <AdminShell
      title="Users"
      actions={
        <button
          type="button"
          className="yp-btn yp-btn-main"
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
        >
          {showCreate ? 'Close' : 'Create user'}
        </button>
      }
    >
      {showCreate ? (
        <section className="yp-panel yp-admin-create">
          <div className="yp-panel-head">
            <h2>Create participant</h2>
            <span className="yp-panel-meta">New learner accounts for Yappply</span>
          </div>
          <CreateParticipantForm onCreated={() => void reload()} />
        </section>
      ) : null}

      <section className="yp-panel yp-admin-panel">
        <form className="yp-admin-filters" onSubmit={onSearch}>
          <label className="yp-field yp-admin-filter-search">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
            />
          </label>
          <label className="yp-field">
            <span>Status</span>
            <select
              className="yp-admin-select"
              value={status}
              onChange={(e) => {
                setPage(1)
                setStatus(e.target.value)
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="limited">Limited</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </label>
          <label className="yp-field">
            <span>Level</span>
            <select
              className="yp-admin-select"
              value={level}
              onChange={(e) => {
                setPage(1)
                setLevel(e.target.value)
              }}
            >
              <option value="">All levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="yp-admin-check">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => {
                setPage(1)
                setFlagged(e.target.checked)
              }}
            />
            <span>Flagged only</span>
          </label>
          <div className="yp-admin-filter-actions">
            <button type="submit" className="yp-btn yp-btn-main">
              Search
            </button>
            {hasFilters ? (
              <button type="button" className="yp-btn yp-btn-ghost" onClick={resetFilters}>
                Clear
              </button>
            ) : null}
          </div>
        </form>

        {loading && !data ? <LoadingLine>Loading users...</LoadingLine> : null}
        {error ? <ErrorLine message={error} onRetry={() => void reload()} /> : null}

        {data ? (
          <div className={loading ? 'yp-admin-refreshing' : undefined}>
            <div className="yp-admin-table-wrap">
              <table className="yp-admin-table yp-admin-users-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="yp-admin-th-btn" onClick={() => toggleSort('name')}>
                        User{sortMark('name')}
                      </button>
                    </th>
                    <th>Status</th>
                    <th>Level</th>
                    <th>Progress</th>
                    <th>
                      <button
                        type="button"
                        className="yp-admin-th-btn"
                        onClick={() => toggleSort('lifetimeCostUsd')}
                      >
                        Lifetime cost{sortMark('lifetimeCostUsd')}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="yp-admin-th-btn"
                        onClick={() => toggleSort('lastActiveAt')}
                      >
                        Last active{sortMark('lastActiveAt')}
                      </button>
                    </th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        {hasFilters ? 'No users match these filters.' : 'No participant accounts yet.'}
                      </td>
                    </tr>
                  ) : (
                    data.items.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="yp-admin-user">
                            <strong>
                              <Link href={`/admin/users/${u.id}`} className="yp-admin-link">
                                {u.name}
                              </Link>
                              {u.hasLimitsOverride ? (
                                <span className="yp-admin-badge">Custom limits</span>
                              ) : null}
                            </strong>
                            <span>{u.email}</span>
                            <span className="yp-admin-meta">
                              {fmtNum(u.sessions)} sessions · {fmtNum(u.minutes, 1)} min · streak{' '}
                              {u.currentStreak}
                            </span>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={u.effectiveStatus} />
                        </td>
                        <td>{u.level}</td>
                        <td>
                          <div className="yp-admin-progress">
                            <strong>
                              {u.lessonsCompleted}/{u.lessonsTotal}
                            </strong>
                            <div
                              className="yp-admin-bar"
                              aria-hidden
                              style={{
                                ['--pct' as string]: `${Math.round(
                                  (u.lessonsCompleted / Math.max(1, u.lessonsTotal)) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <strong className="yp-admin-cost">{u.lifetimeCostLabel}</strong>
                        </td>
                        <td>{fmtWhen(u.lastActiveAt)}</td>
                        <td>{u.openFlags > 0 ? <span className="yp-flag-count">{u.openFlags}</span> : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="yp-admin-pager">
              <span className="yp-admin-meta">
                {fmtNum(data.total)} user{data.total === 1 ? '' : 's'} · page {data.page} of{' '}
                {data.pages}
              </span>
              <div className="yp-admin-pager-btns">
                <button
                  type="button"
                  className="yp-btn yp-btn-soft"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="yp-btn yp-btn-soft"
                  disabled={data.page >= data.pages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AdminShell>
  )
}
