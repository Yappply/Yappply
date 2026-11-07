'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminLeadsPage } from '@/views/AdminLeadsPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminLeadsPage />
    </ProtectedRoute>
  )
}
