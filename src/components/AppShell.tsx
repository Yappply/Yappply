'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { YappyMark } from './YappyMark'

const SIDEBAR_KEY = 'yappply-sidebar-collapsed'

type NavItem = { href: string; label: string; icon: string }

function Icon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      )
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5" />
        </svg>
      )
    case 'lessons':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    case 'scores':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20V8" />
        </svg>
      )
    case 'site':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
    case 'admin':
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
          <path d="M9.5 12l1.8 1.8L15 10" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common}>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      )
    case 'collapse':
      return (
        <svg {...common}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      )
    case 'expand':
      return (
        <svg {...common}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      )
    default:
      return null
  }
}

function daysRemaining(iso?: string) {
  if (!iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  const diff = end - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

export function AppShell({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const remaining = daysRemaining(user?.subscriptionEndsAt)
  const firstName = user?.name?.split(' ')[0] || 'friend'

  const isAdmin = user?.role === 'admin'
  const nav: NavItem[] = isAdmin
    ? [
        { href: '/admin', label: 'Admin', icon: 'admin' },
        { href: '/profile', label: 'Profile', icon: 'profile' },
        { href: '/', label: 'Visit site', icon: 'site' },
      ]
    : [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: '/scores', label: 'Scores', icon: 'scores' },
        { href: '/profile', label: 'Profile', icon: 'profile' },
        { href: '/lessons', label: 'Lessons', icon: 'lessons' },
        { href: '/', label: 'Visit site', icon: 'site' },
      ]

  function isActive(href: string) {
    if (href === '/') return false
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div
      className={`yp-app yp-shell ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
    >
      <button
        type="button"
        className="yp-shell-scrim"
        aria-label="Close menu"
        onClick={() => setMobileOpen(false)}
      />

      <aside className="yp-sidebar" aria-label="Main navigation">
        <div className="yp-sidebar-top">
          <Link
            href={isAdmin ? '/admin' : '/dashboard'}
            className="yp-sidebar-brand"
            aria-label={isAdmin ? 'Yappply admin' : 'Yappply dashboard'}
          >
            <YappyMark />
            <span className="yp-sidebar-brand-stack">
              <span className="yp-sidebar-brand-text">Yappply</span>
              <span className="yp-sidebar-brand-sub">
                {isAdmin ? 'Admin access' : 'Learner access'}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="yp-sidebar-toggle mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="yp-sidebar-nav">
          {nav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`yp-nav-item ${active ? 'is-active' : ''}`}
                title={item.label}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="yp-sidebar-foot">
          {!isAdmin && (
            <div className="yp-sidebar-plan">
              <span>Current plan</span>
              <strong>
                {remaining == null
                  ? 'No active plan'
                  : remaining === 0
                    ? 'Ended'
                    : `${remaining} day${remaining === 1 ? '' : 's'} left`}
              </strong>
            </div>
          )}
          <div className="yp-sidebar-user" title={user?.email || ''}>
            <span className="yp-avatar" aria-hidden>
              {(user?.name || 'Y').charAt(0).toUpperCase()}
            </span>
            <div className="yp-sidebar-user-meta">
              <strong>{firstName}</strong>
              <span>{isAdmin ? 'admin' : user?.level || 'beginner'}</span>
            </div>
          </div>
          <button
            type="button"
            className="yp-nav-item yp-nav-logout"
            onClick={logout}
            title="Logout"
          >
            <Icon name="logout" />
            <span>Logout</span>
          </button>
          <button
            type="button"
            className="yp-nav-item yp-sidebar-collapse desktop-only"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'expand' : 'collapse'} />
            <span>{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </aside>

      <div className="yp-shell-main">
        <header className="yp-shell-bar">
          <button
            type="button"
            className="yp-shell-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <div className="yp-shell-bar-copy">
            {title ? <h1>{title}</h1> : null}
          </div>
          {!isAdmin && remaining != null && (
            <div
              className={`yp-sub-chip ${remaining <= 5 ? 'is-urgent' : ''}`}
              title={
                user?.subscriptionEndsAt
                  ? `Ends ${new Date(user.subscriptionEndsAt).toLocaleDateString()}`
                  : undefined
              }
            >
              <span className="yp-sub-chip-label">Plan</span>
              <strong>
                {remaining === 0
                  ? 'Ended'
                  : `· ${remaining} day${remaining === 1 ? '' : 's'} left`}
              </strong>
            </div>
          )}
          {isAdmin ? <div className="yp-sub-chip yp-admin-chip">Admin</div> : null}
        </header>

        <div className="yp-shell-content">{children}</div>
      </div>
    </div>
  )
}
