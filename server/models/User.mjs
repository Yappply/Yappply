import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    /** Demo login: Introduction is the only lesson. */
    trial: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['active', 'limited', 'suspended', 'banned'],
      default: 'active',
      index: true,
    },
    statusReason: { type: String, default: '' },
    statusUntil: { type: Date },
    limitsOverride: {
      sessionsPerDay: { type: Number },
      speakingMinutesPerDay: { type: Number },
      geminiCallsPerSession: { type: Number },
      inputTokensPerSession: { type: Number },
      charsPerUserTurn: { type: Number },
    },
    lifetimeCostUsd: { type: Number, default: 0 },
    lastActiveAt: { type: Date },
    lastLoginAt: { type: Date },
    signupSource: { type: String, default: 'direct' },
    tokenVersion: { type: Number, default: 0 },
    adminNotes: { type: String, default: '' },
    /** End of the current plan window (30-day challenge by default). */
    subscriptionEndsAt: { type: Date },
    /** IANA timezone for local calendar-day limits / lesson unlocks (e.g. Asia/Karachi). */
    timezone: { type: String, default: 'UTC', trim: true },
  },
  { timestamps: true },
)

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash)
}

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export const User = mongoose.model('User', userSchema)
