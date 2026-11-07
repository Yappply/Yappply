'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { YappyMark } from '../components/YappyMark'
import '@/styles/yappply-app.css'

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 4.8c5 0 9.3 3.1 11 7.2a12.3 12.3 0 0 1-4.2 4.8M6.1 6.1A12.4 12.4 0 0 0 1 12c1.7 4.1 6 7.2 11 7.2 1.4 0 2.7-.2 3.9-.7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12c1.7 4.1 6 7.2 11 7.2S20.3 16.1 22 12C20.3 7.9 16 4.8 11 4.8S2.7 7.9 1 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function LoginPage() {
  const { user, login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    router.replace(user.role === 'admin' ? '/admin' : '/dashboard')
  }, [user, router])

  if (user) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const loggedIn = await login(email.trim(), password)
      router.push(loggedIn.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="yp-app yp-auth yp-auth-login">
      <div className="yp-login-shell">
        <aside className="yp-login-panel" aria-hidden={false}>
          <Link href="/" className="yp-auth-brand" aria-label="Yappply home">
            <YappyMark />
            <span>Yappply</span>
          </Link>
          <div className="yp-login-panel-copy">
            <h2>
              Speak every day with <em>Yappy</em>
            </h2>
            <p>30-minute calls, gentle corrections, and a streak that keeps you going.</p>
          </div>
          <ul className="yp-login-points">
            <li>Patient AI speaking partner</li>
            <li>Scores &amp; lesson reports</li>
            <li>Daily practice streak</li>
          </ul>
        </aside>

        <div className="yp-login-form-wrap">
          <Link href="/" className="yp-auth-brand yp-login-brand-mobile" aria-label="Yappply home">
            <YappyMark />
            <span>Yappply</span>
          </Link>
          <form className="yp-auth-card" onSubmit={(e) => void onSubmit(e)}>
            <div className="yp-login-card-head">
              <span className="yp-tag lime">Welcome back</span>
              <h1>Log in</h1>
              <p className="yp-lede">Continue your speaking plan with Yappy.</p>
            </div>

            {error && <p className="yp-error">{error}</p>}

            <label className="yp-field yp-field-icon">
              <span>Email</span>
              <span className="yp-field-wrap">
                <i className="yp-field-leading">
                  <MailIcon />
                </i>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>

            <label className="yp-field yp-field-icon yp-field-password">
              <span>Password</span>
              <span className="yp-field-wrap">
                <i className="yp-field-leading">
                  <LockIcon />
                </i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="yp-field-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </span>
            </label>

            <button type="submit" className="yp-btn yp-btn-main yp-auth-submit" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
              {!busy && <span aria-hidden>→</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
