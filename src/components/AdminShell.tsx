'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppShell } from './AppShell'

const SUBNAV = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users', exact: false },
  { href: '/admin/leads', label: 'Test takers', exact: false },
  { href: '/admin/costs', label: 'Costs', exact: false },
  { href: '/admin/flags', label: 'Flags', exact: false },
  { href: '/admin/health', label: 'Health', exact: false },
]

export function AdminShell({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  /** Optional controls rendered on the right of the page header. */
  actions?: ReactNode
}) {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    const path = pathname ?? ''
    if (exact) return path === href
    return path === href || path.startsWith(`${href}/`)
  }

  return (
    <AppShell title="Admin">
      <div className="yp-wrap yp-admin">
        <nav className="yp-admin-subnav" aria-label="Admin sections">
          {SUBNAV.map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`yp-admin-subnav-link ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <header className="yp-admin-pagehead">
          <h2>{title}</h2>
          {actions ? <div className="yp-admin-pagehead-actions">{actions}</div> : null}
        </header>

        {children}
      </div>
    </AppShell>
  )
}
