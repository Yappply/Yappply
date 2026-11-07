import { UsageEvent } from '../models/UsageEvent.mjs'
import { User } from '../models/User.mjs'
import { DailyUserUsage } from '../models/DailyUserUsage.mjs'
import { costFromUsage } from './pricing.mjs'

function utcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

/**
 * Log one usage_events row after every Gemini call (ok or failed).
 */
export async function logUsageEvent(payload) {
  const {
    userId,
    sessionId = null,
    lessonId = '',
    turnIndex = 0,
    callType = 'conversation',
    model = 'unknown',
    usage = {},
    latencyMs = 0,
    status = 'ok',
    errorCode = '',
    userTextChars = 0,
    ip = '',
    userAgent = '',
  } = payload

  if (!userId) return null

  try {
    const priced = await costFromUsage(model, usage || {})
    const doc = await UsageEvent.create({
      userId,
      sessionId: sessionId || undefined,
      lessonId: lessonId || undefined,
      turnIndex: Number(turnIndex) || 0,
      callType,
      model: priced.model || model,
      inputTokens: priced.inputTokens,
      outputTokens: priced.outputTokensBilled || priced.outputTokens,
      cachedTokens: priced.cachedTokens,
      thinkingTokens: priced.thinkingTokens,
      totalTokens: priced.totalTokens,
      costUsd: status === 'ok' ? priced.costUsd : 0,
      inputPerMillionUsd: priced.inputPerMillionUsd,
      outputPerMillionUsd: priced.outputPerMillionUsd,
      cachedPerMillionUsd: priced.cachedPerMillionUsd,
      latencyMs,
      status,
      errorCode: errorCode || '',
      userTextChars: Number(userTextChars) || 0,
      ip: ip || '',
      userAgent: String(userAgent || '').slice(0, 300),
    })

    if (status === 'ok' && priced.costUsd > 0) {
      await User.updateOne({ _id: userId }, { $inc: { lifetimeCostUsd: priced.costUsd } })
    }

    const date = utcDateString()
    await DailyUserUsage.findOneAndUpdate(
      { userId, date },
      {
        $inc: {
          calls: 1,
          inputTokens: priced.inputTokens || 0,
          outputTokens: priced.outputTokensBilled || priced.outputTokens || 0,
          totalTokens: priced.totalTokens || 0,
          costUsd: status === 'ok' ? priced.costUsd || 0 : 0,
          errorCount: status === 'ok' ? 0 : 1,
          turns: callType === 'conversation' || callType === 'correction' ? 1 : 0,
        },
      },
      { upsert: true, new: true },
    )

    return doc
  } catch (err) {
    console.error('Failed to log usage event:', err instanceof Error ? err.message : err)
    return null
  }
}

/** @deprecated keep name for older imports */
export const logGeminiUsage = async (args) =>
  logUsageEvent({
    userId: args.userId,
    callType: args.kind === 'tts' ? 'tts' : args.kind === 'warm' ? 'warm' : 'conversation',
    model: args.model,
    usage: args.usage,
    ...args.meta,
  })
