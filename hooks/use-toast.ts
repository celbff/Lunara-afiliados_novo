'use client'

import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

// Estado global dos toasts (simplificado para desenvolvimento)
let toastQueue: Toast[] = []
let toastListeners: Array<(toasts: Toast[]) => void> = []

const addToast = (toast: Toast) => {
  toastQueue = [toast, ...toastQueue]
  toastListeners.forEach(listener => listener(toastQueue))
  
  // Auto-remover após duração especificada
  setTimeout(() => {
    removeToast(toast.id)
  }, toast.duration || 5000)
}

const removeToast = (id: string) => {
  toastQueue = toastQueue.filter(toast => toast.id !== id)
  toastListeners.forEach(listener => listener(toastQueue))
}

export function toast(options: ToastOptions) {
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
  
  const toastData: Toast = {
    id,
    title: options.title,
    description: options.description,
    variant: options.variant || 'default',
    duration: options.duration || 5000
  }
  
  addToast(toastData)
  
  return {
    id,
    dismiss: () => removeToast(id)
  }
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(toastQueue)
  
  const subscribe = useCallback((listener: (toasts: Toast[]) => void) => {
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener)
    }
  }, [])
  
  const dismiss = useCallback((toastId?: string) => {
    if (toastId) {
      removeToast(toastId)
    } else {
      // Remover todos
      toastQueue = []
      toastListeners.forEach(listener => listener([]))
    }
  }, [])
  
  return {
    toasts,
    toast,
    dismiss
  }
}