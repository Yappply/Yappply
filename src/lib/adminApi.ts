import { api } from './api'

/* -------------------------------------------------------------------------- */
/* Shared types                                                                */
/* -------------------------------------------------------------------------- */

export type AdminRange = 'today' | '7d' | '30d'
export type UserStatus = 'active' | 'limited' | 'suspended' | 'banned'
export type Level = 'beginner' | 'intermediate' | 'advanced'

export interface Kpi {
  value: number
  prev: number | null
  deltaPct: number | null
}

export interface AdminKpis {
  totalUsers: Kpi
  newSignups: Kpi
  dau: Kpi
  sessions: Kpi
  minutesSpoken: Kpi
  lessonsCompleted: Kpi
  geminiCost: Kpi
  costPerActiveUser: Kpi
  costPerCompletedLesson: Kpi
  errorRate: Kpi
  flaggedUsers: Kpi
}

export interface UserBrief {
  id: string
  name: string
  email: string
  status?: UserStatus
}

export interface UsageRow {
  costUsd: number
  costLabel: string
  sharePct: number
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  errors: number
}

export interface AdminOverview {
  range: string
  from: string
  to: string
  days: number
  prevFrom: string
  prevTo: string
  kpis: AdminKpis
  labels: {
    geminiCost: string
    costPerActiveUser: string
    costPerCompletedLesson: string
  }
  charts: {
    dailyActive: Array<{ day: string; users: number; signups: number }>
    dailyCost: Array<Record<string, number | string> & { day: string; total: number }>
    dailyCostCallTypes: string[]
    dailyTokens: Array<{ day: string; input: number; output: number }>
    topExpensiveUsers: Array<{ user: UserBrief } & UsageRow>
    sessionLengthBuckets: Array<{
      label: string
      minMinutes: number
      maxMinutes: number | null
      count: number
    }>
    streakCounts: Array<{ days: number; label: string; users: number }>
  }
  apiKey: {
    configured: boolean
    masked: string | null
    source: string | null
  }
  openFlags: number
}

export interface AdminUserBadge {
  status: UserStatus
  label: string
  tone: string
  reason: string
  until: string | null
}

export interface AdminUserBase {
  id: string
  name: string
  email: string
  level: string
  role: string
  status: UserStatus
  effectiveStatus: UserStatus
  statusReason: string
  statusUntil: string | null
  badge: AdminUserBadge
  limitsOverride: Record<string, number | undefined>
  hasLimitsOverride: boolean
  lifetimeCostUsd: number
  lifetimeCostLabel: string
  createdAt: string
  lastActiveAt: string | null
  lastLoginAt: string | null
  subscriptionEndsAt: string | null
  signupSource: string
}

export interface AdminUserListItem extends AdminUserBase {
  lessonsCompleted: number
  lessonsTotal: number
  sessions: number
  minutes: number
  currentStreak: number
  openFlags: number
}

export interface AdminUsersQuery {
  q?: string
  status?: string
  level?: string
  flagged?: boolean
  sort?: 'createdAt' | 'lastActiveAt' | 'lifetimeCostUsd' | 'name'
  dir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface AdminUsersResponse {
  items: AdminUserListItem[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface AdminLessonStat {
  lessonId: string
  lessonNumber: number
  title: string
  attempts: number
  completed: boolean
  totalDurationMs: number
  totalTurns: number
  totalCorrections: number
  bestStreak: number
  lastPracticedAt: string | null
  bestOverall: number | null
  bestScores?: Record<string, number> | null
  latestScores?: Record<string, number> | null
}

export interface AdminUsageSummary {
  costUsd: number
  costLabel: string
  sessions: number
  minutes: number
  turns: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  calls: number
  errors: number
  activeDays: number
}

export interface AdminFlag {
  id: string
  userId: string
  user: UserBrief | null
  rule: string
  evidence: Record<string, unknown>
  sessionIds: string[]
  status: 'open' | 'dismissed' | 'actioned'
  note: string
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminSessionSummary {
  id: string
  lessonId: string
  lessonNumber: number
  lessonTitle: string
  status: string
  completed: boolean
  endReason: string
  durationMs: number
  minutes: number
  turns: number
  corrections: number
  overall: number | null
  isTest: boolean
  costUsd: number
  costLabel: string
  inputTokens: number
  outputTokens: number
  calls: number
  startedAt: string | null
  endedAt: string | null
}

export interface AdminAuditRow {
  id: string
  admin: { id: string; name: string; email: string } | null
  action: string
  targetType: string
  targetId: string
  reason: string
  createdAt: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after?: any
}

export interface AdminUserDetail {
  user: AdminUserBase & { adminNotes: string; tokenVersion: number }
  progress: {
    totalSessions: number
    totalPracticeMs: number
    totalMinutes: number
    totalTurns: number
    totalCorrections: number
    lessonsCompleted: number
    lessonsTotal: number
    progressPct: number
    currentStreak: number
    longestStreak: number
    lastPracticeDate: string
  }
  usage: {
    lifetime: UsageRow & { sessions: number; minutes: number }
    last7d: AdminUsageSummary
    last30d: AdminUsageSummary
    byCallType: Array<{ callType: string } & UsageRow>
  }
  lessonStats: AdminLessonStat[]
  recentSessions: AdminSessionSummary[]
  openFlags: AdminFlag[]
  adminNotes: string
  audit: AdminAuditRow[]
}

export type UserActionName =
  | 'limit'
  | 'suspend'
  | 'ban'
  | 'reactivate'
  | 'renew_plan'
  | 'set_limits'
  | 'reset_progress'
  | 'force_logout'
  | 'delete'
  | 'set_notes'

export interface UserActionPayload {
  action: UserActionName
  reason?: string
  days?: number
  until?: string
  notes?: string
  limits?: Record<string, number | null | ''>
}

export interface AdminCosts {
  range: string
  from: string
  to: string
  days: number
  totals: { costUsd: number; costLabel: string; calls: number; activeUsers: number }
  byDay: Array<{ day: string } & UsageRow>
  byUser: Array<{ user: UserBrief } & UsageRow>
  byLesson: Array<
    {
      lessonId: string
      lessonNumber: number | null
      title: string
      sessions: number
      users: number
      costPerSession: number
    } & UsageRow
  >
  bySession: Array<
    {
      sessionId: string
      user: UserBrief | null
      lessonId: string | null
      lessonTitle: string | null
      status: string | null
      minutes: number
      startedAt: string | null
    } & UsageRow
  >
  byCallType: Array<{ callType: string } & UsageRow>
  byModel: Array<{ model: string } & UsageRow>
  percentiles: { users: number; avg: number; median: number; p90: number; p99: number }
  concentration: { top1Share: number; top10Share: number; top1Usd: number; top10Usd: number }
  projectedMonthly: {
    mtdUsd: number
    mtdLabel: string
    dailyRunRateUsd: number
    projectedUsd: number
    projectedLabel: string
    daysElapsed: number
    daysInMonth: number
    monthlyBudgetUsd: number
    budgetUsedPct: number
    projectedOverBudget: boolean
  }
}

export interface AdminFlagsResponse {
  status: string
  openCount: number
  items: AdminFlag[]
}

export interface AdminTurnEvent {
  id: string
  turnIndex: number
  callType: string
  model: string
  status: string
  errorCode: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  thinkingTokens: number
  cachedTokens: number
  totalTokens: number
  userTextChars: number
  costUsd: number
  costLabel: string
  createdAt: string
}

export interface AdminTranscriptMessage {
  role: string
  text: string
  turnIndex: number
  at: string | null
  correction: boolean
  practiceAttempts: number
}

export interface AdminSessionDetail {
  session: {
    id: string
    userId: string
    lessonId: string
    lessonNumber: number
    lessonTitle: string
    status: string
    completed: boolean
    endReason: string
    durationMs: number
    minutes: number
    turnCount: number
    corrections: number
    practiceSuccesses: number
    maxStreak: number
    scores: Record<string, number> | null
    overall: number | null
    topMistakes: unknown[]
    promptVersion: string
    isTest: boolean
    totalInputTokens: number
    totalOutputTokens: number
    costUsd: number
    costLabel: string
    startedAt: string | null
    endedAt: string | null
  }
  transcript: AdminTranscriptMessage[]
  turns: Array<{
    turnIndex: number
    messages: Array<Omit<AdminTranscriptMessage, 'turnIndex'>>
    events: AdminTurnEvent[]
    costUsd: number
    costLabel: string
    inputTokens: number
    outputTokens: number
    latencyMs: number
  }>
  events: AdminTurnEvent[]
  user: (AdminUserBase & { sessionsTotal: number; lessonsCompleted: number; currentStreak: number }) | null
}

export interface AdminHealth {
  checkedAt: string
  mongo: { ok: boolean; readyState: number }
  gemini: {
    apiKeyConfigured: boolean
    callsLastHour: number
    errorsLastHour: number
    errorRateLastHour: number
    blockedLastHour: number
    topErrorCodes: Array<{ code: string; count: number }>
  }
  latency: { samples: number; p50: number; p95: number }
  rateLimited: { lastHour: number; today: number }
  sessions: { endedWithErrorToday: number; active: number }
}

export type AdminLimits = Record<string, number | string | null | undefined> & {
  updatedAt?: string | null
}

export interface CreateParticipantPayload {
  name: string
  email: string
  password: string
  level?: Level
  planDays?: number
}

/* -------------------------------------------------------------------------- */
/* API calls                                                                   */
/* -------------------------------------------------------------------------- */

const enc = encodeURIComponent

export function fetchOverview(range: AdminRange = '7d') {
  return api<AdminOverview>(`/api/admin/overview?range=${enc(range)}`)
}

export function fetchUsers(query: AdminUsersQuery = {}) {
  const p = new URLSearchParams()
  if (query.q) p.set('q', query.q)
  if (query.status) p.set('status', query.status)
  if (query.level) p.set('level', query.level)
  if (query.flagged) p.set('flagged', '1')
  if (query.sort) p.set('sort', query.sort)
  if (query.dir) p.set('dir', query.dir)
  if (query.page) p.set('page', String(query.page))
  if (query.limit) p.set('limit', String(query.limit))
  const qs = p.toString()
  return api<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ''}`)
}

export function createUser(payload: CreateParticipantPayload) {
  return api<{
    user: {
      id: string
      name: string
      email: string
      level: string
      role: string
      status: string
      subscriptionEndsAt: string
      createdAt: string
    }
  }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchUser(id: string) {
  return api<AdminUserDetail>(`/api/admin/users/${enc(id)}`)
}

export function postUserAction(id: string, payload: UserActionPayload) {
  return api<{ ok: boolean; action: string; user: AdminUserBase }>(
    `/api/admin/users/${enc(id)}/actions`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export function fetchCosts(range: AdminRange = '7d') {
  return api<AdminCosts>(`/api/admin/costs?range=${enc(range)}`)
}

export function fetchFlags(status: 'open' | 'dismissed' | 'actioned' | 'all' = 'open') {
  return api<AdminFlagsResponse>(`/api/admin/flags?status=${enc(status)}`)
}

export function postFlagAction(id: string, action: 'dismiss' | 'actioned', note = '') {
  return api<{ ok: boolean; flag: AdminFlag }>(`/api/admin/flags/${enc(id)}`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  })
}

export function scanFlags() {
  return api<{ ok: boolean; openCount: number }>('/api/admin/flags/scan', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function fetchSession(id: string) {
  return api<AdminSessionDetail>(`/api/admin/sessions/${enc(id)}`)
}

export function fetchHealth() {
  return api<AdminHealth>('/api/admin/health')
}

export function fetchLimits() {
  return api<{ limits: AdminLimits }>('/api/admin/limits')
}

export function saveLimits(limits: Record<string, number>, reason = '') {
  return api<{
    ok: boolean
    limits: AdminLimits
    changed: Record<string, { from: unknown; to: unknown }>
  }>('/api/admin/limits', {
    method: 'PUT',
    body: JSON.stringify({ limits, reason }),
  })
}

export interface FreeTestLeadRow {
  id: string
  email: string
  topic: string
  transcript: string
  durationSec: number
  overall: number | null
  level: string
  createdAt: string
  report: Record<string, unknown> | null
}

export interface FreeTestLeadsResponse {
  total: number
  leads: FreeTestLeadRow[]
}

export function fetchFreeTestLeads(q = '', limit = 50) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('limit', String(limit))
  const qs = params.toString()
  return api<FreeTestLeadsResponse>(`/api/admin/free-test-leads${qs ? `?${qs}` : ''}`)
}

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

export function fmtUsd(n: number | null | undefined): string {
  const v = Number(n) || 0
  if (v === 0) return '$0.00'
  if (Math.abs(v) < 0.01) return `$${v.toFixed(6)}`
  return `$${v.toFixed(4)}`
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  const v = Number(n) || 0
  return v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtTokens(n: number | null | undefined): string {
  const v = Number(n) || 0
  if (!v) return '0'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}

export function fmtPct(fraction: number | null | undefined, digits = 1): string {
  return `${((Number(fraction) || 0) * 100).toFixed(digits)}%`
}

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return day
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function fmtDuration(ms: number | null | undefined): string {
  const v = Number(ms) || 0
  if (!v) return '0m'
  const mins = Math.round(v / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function fmtLatency(ms: number | null | undefined): string {
  const v = Number(ms) || 0
  if (v >= 1000) return `${(v / 1000).toFixed(2)}s`
  return `${Math.round(v)}ms`
}

export function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
