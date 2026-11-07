'use client'

import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'

export function LandingAuthNav() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="landing-auth-slot" aria-hidden />
  }

  if (user) {
    const initial = (user.name || 'Y').charAt(0).toUpperCase()
    return (
      <div className="landing-auth-slot">
        <Link
          href="/dashboard"
          className="landing-profile-circle"
          aria-label={`${user.name || 'Profile'} — open dashboard`}
          title={user.name || 'Dashboard'}
        >
          {initial}
        </Link>
      </div>
    )
  }

  return (
    <div className="landing-auth-slot">
      <Link href="/login" className="btn btn-ink">
        Log in
      </Link>
    </div>
  )
}
