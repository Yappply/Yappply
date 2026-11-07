import { TOPICS } from '../data/topics'
import type { Topic } from '../types'
import type { Level } from '../lib/storage'

interface Props {
  level: Level
  onPick: (topic: Topic) => void
  onChangeSettings: () => void
}

export function TopicScreen({ level, onPick, onChangeSettings }: Props) {
  return (
    <div className="screen topic-screen">
      <header className="topic-header">
        <div>
          <p className="eyebrow">Speakora · {level}</p>
          <h1>30 easy lessons with Yappy</h1>
          <p className="lede">
            Start with Lesson 1. Each lesson invites you to speak and tell real stories from your life
            so you can practice English. Each call can last up to 30 minutes.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onChangeSettings}>
          Level settings
        </button>
      </header>

      <div className="topic-grid">
        {TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className="topic-card"
            onClick={() => onPick(topic)}
          >
            <span className="topic-num">Lesson {topic.number}</span>
            <span className="topic-icon" aria-hidden>
              {topic.icon}
            </span>
            <strong>{topic.title}</strong>
            <span>{topic.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
