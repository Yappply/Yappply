'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminCostsPage } from '@/views/AdminCostsPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminCostsPage />
    </ProtectedRoute>
  )
}
