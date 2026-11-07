import mongoose from 'mongoose'

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    targetType: {
      type: String,
      enum: ['user', 'setting', 'lesson', 'flag', 'session', 'system'],
      required: true,
    },
    targetId: { type: String, default: '' },
    before: { type: Object, default: null },
    after: { type: Object, default: null },
    reason: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'admin_audit_log' },
)

adminAuditLogSchema.index({ createdAt: -1 })
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })

export const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema)
