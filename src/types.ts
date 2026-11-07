export type LessonBand = 'very-easy' | 'easy-plus'

export interface AgendaItem {
  id: string
  label: string
  /** First natural question for this topic */
  ask: string
  /** Words/phrases that suggest the learner touched this topic */
  hints: string[]
  /** Curious follow-ups to make a real conversation (not interview) */
  explore?: string[]
  /** Minimum learner turns on this topic before moving on */
  minTurns?: number
}

export interface Topic {
  id: string
  number: number
  title: string
  blurb: string
  starter: string
  icon: string
  band: LessonBand
  /** Daily phrases Yappy should teach and have the learner repeat */
  phrases?: string[]
  /** Required topics Yappy must cover in order (e.g. Introduction checklist) */
  agenda?: AgendaItem[]
}

export type MessageRole = 'user' | 'coach'

export interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  confidence?: number
}

/** chat = normal conversation; practice = learner must repeat correctedSentence */
export type TurnMode = 'chat' | 'practice'

export interface VoiceReply {
  reply: string
  mode: TurnMode
  /** Exact sentence the learner should repeat when mode is practice */
  correctedSentence: string | null
  hadCorrection: boolean
}

export type AppScreen = 'setup' | 'topics' | 'chat'
