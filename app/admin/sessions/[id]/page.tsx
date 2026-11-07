'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminSessionReplayPage } from '@/views/AdminSessionReplayPage'

export default function Page() {
  return (
    <ProtectedRoute access="admin">
      <AdminSessionReplayPage />
    </ProtectedRoute>
  )
}
