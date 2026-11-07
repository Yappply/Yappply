'use client'

import type { DetailedLessonReport as Report, WordScore } from '../lib/detailedReport'

function wordTone(score: number): 'good' | 'mid' | 'low' {
  if (score >= 80) return 'good'
  if (score >= 55) return 'mid'
  return 'low'
}

function bandTone(score: number): 'high' | 'mid' | 'low' {
  if (score >= 7.5) return 'high'
  if (score >= 6) return 'mid'
  return 'low'
}

function AccuracyRing({ percent }: { percent: number }) {
  const r = 48
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, percent))
  const offset = c - (pct / 100) * c
  return (
    <div className="dlr-ring" aria-label={`Accuracy ${pct}%`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle className="dlr-ring-track" cx="60" cy="60" r={r} />
        <circle
          className="dlr-ring-value"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="dlr-ring-label">
        <strong>{pct}%</strong>
        <span>Accuracy</span>
      </div>
    </div>
  )
}

function BandBar({ score, max = 9 }: { score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100))
  return (
    <div className="dlr-band-bar" aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

function WordMap({ words }: { words: WordScore[] }) {
  if (!words.length) {
    return <p className="dlr-empty">No word-level transcript available.</p>
  }
  return (
    <div className="dlr-wordmap" role="list" aria-label="Word accuracy">
      {words.map((w, i) => (
        <span
          key={`${w.word}-${i}`}
          role="listitem"
          className={`dlr-word dlr-word--${wordTone(w.score)}`}
          title={`${w.word}: ${w.score}%`}
        >
          <em>{w.score}</em>
          {w.word}
        </span>
      ))}
    </div>
  )
}

function CriterionCard({
  title,
  score,
  feedback,
  accent,
}: {
  title: string
  score: number
  feedback: string
  accent: 'lime' | 'pink' | 'lilac' | 'peach'
}) {
  return (
    <article className={`dlr-criterion dlr-criterion--${accent}`}>
      <div className="dlr-criterion-head">
        <h3>{title}</h3>
        <p className={`dlr-band-num dlr-band-num--${bandTone(score)}`}>
          {score.toFixed(1)}
          <em>/9</em>
        </p>
      </div>
      <BandBar score={score} />
      <p className="dlr-feedback">{feedback}</p>
    </article>
  )
}

export function DetailedLessonReportView({ report }: { report: Report }) {
  return (
    <div className="dlr">
      <section className="dlr-hero" aria-label="Overall speaking result">
        <div className="dlr-hero-ring">
          <AccuracyRing percent={report.accuracyPercent} />
        </div>
        <div className="dlr-hero-band">
          <span className="dlr-kicker">Overall band</span>
          <p className="dlr-overall">
            <strong>{report.overallBand.toFixed(1)}</strong>
            <span>± {report.bandConfidence.toFixed(1)} confidence</span>
          </p>
          <p className="dlr-hero-note">
            Band scores use a 1–9 scale across pronunciation, fluency, vocabulary, and grammar.
          </p>
        </div>
      </section>

      <section className="dlr-card" aria-labelledby="dlr-transcript">
        <div className="dlr-card-head">
          <h2 id="dlr-transcript">What you said</h2>
          <span className="dlr-legend" aria-hidden>
            <i className="good" /> Clear
            <i className="mid" /> OK
            <i className="low" /> Unclear
          </span>
        </div>

        <div className="dlr-block">
          <h3>Polished transcript</h3>
          <p className="dlr-prose">“{report.polishedTranscript}”</p>
        </div>

        <div className="dlr-block">
          <h3>Heard as</h3>
          <p className="dlr-sub">What listeners are likely to hear, word by word.</p>
          <WordMap words={report.actualWords} />
        </div>
      </section>

      <section className="dlr-vocab-row" aria-label="Vocabulary">
        <article className="dlr-vocab-card dlr-vocab-card--lime">
          <h3>Vocabulary level</h3>
          <p className="dlr-level">{report.vocabulary.level}</p>
          <p className="dlr-hint">{report.vocabulary.feedback}</p>
        </article>
        <article className="dlr-vocab-card dlr-vocab-card--lilac">
          <h3>Repetition</h3>
          {report.vocabulary.repetitions.length > 0 ? (
            <ul className="dlr-rep-list">
              {report.vocabulary.repetitions.map((r) => (
                <li key={r.word}>
                  <strong>{r.word}</strong>
                  <span>×{r.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dlr-hint">No heavy repetition — nice variety.</p>
          )}
          <p className="dlr-hint dlr-hint-foot">{report.vocabulary.tip}</p>
        </article>
      </section>

      <section className="dlr-skills" aria-labelledby="dlr-skills">
        <div className="dlr-card-head">
          <h2 id="dlr-skills">Skill breakdown</h2>
        </div>
        <div className="dlr-skills-grid">
          <CriterionCard
            title="Pronunciation"
            score={report.pronunciation.score}
            feedback={report.pronunciation.feedback}
            accent="pink"
          />
          <CriterionCard
            title="Task response"
            score={report.taskResponse.score}
            feedback={report.taskResponse.feedback}
            accent="lime"
          />
          <CriterionCard
            title="Fluency & coherence"
            score={report.fluency.score}
            feedback={report.fluency.feedback}
            accent="lilac"
          />
          <CriterionCard
            title="Lexical resource"
            score={report.lexical.score}
            feedback={report.lexical.feedback}
            accent="peach"
          />
          <CriterionCard
            title="Grammar range & accuracy"
            score={report.grammar.score}
            feedback={report.grammar.feedback}
            accent="lilac"
          />
        </div>
        <p className="dlr-boost">Tip: richer vocabulary usually lifts the overall band fastest.</p>
      </section>
    </div>
  )
}
