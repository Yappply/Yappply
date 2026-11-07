'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ScoresReportPage } from '@/views/ScoresReportPage'

export default function Page() {
  return (
    <ProtectedRoute access="learner">
      <ScoresReportPage />
    </ProtectedRoute>
  )
}
