'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminUsersPage } from '@/views/AdminUsersPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminUsersPage />
    </ProtectedRoute>
  )
}
