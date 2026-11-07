import { GeminiUsage } from '../models/GeminiUsage.mjs'
import { costFromUsage } from './geminiPricing.mjs'

/**
 * Persist a Gemini API call's real usageMetadata as USD cost for a user.
 * Failures are logged but never break the user-facing request.
 */
export async function logGeminiUsage({ userId, kind, model, usage, meta = {} }) {
  if (!userId || !model) return null
  try {
    const priced = costFromUsage(model, usage || {})
    const doc = await GeminiUsage.create({
      userId,
      kind: kind || priced.kind,
      model: priced.model,
      promptTokens: priced.promptTokens,
      candidateTokens: priced.candidateTokens,
      thoughtsTokens: priced.thoughtsTokens,
      totalTokens: priced.totalTokens,
      inputCostUsd: priced.inputCostUsd,
      outputCostUsd: priced.outputCostUsd,
      costUsd: priced.costUsd,
      inputPerMillionUsd: priced.inputPerMillionUsd,
      outputPerMillionUsd: priced.outputPerMillionUsd,
      meta,
    })
    return doc
  } catch (err) {
    console.error(
      'Failed to log Gemini usage:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}
