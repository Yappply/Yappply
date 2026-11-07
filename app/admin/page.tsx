'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminOverviewPage } from '@/views/AdminOverviewPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminOverviewPage />
    </ProtectedRoute>
  )
}
