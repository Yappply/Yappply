'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminUserDetailPage } from '@/views/AdminUserDetailPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminUserDetailPage />
    </ProtectedRoute>
  )
}
