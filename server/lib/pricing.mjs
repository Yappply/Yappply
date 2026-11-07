import { ModelPricing } from '../models/ModelPricing.mjs'

const FALLBACK = {
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5, cached: 0 },
  'gemini-3.8-flash': { input: 0.75, output: 3.75, cached: 0 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75, cached: 0 },
  'gemini-3.8-flash-lite-tts': { input: 0.5, output: 6.0, cached: 0 },
  'gemini-3.8-flash-tts': { input: 0.5, output: 9.0, cached: 0 },
}

let cache = { at: 0, rows: [] }

export async function seedModelPricing() {
  const count = await ModelPricing.countDocuments()
  if (count > 0) return
  const now = new Date()
  const docs = Object.entries(FALLBACK).map(([model, rates]) => ({
    model,
    inputPerMillionUsd: rates.input,
    outputPerMillionUsd: rates.output,
    cachedPerMillionUsd: rates.cached,
    effectiveFrom: now,
  }))
  await ModelPricing.insertMany(docs)
  cache = { at: 0, rows: [] }
}

async function loadPricingRows() {
  if (Date.now() - cache.at < 60_000 && cache.rows.length) return cache.rows
  const rows = await ModelPricing.find().sort({ effectiveFrom: -1 }).lean()
  cache = { at: Date.now(), rows }
  return rows
}

export async function ratesForModel(model, at = new Date()) {
  const rows = await loadPricingRows()
  const match = rows.find(
    (r) => r.model === model && new Date(r.effectiveFrom).getTime() <= at.getTime(),
  )
  if (match) {
    return {
      input: match.inputPerMillionUsd,
      output: match.outputPerMillionUsd,
      cached: match.cachedPerMillionUsd || 0,
    }
  }
  if (FALLBACK[model]) return FALLBACK[model]
  if (/tts/i.test(model || '')) return { input: 0.5, output: 6.0, cached: 0 }
  return { input: 0.3, output: 2.5, cached: 0 }
}

export function parseUsageMetadata(usage = {}) {
  const inputTokens = Number(usage.promptTokenCount) || 0
  const outputTokens = Number(usage.candidatesTokenCount) || 0
  const thinkingTokens = Number(usage.thoughtsTokenCount) || 0
  const cachedTokens = Number(usage.cachedContentTokenCount) || 0
  const totalTokens =
    Number(usage.totalTokenCount) || inputTokens + outputTokens + thinkingTokens

  return { inputTokens, outputTokens, thinkingTokens, cachedTokens, totalTokens }
}

/**
 * Cost from real usageMetadata × DB pricing at write time.
 * Thinking tokens billed as output.
 */
export async function costFromUsage(model, usage = {}, at = new Date()) {
  const parsed = parseUsageMetadata(usage)
  const rates = await ratesForModel(model, at)
  const billableOutput = parsed.outputTokens + parsed.thinkingTokens
  const inputCostUsd = (parsed.inputTokens / 1_000_000) * rates.input
  const outputCostUsd = (billableOutput / 1_000_000) * rates.output
  const cachedCostUsd = (parsed.cachedTokens / 1_000_000) * rates.cached
  const costUsd = inputCostUsd + outputCostUsd + cachedCostUsd

  return {
    model,
    ...parsed,
    outputTokensBilled: billableOutput,
    inputPerMillionUsd: rates.input,
    outputPerMillionUsd: rates.output,
    cachedPerMillionUsd: rates.cached,
    inputCostUsd,
    outputCostUsd,
    cachedCostUsd,
    costUsd,
  }
}

export async function pricingCatalog() {
  const rows = await loadPricingRows()
  const byModel = {}
  for (const r of rows) {
    if (!byModel[r.model]) {
      byModel[r.model] = {
        model: r.model,
        inputPerMillionUsd: r.inputPerMillionUsd,
        outputPerMillionUsd: r.outputPerMillionUsd,
        cachedPerMillionUsd: r.cachedPerMillionUsd || 0,
        effectiveFrom: r.effectiveFrom,
      }
    }
  }
  return {
    updatedFrom: 'https://ai.google.dev/gemini-api/docs/pricing',
    note: 'Prices stored in model_pricing; costUsd frozen on each usage_event at write time.',
    models: Object.values(byModel),
  }
}
