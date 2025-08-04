// components/providers.tsx - Providers Centralizados
'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/hooks/useAuth'
import { LicensingProvider } from '@/hooks/useLicensing'
import { PaymentProvider } from '@/hooks/usePayment'
import { NotificationProvider } from '@/hooks/useNotifications'

export function Providers({ children }: { children: React.ReactNode }) {
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
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <LicensingProvider>
            <PaymentProvider>
              <NotificationProvider>
                {children}
              </NotificationProvider>
            </PaymentProvider>
          </LicensingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}