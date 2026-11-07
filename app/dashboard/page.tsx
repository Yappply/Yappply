'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardPage } from '@/views/DashboardPage'

export default function Page() {
  return (
    <ProtectedRoute access="learner">
      <DashboardPage />
    </ProtectedRoute>
  )
}
