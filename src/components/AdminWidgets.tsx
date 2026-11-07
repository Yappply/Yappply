'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { AdminRange, Kpi, UserStatus } from '../lib/adminApi'

export const RANGE_OPTIONS: Array<{ value: AdminRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

export function RangePicker({
  value,
  onChange,
}: {
  value: AdminRange
  onChange: (next: AdminRange) => void
}) {
  return (
    <div className="yp-range-pills" role="group" aria-label="Date range">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`yp-range-pill ${value === opt.value ? 'is-active' : ''}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function StatusBadge({ status }: { status: UserStatus | string }) {
  const known = ['active', 'limited', 'suspended', 'banned'].includes(status)
  const cls = known ? status : 'active'
  return (
    <span className={`yp-status-badge is-${cls}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active'}
    </span>
  )
}

/**
 * KPI card with previous-period comparison.
 * `invertDelta` flips the good/bad colouring (e.g. cost or error rate going up is bad).
 */
export function KpiCard({
  label,
  value,
  kpi,
  invertDelta = false,
  hint,
}: {
  label: string
  value: string
  kpi?: Kpi
  invertDelta?: boolean
  hint?: string
}) {
  const delta = kpi?.deltaPct ?? null
  let tone = 'is-flat'
  if (delta !== null && delta !== 0) {
    const up = delta > 0
    tone = up !== invertDelta ? 'is-good' : 'is-bad'
  }
  return (
    <div className="yp-kpi">
      <span className="yp-kpi-label">{label}</span>
      <strong className="yp-kpi-value">{value}</strong>
      <span className={`yp-kpi-delta ${tone}`}>
        {kpi && kpi.prev !== null
          ? delta === null
            ? 'No prior data'
            : `${delta > 0 ? '+' : ''}${delta}% vs prev`
          : (hint ?? ' ')}
      </span>
    </div>
  )
}

export interface BarItem {
  key: string
  label: ReactNode
  value: number
  display: string
  href?: string
  sub?: string
}

/** Horizontal bar list; bars are scaled against the max value. */
export function BarList({
  items,
  empty = 'No data for this period.',
}: {
  items: BarItem[]
  empty?: string
}) {
  const max = Math.max(0, ...items.map((i) => i.value))
  if (!items.length) return <p className="yp-empty">{empty}</p>
  return (
    <ul className="yp-barlist">
      {items.map((item) => {
        const pct = max > 0 ? Math.max(2, (item.value / max) * 100) : 0
        const label = item.href ? <Link href={item.href}>{item.label}</Link> : item.label
        return (
          <li key={item.key}>
            <div className="yp-barlist-row">
              <span className="yp-barlist-label">{label}</span>
              <span className="yp-barlist-value">{item.display}</span>
            </div>
            <div
              className="yp-admin-bar"
              aria-hidden
              style={{ ['--pct' as string]: `${item.value > 0 ? pct : 0}%` }}
            />
            {item.sub ? <span className="yp-admin-meta">{item.sub}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Simple vertical column chart (one column per item). */
export function ColumnChart({
  items,
  empty = 'No data for this period.',
}: {
  items: Array<{ key: string; label: string; value: number; title: string }>
  empty?: string
}) {
  const max = Math.max(0, ...items.map((i) => i.value))
  if (!items.length) return <p className="yp-empty">{empty}</p>
  return (
    <div className="yp-columns" role="list">
      {items.map((item) => {
        const pct = max > 0 ? Math.max(item.value > 0 ? 3 : 0, (item.value / max) * 100) : 0
        return (
          <div key={item.key} className="yp-column" role="listitem" title={item.title}>
            <div className="yp-column-track">
              <div className="yp-column-fill" style={{ height: `${pct}%` }} />
            </div>
            <span className="yp-column-label">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function LoadingLine({ children = 'Loading...' }: { children?: ReactNode }) {
  return <p className="yp-loading">{children}</p>
}

export function ErrorLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="yp-admin-errorline" role="alert">
      <p className="yp-status error">{message}</p>
      {onRetry ? (
        <button type="button" className="yp-btn yp-btn-soft" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}
