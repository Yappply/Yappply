'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { errMessage } from '../lib/adminApi'

/**
 * Loads data with loading/error state; refetches when `key` changes.
 * `reload()` refetches without clearing the current data.
 */
export function useAdminData<T>(loader: () => Promise<T>, key: string, fallbackError: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loaderRef = useRef(loader)
  const seq = useRef(0)

  useEffect(() => {
    loaderRef.current = loader
  })

  const run = useCallback(
    async (keepData: boolean) => {
      const id = ++seq.current
      setLoading(true)
      setError('')
      if (!keepData) setData(null)
      try {
        const result = await loaderRef.current()
        if (id === seq.current) setData(result)
      } catch (err) {
        if (id === seq.current) setError(errMessage(err, fallbackError))
      } finally {
        if (id === seq.current) setLoading(false)
      }
    },
    [fallbackError],
  )

  useEffect(() => {
    // Keeps previous data on screen while a new key loads (range switch, filters).
    void run(true)
    return () => {
      seq.current += 1
    }
  }, [key, run])

  const reload = useCallback(() => run(true), [run])

  return { data, loading, error, reload, setData }
}
