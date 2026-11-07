'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { YappyMark } from './YappyMark'
import '@/styles/yappply-app.css'

type Access = 'any' | 'learner' | 'admin'

export function ProtectedRoute({
  children,
  access = 'any',
}: {
  children: React.ReactNode
  /** learner = practice app only; admin = admin panel only; any = signed-in */
  access?: Access
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?from=${encodeURIComponent(pathname ?? '/')}`)
      return
    }
    if (access === 'learner' && user.role === 'admin') {
      router.replace('/admin')
      return
    }
    if (access === 'admin' && user.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [loading, user, router, pathname, access])

  if (loading || !user) {
    return (
      <div className="yp-app yp-auth">
        <div className="yp-auth-blob" aria-hidden />
        <div className="yp-auth-inner" style={{ justifyItems: 'center', textAlign: 'center' }}>
          <YappyMark />
          <p className="yp-loading" style={{ marginTop: '0.5rem' }}>
            {loading ? 'Loading…' : 'Redirecting to login…'}
          </p>
        </div>
      </div>
    )
  }

  if (access === 'learner' && user.role === 'admin') {
    return (
      <div className="yp-app yp-auth">
        <div className="yp-auth-inner" style={{ justifyItems: 'center', textAlign: 'center' }}>
          <YappyMark />
          <p className="yp-loading" style={{ marginTop: '0.5rem' }}>
            Admins manage users — redirecting…
          </p>
        </div>
      </div>
    )
  }

  if (access === 'admin' && user.role !== 'admin') {
    return (
      <div className="yp-app yp-auth">
        <p className="yp-loading">Admin access required…</p>
      </div>
    )
  }

  return children
}
