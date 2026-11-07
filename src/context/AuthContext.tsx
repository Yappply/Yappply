'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken } from '../lib/api'
import type { Level } from '../lib/storage'

export interface AuthUser {
  id: string
  name: string
  email: string
  level: Level
  role?: 'user' | 'admin'
  status?: 'active' | 'limited' | 'suspended' | 'banned'
  /** ISO date when the current plan window ends */
  subscriptionEndsAt?: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (data: {
    name: string
    email: string
    password: string
    level?: Level
  }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  updateLevel: (level: Level) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await api<{ user: AuthUser }>('/api/auth/me')
      setUser(data.user)
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(
    async (payload: { name: string; email: string; password: string; level?: Level }) => {
      const data = await api<{ token: string; user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(payload),
      })
      setToken(data.token)
      setUser(data.user)
    },
    [],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const updateLevel = useCallback(async (level: Level) => {
    const data = await api<{ user: AuthUser }>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ level }),
    })
    setUser(data.user)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser, updateLevel }),
    [user, loading, login, register, logout, refreshUser, updateLevel],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
