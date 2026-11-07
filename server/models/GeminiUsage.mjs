import mongoose from 'mongoose'

const geminiUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: { type: String, enum: ['text', 'tts', 'warm'], required: true },
    model: { type: String, required: true },
    promptTokens: { type: Number, default: 0 },
    candidateTokens: { type: Number, default: 0 },
    thoughtsTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    inputCostUsd: { type: Number, default: 0 },
    outputCostUsd: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    inputPerMillionUsd: { type: Number, default: 0 },
    outputPerMillionUsd: { type: Number, default: 0 },
    meta: { type: Object, default: {} },
  },
  { timestamps: true },
)

geminiUsageSchema.index({ createdAt: -1 })
geminiUsageSchema.index({ userId: 1, createdAt: -1 })

export const GeminiUsage = mongoose.model('GeminiUsage', geminiUsageSchema)
