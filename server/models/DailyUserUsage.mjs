import mongoose from 'mongoose'

const dailyUserUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD UTC
    sessions: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 },
    turns: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'daily_user_usage' },
)

dailyUserUsageSchema.index({ userId: 1, date: 1 }, { unique: true })
dailyUserUsageSchema.index({ date: 1 })

export const DailyUserUsage = mongoose.model('DailyUserUsage', dailyUserUsageSchema)
