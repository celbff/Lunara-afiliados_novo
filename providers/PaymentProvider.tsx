'use client'

import React, { createContext, useContext, useState } from 'react'

interface PaymentPlan {
  id: string
  name: string
  type: 'premium' | 'admin'
  price: number
  duration_days: number
  features: string[]
  popular?: boolean
}

interface PaymentContextType {
  paymentPlans: PaymentPlan[]
  isProcessingPayment: boolean
  generatePixPayment: (planId: string, userId: string) => Promise<any>
  checkPaymentStatus: (paymentId: string) => Promise<string>
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined)

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [paymentPlans] = useState<PaymentPlan[]>([
    {
      id: 'premium_annual',
      name: 'Lunara Premium',
      type: 'premium',
      price: 97.00,
      duration_days: 365,
      features: [
        'Pacientes ilimitados',
        'Agendamentos ilimitados',
        'Relatórios avançados',
        'Exportação de dados',
        'Notificações por email',
        'Integrações de calendário'
      ],
      popular: true
    },
    {
      id: 'admin_annual',
      name: 'Lunara Master Admin',
      type: 'admin',
      price: 197.00,
      duration_days: 365,
      features: [
        'Todos os recursos Premium',
        'Painel administrativo',
        'Gestão de usuários',
        'Controle de licenças',
        'Notificações SMS',
        'Marca personalizada',
        'Acesso à API',
        'Suporte prioritário'
      ]
    }
  ])
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  const generatePixPayment = async (planId: string, userId: string) => {
    setIsProcessingPayment(true)
    try {
      const plan = paymentPlans.find(p => p.id === planId)
      if (!plan) throw new Error('Plano não encontrado')

      // Simular geração de pagamento PIX
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const paymentData = {
        paymentId: `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        qrCode: `00020101021126580014br.gov.bcb.pix0136lunara_terapias@jim.com${plan.price.toFixed(2).padStart(10, '0')}5204000053039865802BR5925Lunara Terapias6009SAO PAULO62070503***6304`,
        pixKey: 'lunara_terapias@jim.com',
        amount: plan.price,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }

      return paymentData
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const checkPaymentStatus = async (paymentId: string): Promise<string> => {
    // Simular verificação de pagamento
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Para demonstração, aprovar após 1 minuto
    const created = new Date().getTime() - 60000 // 1 minuto atrás
    return Date.now() - created > 0 ? 'approved' : 'pending'
  }

  return (
    <PaymentContext.Provider value={{
      paymentPlans,
      isProcessingPayment,
      generatePixPayment,
      checkPaymentStatus
    }}>
      {children}
    </PaymentContext.Provider>
  )
}

export function usePayment() {
  const context = useContext(PaymentContext)
  if (context === undefined) {
    throw new Error('usePayment deve ser usado dentro de PaymentProvider')
  }
  return context
}