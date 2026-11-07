import { AdminAuditLog } from '../models/AdminAuditLog.mjs'

export async function writeAudit({
  adminId,
  action,
  targetType,
  targetId = '',
  before = null,
  after = null,
  reason = '',
  ip = '',
}) {
  try {
    await AdminAuditLog.create({
      adminId,
      action,
      targetType,
      targetId: String(targetId || ''),
      before,
      after,
      reason: reason || '',
      ip: ip || '',
    })
  } catch (err) {
    console.error('Audit log failed:', err instanceof Error ? err.message : err)
  }
}
