'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ResultsPage } from '@/views/ResultsPage'

export default function Page() {
  return (
    <ProtectedRoute access="learner">
      <ResultsPage />
    </ProtectedRoute>
  )
}
