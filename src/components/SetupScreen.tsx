import { useState, type FormEvent } from 'react'
import type { Level } from '../lib/storage'

interface Props {
  initialLevel: Level
  keyReady: boolean
  onReady: (level: Level) => void
  onRecheck: () => Promise<boolean>
}

export function SetupScreen({ initialLevel, keyReady, onReady, onRecheck }: Props) {
  const [level, setLevel] = useState<Level>(initialLevel)
  const [checking, setChecking] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!keyReady) return
    onReady(level)
  }

  async function handleRecheck() {
    setChecking(true)
    try {
      await onRecheck()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="screen setup-screen">
      <div className="setup-glow" aria-hidden />
      <div className="setup-panel">
        <p className="eyebrow">Speakora</p>
        <h1>Practice English with Yappy.</h1>
        <p className="lede">
          Thirty beginner lessons. Yappy uses simple words and short sentences. Each call can last up
          to 30 minutes — hang up any time you want.
        </p>

        {!keyReady ? (
          <div className="env-missing">
            <p className="form-error">
              Add your Gemini API key to the <code>.env</code> file in the project root, then restart
              the dev server. The key stays on the server — it is never shipped to the browser.
            </p>
            <pre className="env-snippet">{`GEMINI_API_KEY=your_key_here`}</pre>
            <p className="env-hint">
              Get a key at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              .
            </p>
            <button
              type="button"
              className="btn ghost"
              disabled={checking}
              onClick={() => void handleRecheck()}
            >
              {checking ? 'Checking…' : 'I added the key — check again'}
            </button>
          </div>
        ) : (
          <form className="setup-form" onSubmit={handleSubmit}>
            <p className="env-ok">
              Gemini API key loaded on the server from <code>.env</code>
            </p>

            <fieldset className="level-field">
              <legend>Your level</legend>
              {(
                [
                  ['beginner', 'Beginner', 'Best for these lessons — shortest words'],
                  ['intermediate', 'Easy+', 'Still simple English with Yappy'],
                  ['advanced', 'Comfortable', 'Yappy stays simple; you can say a bit more'],
                ] as const
              ).map(([id, title, desc]) => (
                <label key={id} className={`level-option ${level === id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="level"
                    value={id}
                    checked={level === id}
                    onChange={() => setLevel(id)}
                  />
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </label>
              ))}
            </fieldset>

            <button type="submit" className="btn primary">
              See the 30 lessons
            </button>
          </form>
        )}

        <ul className="setup-perks">
          <li>Lesson 1: introduce yourself at work, school, or class</li>
          <li>Tell real stories — Yappy asks questions and helps gently</li>
          <li>Hang up any time — max 30 minutes per call</li>
        </ul>
      </div>
    </div>
  )
}
