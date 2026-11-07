/**
 * Official Gemini Developer API paid-tier rates (USD per 1M tokens).
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 * Text rates through Dec 31, 2026 where promotional pricing applies.
 * TTS rates through Dec 31, 2026.
 */

const TEXT_RATES = {
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
}

const TTS_RATES = {
  'gemini-3.8-flash-lite-tts': { input: 0.5, output: 6.0 },
  'gemini-3.8-flash-tts': { input: 0.5, output: 9.0 },
}

function ratesForModel(model) {
  if (TEXT_RATES[model]) return { ...TEXT_RATES[model], kind: 'text' }
  if (TTS_RATES[model]) return { ...TTS_RATES[model], kind: 'tts' }
  // Conservative fallback if Google renames a model
  if (/tts/i.test(model || '')) return { input: 0.5, output: 6.0, kind: 'tts' }
  return { input: 0.3, output: 2.5, kind: 'text' }
}

export function parseUsageMetadata(usage = {}) {
  const promptTokens = Number(usage.promptTokenCount) || 0
  const candidateTokens = Number(usage.candidatesTokenCount) || 0
  const thoughtsTokens = Number(usage.thoughtsTokenCount) || 0
  const totalTokens =
    Number(usage.totalTokenCount) || promptTokens + candidateTokens + thoughtsTokens

  return {
    promptTokens,
    candidateTokens,
    thoughtsTokens,
    totalTokens,
    promptTokensDetails: usage.promptTokensDetails || [],
    candidatesTokensDetails: usage.candidatesTokensDetails || [],
  }
}

/**
 * Compute USD cost from Gemini usageMetadata + model id.
 * Uses actual token counts from the API response — not estimates.
 */
export function costFromUsage(model, usage = {}) {
  const parsed = parseUsageMetadata(usage)
  const rates = ratesForModel(model)
  const inputTokens = parsed.promptTokens
  // Thinking tokens are billed as output on Gemini
  const outputTokens = parsed.candidateTokens + parsed.thoughtsTokens
  const inputCostUsd = (inputTokens / 1_000_000) * rates.input
  const outputCostUsd = (outputTokens / 1_000_000) * rates.output
  const costUsd = inputCostUsd + outputCostUsd

  return {
    model,
    kind: rates.kind,
    inputPerMillionUsd: rates.input,
    outputPerMillionUsd: rates.output,
    promptTokens: inputTokens,
    candidateTokens: parsed.candidateTokens,
    thoughtsTokens: parsed.thoughtsTokens,
    totalTokens: parsed.totalTokens || inputTokens + outputTokens,
    inputCostUsd,
    outputCostUsd,
    costUsd,
  }
}

export function pricingCatalog() {
  return {
    updatedFrom: 'https://ai.google.dev/gemini-api/docs/pricing',
    note: 'Paid-tier USD rates through 2026-12-31 for promotional Gemini 3.x prices where applicable.',
    text: TEXT_RATES,
    tts: TTS_RATES,
  }
}
