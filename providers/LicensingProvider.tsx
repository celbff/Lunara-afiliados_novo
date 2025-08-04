'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface License {
  id: string
  type: 'premium' | 'admin'
  key: string
  isActive: boolean
  expiresAt: string
  features: string[]
}

interface LicensingContextType {
  currentLicense: License | null
  isLoading: boolean
  hasFeature: (feature: string) => boolean
  activateLicense: (key: string) => Promise<boolean>
  deactivateLicense: () => void
}

const LicensingContext = createContext<LicensingContextType | undefined>(undefined)

export function LicensingProvider({ children }: { children: React.ReactNode }) {
  const [currentLicense, setCurrentLicense] = useState<License | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Carregar licença salva do localStorage
    const savedLicense = localStorage.getItem('lunara_license')
    if (savedLicense) {
      try {
        const license = JSON.parse(savedLicense)
        if (new Date(license.expiresAt) > new Date()) {
          setCurrentLicense(license)
        } else {
          localStorage.removeItem('lunara_license')
        }
      } catch (error) {
        console.error('Erro ao carregar licença:', error)
      }
    }
    setIsLoading(false)
  }, [])

  const hasFeature = (feature: string): boolean => {
    if (!currentLicense || !currentLicense.isActive) return false
    return currentLicense.features.includes(feature)
  }

  const activateLicense = async (key: string): Promise<boolean> => {
    try {
      // Simulação de validação de licença
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Licenças de teste
      const mockLicenses: { [key: string]: Omit<License, 'id'> } = {
        'PREMIUM-2024': {
          type: 'premium',
          key: 'PREMIUM-2024',
          isActive: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          features: ['patient_management', 'appointment_scheduling', 'reports', 'exports']
        },
        'ADMIN-2024': {
          type: 'admin',
          key: 'ADMIN-2024',
          isActive: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          features: ['patient_management', 'appointment_scheduling', 'reports', 'exports', 'admin_panel', 'user_management', 'license_control']
        }
      }

      const licenseData = mockLicenses[key]
      if (licenseData) {
        const license: License = {
          id: Date.now().toString(),
          ...licenseData
        }
        
        setCurrentLicense(license)
        localStorage.setItem('lunara_license', JSON.stringify(license))
        return true
      }
      
      return false
    } catch (error) {
      console.error('Erro ao ativar licença:', error)
      return false
    }
  }

  const deactivateLicense = () => {
    setCurrentLicense(null)
    localStorage.removeItem('lunara_license')
  }

  return (
    <LicensingContext.Provider value={{
      currentLicense,
      isLoading,
      hasFeature,
      activateLicense,
      deactivateLicense
    }}>
      {children}
    </LicensingContext.Provider>
  )
}

export function useLicensing() {
  const context = useContext(LicensingContext)
  if (context === undefined) {
    throw new Error('useLicensing deve ser usado dentro de LicensingProvider')
  }
  return context
}