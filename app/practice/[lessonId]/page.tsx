'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PracticePage } from '@/views/PracticePage'

export default function Page() {
  return (
    <ProtectedRoute access="learner">
      <PracticePage />
    </ProtectedRoute>
  )
}
