import mongoose from 'mongoose'

const userFlagSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rule: { type: String, required: true, index: true },
    evidence: { type: Object, default: {} },
    sessionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PracticeSession' }],
    status: {
      type: String,
      enum: ['open', 'dismissed', 'actioned'],
      default: 'open',
      index: true,
    },
    note: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true, collection: 'user_flags' },
)

userFlagSchema.index({ status: 1, createdAt: -1 })

export const UserFlag = mongoose.model('UserFlag', userFlagSchema)
