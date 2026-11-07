'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LessonsPage } from '@/views/LessonsPage'

export default function Page() {
  return (
    <ProtectedRoute access="learner">
      <LessonsPage />
    </ProtectedRoute>
  )
}
