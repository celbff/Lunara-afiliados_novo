// hooks/useLicensing.ts - Hook para gerenciar licenciamento
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { 
  User, 
  UserLicense, 
  LicenseKey, 
  AdminStats, 
  LicenseTemplate,
  PaymentRecord,
  FeatureKey 
} from '@/types/licensing'
import { DEFAULT_LIMITS, FEATURES_BY_LICENSE } from '@/types/licensing'

interface LicensingState {
  // Estado atual
  currentUser: User | null
  currentLicense: UserLicense | null
  isLoading: boolean
  error: string | null

  // Para Admin Master
  allUsers: User[]
  allLicenses: LicenseKey[]
  adminStats: AdminStats | null
  licenseTemplates: LicenseTemplate[]
  paymentRecords: PaymentRecord[]
  
  // Funções de usuário
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  activateLicense: (licenseKey: string) => Promise<void>
  checkLicenseValidity: () => boolean
  hasFeature: (feature: FeatureKey) => boolean
  canPerformAction: (action: string, currentCount?: number) => boolean
  updateProfile: (data: Partial<User>) => Promise<void>
  
  // Funções de Admin Master
  loadAdminData: () => Promise<void>
  generateLicenseKeys: (template: string, quantity: number) => Promise<LicenseKey[]>
  revokeLicense: (licenseId: string) => Promise<void>
  suspendUser: (userId: string) => Promise<void>
  activateUser: (userId: string) => Promise<void>
  updateUserLicense: (userId: string, licenseData: Partial<UserLicense>) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  sendNotificationToUser: (userId: string, message: string) => Promise<void>
  sendBulkNotification: (userIds: string[], message: string) => Promise<void>
  exportUserData: (userId: string) => Promise<Blob>
  getPaymentHistory: (userId?: string) => Promise<PaymentRecord[]>
  
  // Utilitários
  formatLicenseKey: (key: string) => string
  getLicenseStatusColor: (status: string) => string
  calculateDaysUntilExpiry: (expiryDate: string) => number
}

// Chaves Master pré-configuradas (você como desenvolvedor)
const MASTER_KEYS = [
  'MASTER-CELSO-2024-ADMIN-001',
  'MASTER-CELSO-2024-ADMIN-002',
  'MASTER-CELSO-2024-ADMIN-003'
]

// Chaves Premium de exemplo
const SAMPLE_PREMIUM_KEYS = [
  'PREM-2024-001-ABCD-EFGH',
  'PREM-2024-002-IJKL-MNOP',
  'PREM-2024-003-QRST-UVWX'
]

export const useLicensing = create<LicensingState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      currentUser: null,
      currentLicense: null,
      isLoading: false,
      error: null,
      allUsers: [],
      allLicenses: [],
      adminStats: null,
      licenseTemplates: [],
      paymentRecords: [],

      // Login
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          // Simular autenticação
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Verificar se é master key
          const isMaster = email === 'celso@admin.com' && password === 'master123'
          
          const user: User = {
            id: isMaster ? 'master-user-id' : `user-${Date.now()}`,
            email,
            name: isMaster ? 'Celso Bif (Master Admin)' : 'Usuário Demo',
            role: isMaster ? 'master' : 'user',
            status: 'active',
            clinic_name: isMaster ? 'Administração Geral' : 'Clínica Demo',
            preferences: {
              theme: 'light',
              language: 'pt',
              notifications: {
                email: true,
                sms: false,
                push: true
              },
              timezone: 'America/Sao_Paulo'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }

          // Se for master, criar licença administrativa
          if (isMaster) {
            const masterLicense: UserLicense = {
              id: 'master-license',
              user_id: user.id,
              license_key_id: 'master-key',
              type: 'admin',
              status: 'active',
              activated_at: new Date().toISOString(),
              expires_at: null, // Never expires
              features: FEATURES_BY_LICENSE.admin,
              limits: DEFAULT_LIMITS.admin,
              usage: {
                current_patients: 0,
                appointments_this_month: 0,
                current_therapies: 0,
                storage_used_mb: 0
              },
              last_activity: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            user.license = masterLicense
            set({ currentLicense: masterLicense })
          } else {
            // Usuário regular - verificar se tem licença ativa
            const freeLicense: UserLicense = {
              id: `license-${Date.now()}`,
              user_id: user.id,
              license_key_id: 'free-license',
              type: 'free',
              status: 'active',
              activated_at: new Date().toISOString(),
              expires_at: null,
              features: FEATURES_BY_LICENSE.free,
              limits: DEFAULT_LIMITS.free,
              usage: {
                current_patients: 5,
                appointments_this_month: 12,
                current_therapies: 3,
                storage_used_mb: 25
              },
              last_activity: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            user.license = freeLicense
            set({ currentLicense: freeLicense })
          }

          set({ currentUser: user, isLoading: false })
          
          // Se for master, carregar dados administrativos
          if (isMaster) {
            get().loadAdminData()
          }
          
        } catch (error) {
          set({ error: 'Erro ao fazer login', isLoading: false })
          throw error
        }
      },

      // Logout
      logout: () => {
        set({ 
          currentUser: null, 
          currentLicense: null,
          allUsers: [],
          allLicenses: [],
          adminStats: null
        })
      },

      // Ativar licença
      activateLicense: async (licenseKey: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const formattedKey = licenseKey.toUpperCase().trim()
          
          // Verificar se é chave master
          if (MASTER_KEYS.includes(formattedKey)) {
            const masterLicense: UserLicense = {
              id: `license-${Date.now()}`,
              user_id: get().currentUser!.id,
              license_key_id: formattedKey,
              type: 'admin',
              status: 'active',
              activated_at: new Date().toISOString(),
              expires_at: null,
              features: FEATURES_BY_LICENSE.admin,
              limits: DEFAULT_LIMITS.admin,
              usage: {
                current_patients: 0,
                appointments_this_month: 0,
                current_therapies: 0,
                storage_used_mb: 0
              },
              last_activity: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            set({ currentLicense: masterLicense })
            
            // Atualizar usuário para master
            const updatedUser = { ...get().currentUser!, role: 'master' as const }
            updatedUser.license = masterLicense
            set({ currentUser: updatedUser })
            
            return
          }
          
          // Verificar chaves premium
          if (SAMPLE_PREMIUM_KEYS.includes(formattedKey)) {
            const premiumLicense: UserLicense = {
              id: `license-${Date.now()}`,
              user_id: get().currentUser!.id,
              license_key_id: formattedKey,
              type: 'premium',
              status: 'active',
              activated_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 ano
              features: FEATURES_BY_LICENSE.premium,
              limits: DEFAULT_LIMITS.premium,
              usage: {
                current_patients: 0,
                appointments_this_month: 0,
                current_therapies: 0,
                storage_used_mb: 0
              },
              last_activity: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            set({ currentLicense: premiumLicense })
            
            // Atualizar usuário
            const updatedUser = { ...get().currentUser! }
            updatedUser.license = premiumLicense
            set({ currentUser: updatedUser })
            
            return
          }
          
          throw new Error('Chave de licença inválida')
          
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      // Verificar validade da licença
      checkLicenseValidity: () => {
        const license = get().currentLicense
        if (!license) return false
        
        if (license.status !== 'active') return false
        
        if (license.expires_at) {
          const expiryDate = new Date(license.expires_at)
          const now = new Date()
          return expiryDate > now
        }
        
        return true
      },

      // Verificar se tem feature
      hasFeature: (feature: FeatureKey) => {
        const license = get().currentLicense
        if (!license) return false
        
        return license.features.includes(feature)
      },

      // Verificar se pode realizar ação
      canPerformAction: (action: string, currentCount?: number) => {
        const license = get().currentLicense
        if (!license) return false
        
        if (!get().checkLicenseValidity()) return false
        
        switch (action) {
          case 'add_patient':
            return license.limits.max_patients === -1 || 
                   license.usage.current_patients < license.limits.max_patients
          
          case 'add_appointment':
            return license.limits.max_appointments_per_month === -1 ||
                   license.usage.appointments_this_month < license.limits.max_appointments_per_month
          
          case 'add_therapy':
            return license.limits.max_therapies === -1 ||
                   license.usage.current_therapies < license.limits.max_therapies
          
          case 'export_data':
            return license.limits.can_export
          
          case 'bulk_import':
            return license.limits.can_bulk_import
          
          case 'custom_reports':
            return license.limits.can_custom_reports
          
          case 'integrations':
            return license.limits.can_integrations
          
          default:
            return true
        }
      },

      // Atualizar perfil
      updateProfile: async (data: Partial<User>) => {
        const currentUser = get().currentUser
        if (!currentUser) return
        
        const updatedUser = { ...currentUser, ...data, updated_at: new Date().toISOString() }
        set({ currentUser: updatedUser })
      },

      // ==================== FUNÇÕES DE ADMIN MASTER ====================

      // Carregar dados administrativos
      loadAdminData: async () => {
        if (get().currentUser?.role !== 'master') return
        
        set({ isLoading: true })
        
        try {
          // Simular carregamento de dados
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Dados simulados
          const mockUsers: User[] = [
            {
              id: 'user-1',
              email: 'joao@clinica.com',
              name: 'Dr. João Silva',
              role: 'user',
              status: 'active',
              clinic_name: 'Clínica João Silva',
              license: {
                id: 'lic-1',
                user_id: 'user-1',
                license_key_id: 'PREM-2024-001-ABCD-EFGH',
                type: 'premium',
                status: 'active',
                activated_at: '2024-01-15T10:00:00Z',
                expires_at: '2025-01-15T10:00:00Z',
                features: FEATURES_BY_LICENSE.premium,
                limits: DEFAULT_LIMITS.premium,
                usage: {
                  current_patients: 45,
                  appointments_this_month: 120,
                  current_therapies: 8,
                  storage_used_mb: 250
                },
                last_activity: '2024-07-30T15:30:00Z',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-07-30T15:30:00Z'
              },
              preferences: {
                theme: 'light',
                language: 'pt',
                notifications: { email: true, sms: false, push: true },
                timezone: 'America/Sao_Paulo'
              },
              created_at: '2024-01-15T10:00:00Z',
              updated_at: '2024-07-30T15:30:00Z',
              last_login: '2024-07-30T08:00:00Z'
            },
            {
              id: 'user-2',
              email: 'maria@terapias.com',
              name: 'Dra. Maria Santos',
              role: 'user',
              status: 'active',
              clinic_name: 'Terapias Integrativas Maria',
              license: {
                id: 'lic-2',
                user_id: 'user-2',
                license_key_id: 'free-license',
                type: 'free',
                status: 'active',
                activated_at: '2024-06-01T14:00:00Z',
                expires_at: null,
                features: FEATURES_BY_LICENSE.free,
                limits: DEFAULT_LIMITS.free,
                usage: {
                  current_patients: 35,
                  appointments_this_month: 85,
                  current_therapies: 4,
                  storage_used_mb: 80
                },
                last_activity: '2024-07-30T14:20:00Z',
                created_at: '2024-06-01T14:00:00Z',
                updated_at: '2024-07-30T14:20:00Z'
              },
              preferences: {
                theme: 'dark',
                language: 'pt',
                notifications: { email: true, sms: true, push: false },
                timezone: 'America/Sao_Paulo'
              },
              created_at: '2024-06-01T14:00:00Z',
              updated_at: '2024-07-30T14:20:00Z',
              last_login: '2024-07-30T12:00:00Z'
            }
          ]

          const mockStats: AdminStats = {
            total_users: mockUsers.length,
            active_users: mockUsers.filter(u => u.status === 'active').length,
            premium_users: mockUsers.filter(u => u.license?.type === 'premium').length,
            free_users: mockUsers.filter(u => u.license?.type === 'free').length,
            total_licenses_generated: 150,
            active_licenses: 120,
            expired_licenses: 30,
            revenue_this_month: 15000,
            revenue_total: 85000,
            top_features: [
              { feature: 'advanced_reports', usage_count: 45 },
              { feature: 'data_export', usage_count: 38 },
              { feature: 'unlimited_patients', usage_count: 32 }
            ],
            user_growth: [
              { date: '2024-01', new_users: 15, total_users: 15 },
              { date: '2024-02', new_users: 12, total_users: 27 },
              { date: '2024-03', new_users: 18, total_users: 45 }
            ],
            license_usage: [
              { date: '2024-07-01', activations: 5, expirations: 2 },
              { date: '2024-07-15', activations: 8, expirations: 1 },
              { date: '2024-07-30', activations: 3, expirations: 0 }
            ]
          }

          const mockLicenses: LicenseKey[] = [
            ...MASTER_KEYS.map((key, index) => ({
              id: `master-${index}`,
              key,
              type: 'admin' as const,
              status: 'active' as const,
              created_at: '2024-01-01T00:00:00Z',
              expires_at: null,
              used_at: null,
              used_by: null,
              max_uses: 1,
              current_uses: 0,
              features: FEATURES_BY_LICENSE.admin,
              metadata: { generated_by: 'system', notes: 'Master key for Celso Bif' }
            })),
            ...SAMPLE_PREMIUM_KEYS.map((key, index) => ({
              id: `premium-${index}`,
              key,
              type: 'premium' as const,
              status: index === 0 ? 'used' as const : 'active' as const,
              created_at: '2024-01-01T00:00:00Z',
              expires_at: '2025-01-01T00:00:00Z',
              used_at: index === 0 ? '2024-01-15T10:00:00Z' : null,
              used_by: index === 0 ? 'user-1' : null,
              max_uses: 1,
              current_uses: index === 0 ? 1 : 0,
              features: FEATURES_BY_LICENSE.premium,
              metadata: { generated_by: 'admin', batch_id: 'batch-001' }
            }))
          ]

          set({ 
            allUsers: mockUsers,
            allLicenses: mockLicenses,
            adminStats: mockStats,
            isLoading: false 
          })
          
        } catch (error) {
          set({ error: 'Erro ao carregar dados administrativos', isLoading: false })
        }
      },

      // Gerar chaves de licença
      generateLicenseKeys: async (template: string, quantity: number) => {
        const keys: LicenseKey[] = []
        
        for (let i = 0; i < quantity; i++) {
          const key = `${template}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
          
          keys.push({
            id: `generated-${Date.now()}-${i}`,
            key,
            type: template.includes('PREM') ? 'premium' : 'free',
            status: 'active',
            created_at: new Date().toISOString(),
            expires_at: template.includes('PREM') ? 
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
            used_at: null,
            used_by: null,
            max_uses: 1,
            current_uses: 0,
            features: template.includes('PREM') ? FEATURES_BY_LICENSE.premium : FEATURES_BY_LICENSE.free,
            metadata: {
              generated_by: get().currentUser!.id,
              notes: `Generated via admin panel`
            }
          })
        }
        
        const currentLicenses = get().allLicenses
        set({ allLicenses: [...currentLicenses, ...keys] })
        
        return keys
      },

      // Revogar licença
      revokeLicense: async (licenseId: string) => {
        const licenses = get().allLicenses.map(license => 
          license.id === licenseId 
            ? { ...license, status: 'revoked' as const }
            : license
        )
        set({ allLicenses: licenses })
      },

      // Suspender usuário
      suspendUser: async (userId: string) => {
        const users = get().allUsers.map(user => 
          user.id === userId 
            ? { ...user, status: 'suspended' as const }
            : user
        )
        set({ allUsers: users })
      },

      // Ativar usuário
      activateUser: async (userId: string) => {
        const users = get().allUsers.map(user => 
          user.id === userId 
            ? { ...user, status: 'active' as const }
            : user
        )
        set({ allUsers: users })
      },

      // Atualizar licença do usuário
      updateUserLicense: async (userId: string, licenseData: Partial<UserLicense>) => {
        const users = get().allUsers.map(user => 
          user.id === userId && user.license
            ? { ...user, license: { ...user.license, ...licenseData } }
            : user
        )
        set({ allUsers: users })
      },

      // Deletar usuário
      deleteUser: async (userId: string) => {
        const users = get().allUsers.filter(user => user.id !== userId)
        set({ allUsers: users })
      },

      // Enviar notificação para usuário
      sendNotificationToUser: async (userId: string, message: string) => {
        // Simular envio de notificação
        console.log(`Notification sent to user ${userId}: ${message}`)
      },

      // Enviar notificação em massa
      sendBulkNotification: async (userIds: string[], message: string) => {
        // Simular envio em massa
        console.log(`Bulk notification sent to ${userIds.length} users: ${message}`)
      },

      // Exportar dados do usuário
      exportUserData: async (userId: string) => {
        const user = get().allUsers.find(u => u.id === userId)
        if (!user) throw new Error('Usuário não encontrado')
        
        const data = JSON.stringify(user, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        return blob
      },

      // Obter histórico de pagamentos
      getPaymentHistory: async (userId?: string) => {
        // Simular dados de pagamento
        const mockPayments: PaymentRecord[] = [
          {
            id: 'pay-1',
            user_id: 'user-1',
            license_key_id: 'PREM-2024-001-ABCD-EFGH',
            amount: 299.90,
            currency: 'BRL',
            status: 'completed',
            payment_method: 'credit_card',
            transaction_id: 'tx-123456',
            created_at: '2024-01-15T10:00:00Z',
            completed_at: '2024-01-15T10:05:00Z'
          }
        ]
        
        return userId 
          ? mockPayments.filter(p => p.user_id === userId)
          : mockPayments
      },

      // ==================== UTILITÁRIOS ====================

      // Formatar chave de licença
      formatLicenseKey: (key: string) => {
        return key.replace(/(.{4})/g, '$1-').slice(0, -1)
      },

      // Cor do status da licença
      getLicenseStatusColor: (status: string) => {
        switch (status) {
          case 'active': return 'green'
          case 'expired': return 'red'
          case 'suspended': return 'yellow'
          case 'revoked': return 'gray'
          default: return 'blue'
        }
      },

      // Calcular dias até expirar
      calculateDaysUntilExpiry: (expiryDate: string) => {
        const expiry = new Date(expiryDate)
        const now = new Date()
        const diffTime = expiry.getTime() - now.getTime()
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }
    }),
    {
      name: 'licensing-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentLicense: state.currentLicense
      })
    }
  )
)