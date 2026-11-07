import mongoose from 'mongoose'

const skillScoresSchema = new mongoose.Schema(
  {
    clarity: { type: Number, min: 1, max: 5 },
    accuracy: { type: Number, min: 1, max: 5 },
    pronunciation: { type: Number, min: 1, max: 5 },
    completeness: { type: Number, min: 1, max: 5 },
  },
  { _id: false },
)

const lessonStatSchema = new mongoose.Schema(
  {
    lessonId: { type: String, required: true },
    lessonNumber: { type: Number, required: true },
    title: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    totalDurationMs: { type: Number, default: 0 },
    totalTurns: { type: Number, default: 0 },
    totalCorrections: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    /** Set the first time the lesson is completed (full ~30 min). Used for next-day unlock. */
    completedAt: { type: Date },
    lastPracticedAt: { type: Date },
    bestScores: { type: skillScoresSchema },
    latestScores: { type: skillScoresSchema },
    bestOverall: { type: Number },
  },
  { _id: false },
)

const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    totalSessions: { type: Number, default: 0 },
    totalPracticeMs: { type: Number, default: 0 },
    totalTurns: { type: Number, default: 0 },
    totalCorrections: { type: Number, default: 0 },
    lessonsCompleted: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastPracticeDate: { type: String, default: '' }, // YYYY-MM-DD in learner local timezone
    lessonStats: { type: [lessonStatSchema], default: [] },
  },
  { timestamps: true },
)

export const UserProgress = mongoose.model('UserProgress', userProgressSchema)
