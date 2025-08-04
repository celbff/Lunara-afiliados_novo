// app/affiliates/layout.tsx - Layout Específico do Sistema Afiliados
'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  Users,
  DollarSign,
  QrCode,
  BarChart3,
  Settings,
  Plus,
  ArrowLeft,
  UserPlus
} from 'lucide-react'

interface AffiliatesLayoutProps {
  children: React.ReactNode
}

const affiliatesNavigation = [
  {
    name: 'Dashboard',
    href: '/affiliates',
    icon: Users,
    description: 'Visão geral dos afiliados',
    color: 'purple'
  },
  {
    name: 'Gerenciar',
    href: '/affiliates/manage',
    icon: UserPlus,
    description: 'Cadastro e gestão de afiliados',
    badge: '24 ativos',
    color: 'purple'
  },
  {
    name: 'Comissões',
    href: '/affiliates/commissions',
    icon: DollarSign,
    description: 'Gestão de comissões',
    badge: 'R$ 1.240',
    color: 'green'
  },
  {
    name: 'Códigos',
    href: '/affiliates/codes',
    icon: QrCode,
    description: 'Códigos de referência',
    color: 'blue'
  },
  {
    name: 'Relatórios',
    href: '/affiliates/reports',
    icon: BarChart3,
    description: 'Relatórios e analytics',
    color: 'orange'
  },
  {
    name: 'Configurações',
    href: '/affiliates/settings',
    icon: Settings,
    description: 'Configurações do sistema',
    color: 'gray'
  }
]

export default function AffiliatesLayout({ children }: AffiliatesLayoutProps) {
  const pathname = usePathname()

  // Verificar qual página está ativa
  const currentPage = affiliatesNavigation.find(item => 
    pathname === item.href || (item.href !== '/affiliates' && pathname.startsWith(item.href))
  )

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors = {
      purple: {
        active: 'bg-purple-50 text-purple-700',
        icon: 'text-purple-600',
        badge: 'bg-purple-200 text-purple-800',
        border: 'bg-purple-600'
      },
      green: {
        active: 'bg-green-50 text-green-700',
        icon: 'text-green-600',
        badge: 'bg-green-200 text-green-800',
        border: 'bg-green-600'
      },
      blue: {
        active: 'bg-blue-50 text-blue-700',
        icon: 'text-blue-600',
        badge: 'bg-blue-200 text-blue-800',
        border: 'bg-blue-600'
      },
      orange: {
        active: 'bg-orange-50 text-orange-700',
        icon: 'text-orange-600',
        badge: 'bg-orange-200 text-orange-800',
        border: 'bg-orange-600'
      },
      gray: {
        active: 'bg-gray-50 text-gray-700',
        icon: 'text-gray-600',
        badge: 'bg-gray-200 text-gray-800',
        border: 'bg-gray-600'
      }
    }
    return colors[color as keyof typeof colors] || colors.purple
  }

  return (
    <div className="space-y-6">
      {/* Header do Sistema Afiliados */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard"
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="text-sm">Voltar ao Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-gray-300" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Users className="w-6 h-6 mr-2 text-purple-600" />
                Sistema Afiliados
              </h1>
              <p className="text-gray-600 text-sm">
                {currentPage?.description || 'Gestão de afiliações e comissões'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Badge className="bg-purple-100 text-purple-800">
              Lunara Afiliados
            </Badge>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Afiliado
            </Button>
          </div>
        </div>
      </div>

      {/* Navegação do Sistema Afiliados */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <nav className="flex space-x-1 p-2" aria-label="Tabs">
          {affiliatesNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href !== '/affiliates' && pathname.startsWith(item.href))
            
            const colorClasses = getColorClasses(item.color, isActive)
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group relative flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  isActive
                    ? colorClasses.active + " shadow-sm"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 mr-2 transition-colors",
                  isActive ? colorClasses.icon : "text-gray-400 group-hover:text-gray-600"
                )} />
                <span>{item.name}</span>
                {item.badge && (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "ml-2 text-xs",
                      isActive ? colorClasses.badge : "bg-gray-200 text-gray-700"
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
                {isActive && (
                  <div className={cn("absolute bottom-0 left-0 right-0 h-0.5 rounded-full", colorClasses.border)} />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Total Afiliados</p>
              <p className="text-lg font-semibold text-gray-900">24</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Comissões Hoje</p>
              <p className="text-lg font-semibold text-gray-900">R$ 1.240</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Novos Hoje</p>
              <p className="text-lg font-semibold text-gray-900">3</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">Performance</p>
              <p className="text-lg font-semibold text-gray-900">92%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo da Página */}
      <div>
        {children}
      </div>
    </div>
  )
}