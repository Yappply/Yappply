import mongoose from 'mongoose'

const usageEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeSession', index: true },
    lessonId: { type: String, index: true },
    turnIndex: { type: Number, default: 0 },
    callType: {
      type: String,
      enum: ['conversation', 'correction', 'scoring', 'greeting', 'tts', 'warm', 'other'],
      default: 'conversation',
      index: true,
    },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cachedTokens: { type: Number, default: 0 },
    thinkingTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    inputPerMillionUsd: { type: Number, default: 0 },
    outputPerMillionUsd: { type: Number, default: 0 },
    cachedPerMillionUsd: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['ok', 'error', 'blocked', 'rate_limited'],
      default: 'ok',
      index: true,
    },
    errorCode: { type: String, default: '' },
    userTextChars: { type: Number, default: 0 },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'usage_events' },
)

usageEventSchema.index({ userId: 1, createdAt: -1 })
usageEventSchema.index({ lessonId: 1, createdAt: -1 })
usageEventSchema.index({ createdAt: -1 })
usageEventSchema.index({ sessionId: 1, turnIndex: 1 })

export const UsageEvent = mongoose.model('UsageEvent', usageEventSchema)
