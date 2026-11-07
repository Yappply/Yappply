'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminHealthPage } from '@/views/AdminHealthPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminHealthPage />
    </ProtectedRoute>
  )
}
