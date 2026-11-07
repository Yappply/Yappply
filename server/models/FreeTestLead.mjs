import mongoose from 'mongoose'

const freeTestLeadSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    topic: { type: String, required: true, trim: true },
    transcript: { type: String, default: '' },
    durationSec: { type: Number, default: 60 },
    report: { type: mongoose.Schema.Types.Mixed },
    overall: { type: Number },
    level: { type: String, default: '' },
    source: { type: String, default: 'landing-free-test' },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true, collection: 'free_test_leads' },
)

freeTestLeadSchema.index({ createdAt: -1 })
freeTestLeadSchema.index({ email: 1, createdAt: -1 })

export const FreeTestLead = mongoose.model('FreeTestLead', freeTestLeadSchema)
