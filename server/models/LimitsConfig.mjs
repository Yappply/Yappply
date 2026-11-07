import mongoose from 'mongoose'

const limitsConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    sessionLengthMin: { type: Number, default: 30 },
    sessionsPerDay: { type: Number, default: 1 },
    speakingMinutesPerDay: { type: Number, default: 30 },
    geminiCallsPerSession: { type: Number, default: 120 },
    inputTokensPerSession: { type: Number, default: 500_000 },
    charsPerUserTurn: { type: Number, default: 600 },
    apiRequestsPerUserPerMinute: { type: Number, default: 20 },
    signupsPerIpPerDay: { type: Number, default: 3 },
    dailyCostFlagMultiplier: { type: Number, default: 5 },
    autoLimitCostMultiplier: { type: Number, default: 10 },
    dailyBudgetUsd: { type: Number, default: 25 },
    monthlyBudgetUsd: { type: Number, default: 500 },
    userDailyCostAlertUsd: { type: Number, default: 5 },
  },
  { timestamps: true, collection: 'limits_config' },
)

export const LimitsConfig = mongoose.model('LimitsConfig', limitsConfigSchema)
