'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { Level } from '../lib/storage'
import { AppShell } from '../components/AppShell'
import { YappyMark } from '../components/YappyMark'

const LEVELS: Array<{ value: Level; label: string; hint: string }> = [
  { value: 'beginner', label: 'Beginner', hint: 'Just starting out' },
  { value: 'intermediate', label: 'Easy+', hint: 'Building confidence' },
  { value: 'advanced', label: 'Comfortable', hint: 'Ready for freer talk' },
]

function daysRemaining(iso?: string) {
  if (!iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)))
}

function LevelDropdown({
  value,
  onChange,
}: {
  value: Level
  onChange: (level: Level) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = LEVELS.find((l) => l.value === value) || LEVELS[0]

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`yp-level-dd ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="yp-level-dd-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected.label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul className="yp-level-dd-menu" role="listbox" id={listId} aria-label="Speaking level">
          {LEVELS.map((opt) => {
            const active = opt.value === value
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={active ? 'is-active' : ''}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.hint}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function ProfilePage() {
  const { user, refreshUser, updateLevel, logout } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [level, setLevel] = useState<Level>(user?.level || 'beginner')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    setName(user?.name || '')
    setLevel(user?.level || 'beginner')
  }, [user?.name, user?.level])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      await api('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), level }),
      })
      await refreshUser()
      setMessage('Profile updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordMessage(null)
    setPasswordError(null)

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setSavingPassword(true)
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setPasswordMessage('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setChangePasswordOpen(false)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function onLevelChange(next: Level) {
    setLevel(next)
    try {
      await updateLevel(next)
    } catch {
      /* keep local until save */
    }
  }

  const firstName = user?.name?.split(' ')[0] || 'friend'
  const levelLabel = LEVELS.find((l) => l.value === level)?.label || 'Beginner'
  const initial = (user?.name || 'Y').charAt(0).toUpperCase()
  const remaining = useMemo(() => daysRemaining(user?.subscriptionEndsAt), [user?.subscriptionEndsAt])
  const endsLabel = user?.subscriptionEndsAt
    ? new Date(user.subscriptionEndsAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <AppShell title="Profile">
      <div className="yp-profile yp-profile-edu">
        <header className="yp-profile-top">
          <div>
            <h1>
              Hi {firstName} — your <em className="s">account</em>
            </h1>
            <p>Update your details, speaking level, and password in one place.</p>
          </div>
        </header>

        <div className="yp-profile-body">
          <div className="yp-profile-main">
            <section className="yp-profile-hero">
              <div className="yp-profile-hero-main">
                <span className="yp-profile-avatar" aria-hidden>
                  {initial}
                </span>
                <div>
                  <h2 className="yp-profile-hero-name">{user?.name || firstName}</h2>
                  <p>{user?.email || 'Signed in as a Yappply learner'}</p>
                </div>
              </div>
              <div className="yp-profile-hero-chips">
                <span className="yp-profile-chip lime">{levelLabel}</span>
                <span className="yp-profile-chip lilac">
                  {user?.role === 'admin' ? 'Admin' : 'Learner'}
                </span>
              </div>
            </section>

            <section className="yp-profile-card">
              <div className="yp-profile-card-head">
                <div>
                  <h2>Your details</h2>
                  <p className="yp-lede">
                    Name and speaking level can change anytime. Email stays linked to this account.
                  </p>
                </div>
              </div>

              <form className="yp-profile-form" onSubmit={(e) => void onSave(e)}>
                <div className="yp-profile-grid">
                  <label>
                    <span>Full name</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label>
                    <span>Email</span>
                    <input value={user?.email || ''} disabled readOnly autoComplete="email" />
                  </label>

                  <div className="yp-profile-field yp-profile-span">
                    <span className="yp-profile-label">Speaking level</span>
                    <LevelDropdown value={level} onChange={(v) => void onLevelChange(v)} />
                  </div>
                </div>

                {error && <p className="yp-error">{error}</p>}
                {message && <p className="yp-profile-ok">{message}</p>}

                <button type="submit" className="yp-btn yp-btn-main" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </section>

            <section className="yp-profile-card yp-profile-security">
              <div className="yp-profile-card-head">
                <div>
                  <h2>Security</h2>
                  <p className="yp-lede">Keep your account safe with a strong password.</p>
                </div>
                <button
                  type="button"
                  className="yp-btn yp-btn-soft yp-password-toggle"
                  onClick={() => {
                    setChangePasswordOpen((v) => !v)
                    setPasswordError(null)
                    setPasswordMessage(null)
                  }}
                >
                  {changePasswordOpen ? 'Cancel' : 'Change password'}
                </button>
              </div>

              {!changePasswordOpen && (
                <div className="yp-password-row yp-password-preview">
                  <input
                    type="password"
                    value="••••••••••••"
                    disabled
                    readOnly
                    aria-label="Current password (hidden)"
                  />
                </div>
              )}

              {passwordMessage && !changePasswordOpen && (
                <p className="yp-profile-ok">{passwordMessage}</p>
              )}

              {changePasswordOpen && (
                <form
                  className="yp-profile-form yp-password-form"
                  onSubmit={(e) => void onChangePassword(e)}
                >
                  <div className="yp-profile-grid">
                    <label>
                      <span>Current password</span>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </label>
                    <label>
                      <span>New password</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        required
                      />
                    </label>
                    <label className="yp-profile-span">
                      <span>Confirm new password</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        required
                      />
                    </label>
                  </div>

                  {passwordError && <p className="yp-error">{passwordError}</p>}
                  {passwordMessage && <p className="yp-profile-ok">{passwordMessage}</p>}

                  <button type="submit" className="yp-btn yp-btn-dark" disabled={savingPassword}>
                    {savingPassword ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              )}
            </section>
          </div>

          <aside className="yp-profile-rail" aria-label="Plan and shortcuts">
            <div className="yp-rail-premium">
              <div className="yp-rail-premium-copy">
                <YappyMark />
                <strong>Your Yappply plan</strong>
                <p>
                  {remaining == null
                    ? 'Start a plan to unlock your daily 30-minute call.'
                    : remaining === 0
                      ? 'Your plan ended. Renew to continue daily practice.'
                      : `${remaining} day${remaining === 1 ? '' : 's'} left${
                          endsLabel ? ` · ends ${endsLabel}` : ''
                        }`}
                </p>
                <Link href="/lessons" className="yp-btn yp-btn-main">
                  {remaining === 0 ? 'Renew plan' : 'Keep practising'}
                </Link>
              </div>
            </div>

            <div className="yp-rail-card yp-profile-shortcuts">
              <div className="yp-dash-block-head">
                <h2>Shortcuts</h2>
              </div>
              <ul className="yp-profile-link-list">
                <li>
                  <Link href="/dashboard">Dashboard</Link>
                </li>
                <li>
                  <Link href="/scores">Scores &amp; reports</Link>
                </li>
                <li>
                  <Link href="/lessons">All lessons</Link>
                </li>
              </ul>
              <button type="button" className="yp-btn yp-btn-soft yp-profile-logout" onClick={logout}>
                Log out
              </button>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
