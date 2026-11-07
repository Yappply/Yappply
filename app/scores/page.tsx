'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ScoresPage } from '@/views/ScoresPage'

export default function Page() {
  return (
    <ProtectedRoute access="learner">
      <ScoresPage />
    </ProtectedRoute>
  )
}
