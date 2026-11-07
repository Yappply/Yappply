const LEVEL_KEY = 'speakora_level'

export type Level = 'beginner' | 'intermediate' | 'advanced'

export function getLevel(): Level {
  const v = localStorage.getItem(LEVEL_KEY)
  if (v === 'beginner' || v === 'intermediate' || v === 'advanced') return v
  return 'intermediate'
}

export function setLevel(level: Level): void {
  localStorage.setItem(LEVEL_KEY, level)
}
