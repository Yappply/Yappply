'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminFlagsPage } from '@/views/AdminFlagsPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminFlagsPage />
    </ProtectedRoute>
  )
}
