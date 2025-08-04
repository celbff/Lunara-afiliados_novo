// hooks/useRequireAuth.ts
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './useAuth'
import { LoadingPage } from '@/components/ui/Loading'

export function useRequireAuth(redirectTo = '/auth/login') {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  if (loading) {
    return { loading: true, user: null }
  }

  if (!user) {
    return { loading: false, user: null }
  }

  return { loading: false, user }
}
