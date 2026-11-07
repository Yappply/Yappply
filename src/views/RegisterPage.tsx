'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ApiError } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { Level } from '../lib/storage'
import { YappyMark } from '../components/YappyMark'
import '@/styles/yappply-app.css'

export function RegisterPage() {
  const { user, register } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [level, setLevel] = useState<Level>('beginner')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) router.replace('/dashboard')
  }, [user, router])

  if (user) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await register({ name: name.trim(), email: email.trim(), password, level })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="yp-app yp-auth">
      <div className="yp-auth-blob" aria-hidden />
      <div className="yp-auth-blob alt" aria-hidden />
      <div className="yp-auth-inner">
        <Link href="/" className="yp-auth-brand" aria-label="Yappply home">
          <YappyMark />
          Yappply
        </Link>
        <form className="yp-auth-card" onSubmit={(e) => void onSubmit(e)}>
          <span className="yp-tag pink">Get started</span>
          <h1>Create your account</h1>
          <p className="yp-lede">Join the 30-day speaking challenge and practise out loud with Yappy.</p>
          {error && <p className="yp-error">{error}</p>}
          <label className="yp-field">
            <span>Name</span>
            <input
              type="text"
              autoComplete="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="yp-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="yp-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <fieldset className="yp-levels">
            <legend>Your level</legend>
            {(
              [
                ['beginner', 'Beginner'],
                ['intermediate', 'Easy+'],
                ['advanced', 'Comfortable'],
              ] as const
            ).map(([id, title]) => (
              <label key={id} className={`yp-level ${level === id ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="level"
                  value={id}
                  checked={level === id}
                  onChange={() => setLevel(id)}
                />
                <strong>{title}</strong>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="yp-btn yp-btn-main" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="yp-switch">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
