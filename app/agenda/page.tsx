// app/agenda/page.tsx - Dashboard Principal do Sistema Agenda
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  Calendar,
  Clock,
  Users,
  Stethoscope,
  TrendingUp,
  Activity,
  Plus,
  CalendarDays,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'

interface AgendaStats {
  agendamentosHoje: number
  proximoHorario: string
  pacientesAtivos: number
  terapiasAtivas: number
  taxaOcupacao: number
  faturamentoHoje: number
  sessoesConcluidas: number
  pacientesAgendados: number
}

export default function AgendaDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stats, setStats] = useState<AgendaStats>({
    agendamentosHoje: 8,
    proximoHorario: '09:00',
    pacientesAtivos: 156,
    terapiasAtivas: 12,
    taxaOcupacao: 85,
    faturamentoHoje: 1450.00,
    sessoesConcluidas: 5,
    pacientesAgendados: 8
  })

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Mock dos próximos agendamentos - será substituído por dados do Supabase
  const proximosAgendamentos = [
    {
      id: 1,
      paciente: 'Maria Silva',
      terapia: 'Fisioterapia',
      horario: '09:00',
      status: 'confirmado',
      cor: '#3B82F6'
    },
    {
      id: 2,
      paciente: 'João Santos',
      terapia: 'Acupuntura',
      horario: '10:30',
      status: 'pendente',
      cor: '#10B981'
    },
    {
      id: 3,
      paciente: 'Ana Costa',
      terapia: 'Massoterapia',
      horario: '14:00',
      status: 'confirmado',
      cor: '#F59E0B'
    }
  ]

  const acoesPrincipais = [
    {
      titulo: 'Calendário Completo',
      descricao: 'Visualizar e gerenciar todos os agendamentos',
      href: '/agenda/calendar',
      icon: CalendarDays,
      cor: 'blue'
    },
    {
      titulo: 'Novo Agendamento',
      descricao: 'Agendar nova consulta ou terapia',
      href: '/agenda/appointments/new',
      icon: Plus,
      cor: 'green'
    },
    {
      titulo: 'Gerenciar Pacientes',
      descricao: 'Cadastrar e editar informações de pacientes',
      href: '/agenda/patients',
      icon: Users,
      cor: 'purple'
    },
    {
      titulo: 'Configurar Terapias',
      descricao: 'Gerenciar tipos de tratamento disponíveis',
      href: '/agenda/therapies',
      icon: Stethoscope,
      cor: 'orange'
    }
  ]

  const getCorClasses = (cor: string) => {
    const cores = {
      blue: {
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        hover: 'hover:bg-blue-100'
      },
      green: {
        bg: 'bg-green-50',
        icon: 'text-green-600',
        hover: 'hover:bg-green-100'
      },
      purple: {
        bg: 'bg-purple-50',
        icon: 'text-purple-600',
        hover: 'hover:bg-purple-100'
      },
      orange: {
        bg: 'bg-orange-50',
        icon: 'text-orange-600',
        hover: 'hover:bg-orange-100'
      }
    }
    return cores[cor as keyof typeof cores] || cores.blue
  }

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Agendamentos Hoje */}
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Agendamentos Hoje</p>
                <p className="text-3xl font-bold">{stats.agendamentosHoje}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-200" />
            </div>
            <div className="mt-4 flex items-center">
              <Clock className="w-4 h-4 text-blue-200 mr-1" />
              <span className="text-blue-100 text-sm">
                Próximo: {stats.proximoHorario}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pacientes Ativos */}
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Pacientes Ativos</p>
                <p className="text-3xl font-bold">{stats.pacientesAtivos}</p>
              </div>
              <Users className="w-8 h-8 text-green-200" />
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-200 mr-1" />
              <span className="text-green-100 text-sm">
                +12 este mês
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Ocupação */}
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Taxa de Ocupação</p>
                <p className="text-3xl font-bold">{stats.taxaOcupacao}%</p>
              </div>
              <Activity className="w-8 h-8 text-purple-200" />
            </div>
            <div className="mt-4">
              <div className="w-full bg-purple-400 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${stats.taxaOcupacao}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Faturamento Hoje */}
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Faturamento Hoje</p>
                <p className="text-3xl font-bold">
                  R$ {stats.faturamentoHoje.toLocaleString('pt-BR')}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-200" />
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-orange-100 text-sm">
                {stats.sessoesConcluidas} sessões concluídas
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Próximos Agendamentos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Próximos Agendamentos
                </CardTitle>
                <CardDescription>
                  Agendamentos para hoje - {currentTime.toLocaleDateString('pt-BR')}
                </CardDescription>
              </div>
              <Link href="/agenda/calendar">
                <Button variant="outline" size="sm">
                  Ver Calendário
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximosAgendamentos.map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div
                    className="w-4 h-4 rounded-full mr-4"
                    style={{ backgroundColor: agendamento.cor }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">
                        {agendamento.paciente}
                      </h4>
                      <span className="text-sm font-medium text-gray-600">
                        {agendamento.horario}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-600">
                        {agendamento.terapia}
                      </p>
                      <Badge 
                        variant={agendamento.status === 'confirmado' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {agendamento.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
              
              {proximosAgendamentos.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum agendamento para hoje</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ações Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-600" />
              Ações Rápidas
            </CardTitle>
            <CardDescription>
              Acesso rápido às principais funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acoesPrincipais.map((acao, index) => {
                const Icon = acao.icon
                const corClasses = getCorClasses(acao.cor)
                
                return (
                  <Link key={index} href={acao.href}>
                    <div className={`p-4 rounded-lg border border-gray-200 ${corClasses.bg} ${corClasses.hover} transition-colors cursor-pointer`}>
                      <div className="flex items-start">
                        <Icon className={`w-5 h-5 mr-3 mt-0.5 ${corClasses.icon}`} />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {acao.titulo}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {acao.descricao}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo do Dia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Resumo do Dia
          </CardTitle>
          <CardDescription>
            Visão geral da performance de hoje
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.agendamentosHoje}</p>
              <p className="text-sm text-gray-600">Agendamentos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.sessoesConcluidas}</p>
              <p className="text-sm text-gray-600">Concluídas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.pacientesAgendados}</p>
              <p className="text-sm text-gray-600">Pacientes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                R$ {stats.faturamentoHoje.toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-gray-600">Faturamento</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}