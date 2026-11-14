import mongoose from 'mongoose'

const mistakeSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['grammar', 'pronunciation', 'unclear'], required: true },
    summary: { type: String, required: true },
    heard: { type: String },
    expected: { type: String },
  },
  { _id: false },
)

const scoresSchema = new mongoose.Schema(
  {
    clarity: { type: Number, min: 1, max: 5 },
    accuracy: { type: Number, min: 1, max: 5 },
    pronunciation: { type: Number, min: 1, max: 5 },
    completeness: { type: Number, min: 1, max: 5 },
  },
  { _id: false },
)

const transcriptTurnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'coach'], required: true },
    text: { type: String, default: '' },
    turnIndex: { type: Number, default: 0 },
    at: { type: Date },
    correction: { type: Boolean, default: false },
    practiceAttempts: { type: Number, default: 0 },
  },
  { _id: false },
)

const practiceSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lessonId: { type: String, required: true, index: true },
    lessonNumber: { type: Number, required: true },
    lessonTitle: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'abandoned'],
      default: 'active',
      index: true,
    },
    durationMs: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    turns: { type: Number, default: 0 },
    turnCount: { type: Number, default: 0 },
    corrections: { type: Number, default: 0 },
    practiceSuccesses: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    progressCounted: { type: Boolean, default: false },
    endedReason: {
      type: String,
      enum: ['hangup', 'timeup', 'error', 'hung_up', 'time_limit', 'blocked', ''],
      default: '',
    },
    endReason: {
      type: String,
      enum: ['hung_up', 'time_limit', 'error', 'blocked', ''],
      default: '',
    },
    scores: { type: scoresSchema },
    overall: { type: Number },
    topMistakes: { type: [mistakeSchema], default: [] },
    detailedReport: { type: mongoose.Schema.Types.Mixed },
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
    totalCostUsd: { type: Number, default: 0 },
    transcript: { type: [transcriptTurnSchema], default: [] },
    promptVersion: { type: String, default: 'v1' },
    isTest: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true },
)

practiceSessionSchema.index({ userId: 1, createdAt: -1 })
practiceSessionSchema.index({ lessonId: 1, createdAt: -1 })
practiceSessionSchema.index({ status: 1, startedAt: -1 })

export const PracticeSession = mongoose.model('PracticeSession', practiceSessionSchema)
