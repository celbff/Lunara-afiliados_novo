// app/agenda/layout.tsx - Layout Específico do Sistema Agenda
'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  Calendar,
  Users,
  Stethoscope,
  Clock,
  CalendarDays,
  Plus,
  ArrowLeft
} from 'lucide-react'

interface AgendaLayoutProps {
  children: React.ReactNode
}

const agendaNavigation = [
  {
    name: 'Dashboard',
    href: '/agenda',
    icon: Calendar,
    description: 'Visão geral da agenda'
  },
  {
    name: 'Calendário',
    href: '/agenda/calendar',
    icon: CalendarDays,
    description: 'Visualização em calendário'
  },
  {
    name: 'Agendamentos',
    href: '/agenda/appointments',
    icon: Clock,
    description: 'Gestão de agendamentos',
    badge: '8 hoje'
  },
  {
    name: 'Pacientes',
    href: '/agenda/patients',
    icon: Users,
    description: 'Cadastro de pacientes',
    badge: '156 ativos'
  },
  {
    name: 'Terapias',
    href: '/agenda/therapies',
    icon: Stethoscope,
    description: 'Tipos de tratamento'
  }
]

export default function AgendaLayout({ children }: AgendaLayoutProps) {
  const pathname = usePathname()

  // Verificar qual página está ativa
  const currentPage = agendaNavigation.find(item => 
    pathname === item.href || (item.href !== '/agenda' && pathname.startsWith(item.href))
  )

  return (
    <div className="space-y-6">
      {/* Header do Sistema Agenda */}
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
                <Calendar className="w-6 h-6 mr-2 text-blue-600" />
                Sistema Agenda
              </h1>
              <p className="text-gray-600 text-sm">
                {currentPage?.description || 'Gestão completa de agendamentos'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Badge className="bg-blue-100 text-blue-800">
              AgendaV2
            </Badge>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </div>
      </div>

      {/* Navegação do Sistema Agenda */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <nav className="flex space-x-1 p-2" aria-label="Tabs">
          {agendaNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href !== '/agenda' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group relative flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 mr-2 transition-colors",
                  isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                )} />
                <span>{item.name}</span>
                {item.badge && (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "ml-2 text-xs",
                      isActive ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-700"
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Conteúdo da Página */}
      <div>
        {children}
      </div>
    </div>
  )
}