'use client'

import { useEffect, useState } from 'react'
import { useToast, Toast } from '@/hooks/use-toast'

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  useEffect(() => {
    // Simples sistema de toasts para desenvolvimento
    const handleStorageChange = () => {
      const storedToasts = localStorage.getItem('lunara_toasts')
      if (storedToasts) {
        try {
          setToasts(JSON.parse(storedToasts))
        } catch (e) {
          // ignore
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])
  
  if (toasts.length === 0) return null
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg p-4 shadow-lg transition-all duration-300 ease-in-out
            ${toast.variant === 'destructive' 
              ? 'bg-red-500 text-white' 
              : 'bg-white text-gray-900 border border-gray-200'
            }
            max-w-sm animate-in slide-in-from-right-full
          `}
        >
          {toast.title && (
            <div className="font-semibold text-sm mb-1">
              {toast.title}
            </div>
          )}
          {toast.description && (
            <div className="text-sm opacity-90">
              {toast.description}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}