'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LicensingProvider } from '@/providers/LicensingProvider'
import { PaymentProvider } from '@/providers/PaymentProvider'
import { NotificationProvider } from '@/providers/NotificationProvider'

interface ClientProvidersProps {
  children: React.ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutos
        cacheTime: 10 * 60 * 1000, // 10 minutos
        retry: 3,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <LicensingProvider>
        <PaymentProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </PaymentProvider>
      </LicensingProvider>
    </QueryClientProvider>
  )
}