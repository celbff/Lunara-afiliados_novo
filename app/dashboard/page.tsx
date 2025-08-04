// app/dashboard/page.tsx - Dashboard Unificado
'use client'

import { Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLicensing } from '@/hooks/useLicensing'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { PatientOverview } from '@/components/dashboard/PatientOverview'
import { AppointmentCalendar } from '@/components/dashboard/AppointmentCalendar'
import { PaymentPlansManager } from '@/components/PaymentPlansManager'
import { LicenseActivation } from '@/components/LicenseActivation'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Card, CardContent } from '@/components/ui/Card'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  Calendar, 
  Users, 
  UserCheck,
  DollarSign,
  Activity,
  TrendingUp,
  Clock,
  Heart,
  Star,
  Target
} from 'lucide-react'

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { currentLicense, hasFeature, isLoading: licenseLoading } = useLicensing()

   if (authLoading || licenseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
 return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Estatísticas Principais */}
        <Suspense fallback={<Card className="h-32 animate-pulse" />}>
          <DashboardStats />
        </Suspense>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gráficos */}
            <Suspense fallback={<Card className="h-96 animate-pulse" />}>
              <DashboardCharts />
            </Suspense>

            {/* Visão Geral de Pacientes */}
            {hasFeature('patient_management') && (
              <Suspense fallback={<Card className="h-64 animate-pulse" />}>
                <PatientOverview />
              </Suspense>
            )}

            {/* Calendário de Agendamentos */}
            {hasFeature('appointment_scheduling') && (
              <Suspense fallback={<Card className="h-96 animate-pulse" />}>
                <AppointmentCalendar />
              </Suspense>
            )}

            {/* Gerenciamento de Planos (Apenas Admin) */}
            {hasFeature('admin_panel') && (
              <Suspense fallback={<Card className="h-64 animate-pulse" />}>
                <PaymentPlansManager />
              </Suspense>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Ações Rápidas */}
            <Suspense fallback={<Card className="h-48 animate-pulse" />}>
              <QuickActions />
            </Suspense>

            {/* Atividades Recentes */}
            <Suspense fallback={<Card className="h-64 animate-pulse" />}>
              <RecentActivities />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Modals */}
      <LicenseActivation />
    </div>
  )
}
export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userName] = useState('Dr. Silva') // Virá do contexto de auth

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Mock data - será substituído por dados reais do Supabase
  const dashboardData = {
    agenda: {
      agendamentosHoje: 8,
      proximoHorario: '09:00',
      pacientesAtivos: 156,
      taxaOcupacao: 85
    },
    afiliados: {
      totalAfiliados: 24,
      comissoesHoje: 1240.50,
      novosCadastros: 3,
      performanceMedia: 92
    },
    terapeutas: {
      terapeutasAtivos: 12,
      sessoesConcluidas: 45,
      avaliacaoMedia: 4.8,
      metaMensal: 78
    },
    financeiro: {
      receitaDiaria: 2850.00,
      receitaMensal: 45600.00,
      crescimento: 15.8,
      pendencias: 2
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com boas-vindas */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Olá, {userName}! 👋
          </h1>
          <p className="text-gray-600">
            {currentTime.toLocaleDateString('pt-BR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} - {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Button variant="outline">
            <Activity className="w-4 h-4 mr-2" />
            Relatórios
          </Button>
          <Button>
            <Calendar className="w-4 h-4 mr-2" />
            Agenda
          </Button>
        </div>
      </div>

      {/* Cards de Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Receita Diária */}
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Receita Hoje</p>
                <p className="text-2xl font-bold">
                  R$ {dashboardData.financeiro.receitaDiaria.toLocaleString('pt-BR')}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-100" />
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-100 mr-1" />
              <span className="text-green-100 text-sm">
                +{dashboardData.financeiro.crescimento}% vs. ontem
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Agendamentos */}
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Agendamentos Hoje</p>
                <p className="text-2xl font-bold">{dashboardData.agenda.agendamentosHoje}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-100" />
            </div>
            <div className="mt-4 flex items-center">
              <Clock className="w-4 h-4 text-blue-100 mr-1" />
              <span className="text-blue-100 text-sm">
                Próximo: {dashboardData.agenda.proximoHorario}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Afiliados */}
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Afiliados Ativos</p>
                <p className="text-2xl font-bold">{dashboardData.afiliados.totalAfiliados}</p>
              </div>
              <Users className="w-8 h-8 text-purple-100" />
            </div>
            <div className="mt-4 flex items-center">
              <UserCheck className="w-4 h-4 text-purple-100 mr-1" />
              <span className="text-purple-100 text-sm">
                +{dashboardData.afiliados.novosCadastros} novos hoje
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Terapeutas */}
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Terapeutas</p>
                <p className="text-2xl font-bold">{dashboardData.terapeutas.terapeutasAtivos}</p>
              </div>
              <Heart className="w-8 h-8 text-orange-100" />
            </div>
            <div className="mt-4 flex items-center">
              <Star className="w-4 h-4 text-orange-100 mr-1" />
              <span className="text-orange-100 text-sm">
                {dashboardData.terapeutas.avaliacaoMedia}★ avaliação
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Sistemas Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SISTEMA AGENDA */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  Sistema Agenda
                </CardTitle>
                <CardDescription>Gestão completa de agendamentos</CardDescription>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Ativo</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-blue-600 font-medium">Hoje</p>
                <p className="text-2xl font-bold text-blue-800">{dashboardData.agenda.agendamentosHoje}</p>
                <p className="text-blue-600 text-xs">agendamentos</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-green-600 font-medium">Ocupação</p>
                <p className="text-2xl font-bold text-green-800">{dashboardData.agenda.taxaOcupacao}%</p>
                <p className="text-green-600 text-xs">da agenda</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pacientes ativos</span>
                <span className="font-semibold">{dashboardData.agenda.pacientesAtivos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Próximo horário</span>
                <span className="font-semibold text-blue-600">{dashboardData.agenda.proximoHorario}</span>
              </div>
            </div>

            <Button className="w-full" onClick={() => window.location.href = '/agenda'}>
              <Calendar className="w-4 h-4 mr-2" />
              Abrir Agenda
            </Button>
          </CardContent>
        </Card>

        {/* SISTEMA AFILIADOS */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2 text-purple-600" />
                  Sistema Afiliados
                </CardTitle>
                <CardDescription>Gestão de afiliações e comissões</CardDescription>
              </div>
              <Badge className="bg-purple-100 text-purple-800">Ativo</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-purple-600 font-medium">Comissões</p>
                <p className="text-2xl font-bold text-purple-800">
                  R$ {dashboardData.afiliados.comissoesHoje.toLocaleString('pt-BR')}
                </p>
                <p className="text-purple-600 text-xs">hoje</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-green-600 font-medium">Performance</p>
                <p className="text-2xl font-bold text-green-800">{dashboardData.afiliados.performanceMedia}%</p>
                <p className="text-green-600 text-xs">média</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total afiliados</span>
                <span className="font-semibold">{dashboardData.afiliados.totalAfiliados}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Novos cadastros</span>
                <span className="font-semibold text-purple-600">+{dashboardData.afiliados.novosCadastros}</span>
              </div>
            </div>

            <Button className="w-full" onClick={() => window.location.href = '/affiliates'}>
              <Users className="w-4 h-4 mr-2" />
              Abrir Afiliados
            </Button>
          </CardContent>
        </Card>

        {/* SISTEMA TERAPEUTAS */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-orange-600" />
                  Sistema Terapeutas
                </CardTitle>
                <CardDescription>Gestão de terapeutas e práticas</CardDescription>
              </div>
              <Badge className="bg-orange-100 text-orange-800">Ativo</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-orange-50 p-3 rounded-lg">
                <p className="text-orange-600 font-medium">Sessões</p>
                <p className="text-2xl font-bold text-orange-800">{dashboardData.terapeutas.sessoesConcluidas}</p>
                <p className="text-orange-600 text-xs">concluídas</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-yellow-600 font-medium">Meta</p>
                <p className="text-2xl font-bold text-yellow-800">{dashboardData.terapeutas.metaMensal}%</p>
                <p className="text-yellow-600 text-xs">mensal</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Terapeutas ativos</span>
                <span className="font-semibold">{dashboardData.terapeutas.terapeutasAtivos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avaliação média</span>
                <span className="font-semibold text-orange-600">{dashboardData.terapeutas.avaliacaoMedia}★</span>
              </div>
            </div>

            <Button className="w-full" onClick={() => window.location.href = '/therapists'}>
              <Heart className="w-4 h-4 mr-2" />
              Abrir Terapeutas
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Resumo Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Resumo Financeiro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-600" />
              Resumo Financeiro
            </CardTitle>
            <CardDescription>Visão geral das finanças do dia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-green-600 text-sm font-medium">Receita Diária</p>
                <p className="text-2xl font-bold text-green-800">
                  R$ {dashboardData.financeiro.receitaDiaria.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-600 text-sm font-medium">Receita Mensal</p>
                <p className="text-2xl font-bold text-blue-800">
                  R$ {dashboardData.financeiro.receitaMensal.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Crescimento</span>
                <span className="text-green-600 font-semibold">+{dashboardData.financeiro.crescimento}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pendências</span>
                <Badge variant={dashboardData.financeiro.pendencias > 0 ? "destructive" : "default"}>
                  {dashboardData.financeiro.pendencias}
                </Badge>
              </div>
            </div>

            <Button variant="outline" className="w-full">
              <Activity className="w-4 h-4 mr-2" />
              Ver Relatório Completo
            </Button>
          </CardContent>
        </Card>

        {/* Atividade Recente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              Atividade Recente
            </CardTitle>
            <CardDescription>Últimas ações no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Agendamento confirmado</p>
                  <p className="text-xs text-gray-500">Maria Silva - Fisioterapia às 09:00</p>
                  <p className="text-xs text-gray-400">há 5 minutos</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Novo afiliado cadastrado</p>
                  <p className="text-xs text-gray-500">João Santos - Código: JS2025</p>
                  <p className="text-xs text-gray-400">há 15 minutos</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Sessão concluída</p>
                  <p className="text-xs text-gray-500">Dr. Ana - Acupuntura com Carlos Lima</p>
                  <p className="text-xs text-gray-400">há 30 minutos</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Comissão processada</p>
                  <p className="text-xs text-gray-500">R$ 125,00 para afiliado código AF001</p>
                  <p className="text-xs text-gray-400">há 1 hora</p>
                </div>
              </div>
            </div>
            
            <Button variant="ghost" className="w-full mt-4">
              Ver todas as atividades
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer com informações do sistema */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Sistema Lunara v2.0</span>
              <span>•</span>
              <span>Última atualização: {currentTime.toLocaleTimeString('pt-BR')}</span>
              <span>•</span>
              <Badge variant="outline" className="text-green-600 border-green-600">
                Online
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span>Suporte:</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                Contato
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}