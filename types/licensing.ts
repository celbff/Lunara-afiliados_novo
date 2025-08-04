// types/licensing.ts - Tipos para Sistema de Licenciamento
export interface LicenseKey {
  id: string
  key: string
  type: 'free' | 'premium' | 'admin'
  status: 'active' | 'used' | 'expired' | 'revoked'
  created_at: string
  expires_at: string | null
  used_at: string | null
  used_by: string | null // user_id
  max_uses: number
  current_uses: number
  features: string[]
  metadata: {
    generated_by: string
    batch_id?: string
    notes?: string
  }
}

export interface UserLicense {
  id: string
  user_id: string
  license_key_id: string
  type: 'free' | 'premium' | 'admin'
  status: 'active' | 'expired' | 'suspended' | 'revoked'
  activated_at: string
  expires_at: string | null
  features: string[]
  limits: {
    max_patients: number
    max_appointments_per_month: number
    max_therapies: number
    max_storage_mb: number
    can_export: boolean
    can_bulk_import: boolean
    can_custom_reports: boolean
    can_integrations: boolean
    can_white_label: boolean
  }
  usage: {
    current_patients: number
    appointments_this_month: number
    current_therapies: number
    storage_used_mb: number
  }
  last_activity: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  phone?: string
  clinic_name?: string
  role: 'user' | 'admin' | 'master'
  status: 'active' | 'inactive' | 'suspended'
  license?: UserLicense
  preferences: {
    theme: 'light' | 'dark'
    language: 'pt' | 'en'
    notifications: {
      email: boolean
      sms: boolean
      push: boolean
    }
    timezone: string
  }
  created_at: string
  updated_at: string
  last_login: string | null
}

export interface AdminStats {
  total_users: number
  active_users: number
  premium_users: number
  free_users: number
  total_licenses_generated: number
  active_licenses: number
  expired_licenses: number
  revenue_this_month: number
  revenue_total: number
  top_features: Array<{ feature: string, usage_count: number }>
  user_growth: Array<{ date: string, new_users: number, total_users: number }>
  license_usage: Array<{ date: string, activations: number, expirations: number }>
}

export interface LicenseTemplate {
  id: string
  name: string
  type: 'free' | 'premium' | 'admin'
  duration_days: number | null // null = permanent
  features: string[]
  limits: UserLicense['limits']
  price: number
  description: string
  is_active: boolean
  created_at: string
}

export interface PaymentRecord {
  id: string
  user_id: string
  license_key_id: string
  amount: number
  currency: 'BRL' | 'USD'
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  payment_method: string
  transaction_id?: string
  created_at: string
  completed_at?: string
}

// Features disponíveis no sistema
export const AVAILABLE_FEATURES = [
  'unlimited_patients',
  'unlimited_appointments', 
  'unlimited_therapies',
  'advanced_reports',
  'data_export',
  'bulk_import',
  'email_notifications',
  'sms_notifications', 
  'calendar_integrations',
  'custom_branding',
  'api_access',
  'priority_support',
  'backup_restore',
  'multi_location',
  'team_collaboration'
] as const

export type FeatureKey = typeof AVAILABLE_FEATURES[number]

// Limites padrão por tipo de licença
export const DEFAULT_LIMITS = {
  free: {
    max_patients: 50,
    max_appointments_per_month: 100,
    max_therapies: 5,
    max_storage_mb: 100,
    can_export: false,
    can_bulk_import: false,
    can_custom_reports: false,
    can_integrations: false,
    can_white_label: false
  },
  premium: {
    max_patients: -1, // unlimited
    max_appointments_per_month: -1,
    max_therapies: -1,
    max_storage_mb: 5000,
    can_export: true,
    can_bulk_import: true,
    can_custom_reports: true,
    can_integrations: true,
    can_white_label: false
  },
  admin: {
    max_patients: -1,
    max_appointments_per_month: -1,
    max_therapies: -1,
    max_storage_mb: -1,
    can_export: true,
    can_bulk_import: true,
    can_custom_reports: true,
    can_integrations: true,
    can_white_label: true
  }
} as const

// Features por tipo de licença
export const FEATURES_BY_LICENSE = {
  free: [
    'basic_appointments',
    'basic_patients'
  ],
  premium: [
    'unlimited_patients',
    'unlimited_appointments',
    'unlimited_therapies',
    'advanced_reports',
    'data_export',
    'bulk_import',
    'email_notifications',
    'calendar_integrations',
    'backup_restore'
  ],
  admin: [
    ...FEATURES_BY_LICENSE.premium,
    'sms_notifications',
    'custom_branding',
    'api_access',
    'priority_support',
    'multi_location',
    'team_collaboration'
  ]
} as const