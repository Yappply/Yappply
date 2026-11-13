import mongoose from 'mongoose'

const freeTestAttemptSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, index: true },
  },
  { timestamps: true, collection: 'free_test_attempts' },
)

freeTestAttemptSchema.index({ visitorId: 1, createdAt: -1 })

export const FreeTestAttempt = mongoose.model('FreeTestAttempt', freeTestAttemptSchema)
