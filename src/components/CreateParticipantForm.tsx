'use client'

import { useState, type FormEvent } from 'react'
import { createUser, errMessage, type Level } from '../lib/adminApi'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  level: 'beginner' as Level,
  planDays: '30',
}

export function CreateParticipantForm({ onCreated }: { onCreated?: () => void }) {
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    setCreating(true)
    try {
      const planDays = Math.min(365, Math.max(1, Number(form.planDays) || 30))
      const result = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        level: form.level,
        planDays,
      })
      setOk(`Created ${result.user.name} (${result.user.email}). They can log in now.`)
      setForm(emptyForm)
      setShowPassword(false)
      onCreated?.()
    } catch (err) {
      setError(errMessage(err, 'Could not create participant'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <form className="yp-admin-create-form" onSubmit={onSubmit}>
      <label className="yp-field">
        <span>Name</span>
        <input
          type="text"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Participant name"
        />
      </label>
      <label className="yp-field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="off"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="learner@email.com"
        />
      </label>
      <label className="yp-field">
        <span>Password</span>
        <div className="yp-field-wrap yp-field-password">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="At least 6 characters"
          />
          <button
            type="button"
            className="yp-field-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>
      <label className="yp-field">
        <span>Level</span>
        <select
          className="yp-admin-select"
          value={form.level}
          onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as Level }))}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>
      <label className="yp-field">
        <span>Plan days</span>
        <input
          type="number"
          name="planDays"
          min={1}
          max={365}
          value={form.planDays}
          onChange={(e) => setForm((f) => ({ ...f, planDays: e.target.value }))}
        />
      </label>
      <div className="yp-admin-create-actions">
        <button type="submit" className="yp-btn yp-btn-main" disabled={creating}>
          {creating ? 'Creating...' : 'Create account'}
        </button>
        {ok ? <p className="yp-admin-create-ok">{ok}</p> : null}
        {error ? <p className="yp-status error">{error}</p> : null}
      </div>
    </form>
  )
}
