'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { YappyMark } from '../components/YappyMark'
import '@/styles/yappply-app.css'

const REMEMBER_KEY = 'yappply_remember_email'

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
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) setEmail(saved)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtml = html.style.overflow
    const previousBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previousHtml
      body.style.overflow = previousBody
    }
  }, [])

  useEffect(() => {
    if (!user) return
    router.replace(user.role === 'admin' ? '/admin' : '/dashboard')
  }, [user, router])

  if (user) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNote(null)
    setBusy(true)
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim())
      else localStorage.removeItem(REMEMBER_KEY)
      const loggedIn = await login(email.trim(), password)
      router.push(loggedIn.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="yp-gate">
      <section className="yp-gate-form">
        <header className="yp-gate-top">
          <Link href="/" className="yp-gate-brand" aria-label="Yappply home">
            <YappyMark className="yp-gate-logo" />
            <span>Yappply</span>
          </Link>
          <Link href="/" className="yp-gate-back">
            <span aria-hidden>←</span> Back to home
          </Link>
        </header>

        <div className="yp-gate-body">
          <h1>Welcome back!</h1>
          <p className="yp-gate-lede">
            Log in to pick up today&apos;s topic with <strong>Yappy</strong> and keep your streak going.
          </p>

          <form onSubmit={(e) => void onSubmit(e)}>
            {error && <p className="yp-gate-error">{error}</p>}
            {note && <p className="yp-gate-note">{note}</p>}

            <label className="yp-gate-field">
              <span>Email address</span>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="yp-gate-field">
              <span>Password</span>
              <span className="yp-gate-password">
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
                  className="yp-gate-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </span>
            </label>

            <div className="yp-gate-row">
              <label className="yp-gate-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <button
                type="button"
                className="yp-gate-forgot"
                onClick={() => {
                  setError(null)
                  setNote('Password reset isn’t available yet. Ask an admin to reset it.')
                }}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="yp-gate-submit" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="yp-gate-switch">
            Just looking? <Link href="/#test">Take the free 60-second speaking test</Link>
          </p>
        </div>
      </section>

      <aside className="yp-gate-side">
        <img
          className="yp-gate-side-art"
          src="/login.png"
          alt="Two people sitting and practicing a conversation together."
        />
      </aside>
    </div>
  )
}
