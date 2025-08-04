// pages/DashboardPage.tsx - Dashboard Principal com Visão Geral da Clínica
'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { 
  Calendar,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle,
  Plus,
  Eye,
  Bell,
  Settings,
  RefreshCw,
  Filter,
  ArrowRight,
  Target,
  Award,
  BookOpen,
  Phone,
  Mail,
  MapPin
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format, isToday, isTomorrow, parseISO, startOfDay, endOfDay, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

const CORES_STATUS = {
  agendado: '#94A3B8',
  confirmado: '#3B82F6', 
  realizado: '#10B981',
  cancelado: '#EF4444',
  faltou: '#F59E0B'
}

export default function DashboardPage() {
  const { state, actions } = useAgenda()
  const [loading, setLoading] = useState(false)
  const [periodoSelecionado, setPeriodoSelecionado] = useState<'hoje' | 'semana' | 'mes'>('hoje')

  const hoje = new Date()
  const inicioHoje = startOfDay(hoje)
  const fimHoje = endOfDay(hoje)

  // Agendamentos de hoje
  const agendamentosHoje = useMemo(() => {
    return state.agendamentos
      .filter(agendamento => {
        const dataAgendamento = parseISO(agendamento.data)
        return dataAgendamento >= inicioHoje && dataAgendamento <= fimHoje
      })
      .sort((a, b) => a.hora.localeCompare(b.hora))
  }, [state.agendamentos, inicioHoje, fimHoje])

  // Próximos agendamentos (próximos 7 dias)
  const proximosAgendamentos = useMemo(() => {
    const inicioAmanha = startOfDay(addDays(hoje, 1))
    const fimSemana = endOfDay(addDays(hoje, 7))
    
    return state.agendamentos
      .filter(agendamento => {
        const dataAgendamento = parseISO(agendamento.data)
        return dataAgendamento >= inicioAmanha && dataAgendamento <= fimSemana
      })
      .sort((a, b) => {
        const dataCompare = a.data.localeCompare(b.data)
        return dataCompare !== 0 ? dataCompare : a.hora.localeCompare(b.hora)
      })
      .slice(0, 5)
  }, [state.agendamentos, hoje])

  // Métricas do período selecionado
  const metricas = useMemo(() => {
    let dataInicio: Date
    let dataFim: Date
    
    switch (periodoSelecionado) {
      case 'hoje':
        dataInicio = inicioHoje
        dataFim = fimHoje
        break
      case 'semana':
        dataInicio = startOfDay(subDays(hoje, 7))
        dataFim = fimHoje
        break
      case 'mes':
        dataInicio = startOfDay(subDays(hoje, 30))
        dataFim = fimHoje
        break
    }

    const agendamentosPeriodo = state.agendamentos.filter(agendamento => {
      const dataAgendamento = parseISO(agendamento.data)
      return dataAgendamento >= dataInicio && dataAgendamento <= dataFim
    })

    const total = agendamentosPeriodo.length
    const realizados = agendamentosPeriodo.filter(a => a.status === 'realizado').length
    const confirmados = agendamentosPeriodo.filter(a => a.status === 'confirmado').length
    const cancelados = agendamentosPeriodo.filter(a => a.status === 'cancelado').length
    const faltaram = agendamentosPeriodo.filter(a => a.status === 'faltou').length

    const receita = agendamentosPeriodo
      .filter(a => a.status === 'realizado')
      .reduce((acc, a) => acc + (a.valor || a.terapia?.preco || 0), 0)

    const receitaPotencial = agendamentosPeriodo
      .reduce((acc, a) => acc + (a.valor || a.terapia?.preco || 0), 0)

    const taxaRealizacao = total > 0 ? (realizados / total) * 100 : 0
    const taxaCancelamento = total > 0 ? (cancelados / total) * 100 : 0

    const pacientesUnicos = new Set(agendamentosPeriodo.map(a => a.paciente_id)).size

    return {
      total,
      realizados,
      confirmados,
      cancelados,
      faltaram,
      receita,
      receitaPotencial,
      taxaRealizacao,
      taxaCancelamento,
      pacientesUnicos
    }
  }, [state.agendamentos, periodoSelecionado, inicioHoje, fimHoje, hoje])

  // Dados para gráfico de status
  const dadosStatus = useMemo(() => [
    { name: 'Realizados', value: metricas.realizados, color: CORES_STATUS.realizado },
    { name: 'Confirmados', value: metricas.confirmados, color: CORES_STATUS.confirmado },
    { name: 'Cancelados', value: metricas.cancelados, color: CORES_STATUS.cancelado },
    { name: 'Faltaram', value: metricas.faltaram, color: CORES_STATUS.faltou }
  ].filter(item => item.value > 0), [metricas])

  // Terapias mais populares
  const terapiasPopulares = useMemo(() => {
    const contador: Record<string, { nome: string, count: number, receita: number, cor: string }> = {}
    
    state.agendamentos.forEach(agendamento => {
      if (!agendamento.terapia) return
      
      const terapiaId = agendamento.terapia.id
      if (!contador[terapiaId]) {
        contador[terapiaId] = {
          nome: agendamento.terapia.nome,
          count: 0,
          receita: 0,
          cor: agendamento.terapia.cor
        }
      }
      
      contador[terapiaId].count++
      if (agendamento.status === 'realizado') {
        contador[terapiaId].receita += agendamento.valor || agendamento.terapia.preco
      }
    })
    
    return Object.values(contador)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [state.agendamentos])

  // Alertas e notificações
  const alertas = useMemo(() => {
    const alerts: Array<{ tipo: 'info' | 'warning' | 'error', titulo: string, descricao: string }> = []
    
    // Agendamentos não confirmados para hoje
    const naoConfirmadosHoje = agendamentosHoje.filter(a => a.status === 'agendado')
    if (naoConfirmadosHoje.length > 0) {
      alerts.push({
        tipo: 'warning',
        titulo: `${naoConfirmadosHoje.length} agendamento(s) não confirmado(s)`,
        descricao: 'Para hoje - considere entrar em contato com os pacientes'
      })
    }

    // Taxa de cancelamento alta
    if (metricas.taxaCancelamento > 20) {
      alerts.push({
        tipo: 'error',
        titulo: 'Taxa de cancelamento alta',
        descricao: `${metricas.taxaCancelamento.toFixed(1)}% - acima do recomendado (20%)`
      })
    }

    // Receita perdida significativa
    const receitaPerdida = metricas.receitaPotencial - metricas.receita
    if (receitaPerdida > 500) {
      alerts.push({
        tipo: 'warning',
        titulo: 'Receita perdida significativa',
        descricao: `R$ ${receitaPerdida.toFixed(0)} em potencial não realizado`
      })
    }

    return alerts
  }, [agendamentosHoje, metricas])

  const handleConfirmarAgendamento = async (agendamentoId: string) => {
    setLoading(true)
    try {
      await actions.updateAgendamento(agendamentoId, { status: 'confirmado' })
      toast({
        title: "Agendamento confirmado",
        description: "Status atualizado com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao confirmar agendamento",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatarDataCompleta = (data: string) => {
    const dataObj = parseISO(data)
    if (isToday(dataObj)) return 'Hoje'
    if (isTomorrow(dataObj)) return 'Amanhã'
    return format(dataObj, "EEE, dd/MM", { locale: ptBR })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Visão geral da sua clínica - {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </Button>
          <Link href="/agenda">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((alerta, index) => (
            <Card key={index} className={`border-l-4 ${
              alerta.tipo === 'error' ? 'border-l-red-500 bg-red-50' :
              alerta.tipo === 'warning' ? 'border-l-yellow-500 bg-yellow-50' :
              'border-l-blue-500 bg-blue-50'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <AlertCircle className={`w-5 h-5 mr-3 ${
                    alerta.tipo === 'error' ? 'text-red-600' :
                    alerta.tipo === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <div>
                    <div className="font-medium">{alerta.titulo}</div>
                    <div className="text-sm text-gray-600">{alerta.descricao}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtro de Período */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Período:</span>
            <div className="flex space-x-2">
              {[
                { key: 'hoje', label: 'Hoje' },
                { key: 'semana', label: 'Últimos 7 dias' },
                { key: 'mes', label: 'Últimos 30 dias' }
              ].map(opcao => (
                <Button
                  key={opcao.key}
                  variant={periodoSelecionado === opcao.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriodoSelecionado(opcao.key as any)}
                >
                  {opcao.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Agendamentos</p>
                <p className="text-3xl font-bold text-blue-600">{metricas.total}</p>
                <div className="flex items-center mt-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">{metricas.realizados} realizados</span>
                </div>
              </div>
              <Calendar className="w-12 h-12 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Receita</p>
                <p className="text-3xl font-bold text-green-600">R$ {metricas.receita.toFixed(0)}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">
                    {((metricas.receita / metricas.receitaPotencial) * 100).toFixed(1)}% do potencial
                  </span>
                </div>
              </div>
              <DollarSign className="w-12 h-12 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxa Realização</p>
                <p className="text-3xl font-bold text-purple-600">{metricas.taxaRealizacao.toFixed(1)}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ width: `${metricas.taxaRealizacao}%` }}
                  />
                </div>
              </div>
              <Target className="w-12 h-12 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pacientes</p>
                <p className="text-3xl font-bold text-orange-600">{metricas.pacientesUnicos}</p>
                <p className="text-sm text-gray-500 mt-2">únicos no período</p>
              </div>
              <Users className="w-12 h-12 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agendamentos de Hoje */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Agendamentos de Hoje ({agendamentosHoje.length})
                </CardTitle>
                <Link href="/agenda">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Agenda
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {agendamentosHoje.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum agendamento para hoje</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendamentosHoje.map((agendamento) => (
                    <div 
                      key={agendamento.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{agendamento.hora}</div>
                          <div className="text-xs text-gray-500">
                            {agendamento.terapia?.duracao}min
                          </div>
                        </div>
                        <div 
                          className="w-1 h-12 rounded-full"
                          style={{ backgroundColor: CORES_STATUS[agendamento.status] }}
                        />
                        <div>
                          <div className="font-medium">{agendamento.paciente?.nome}</div>
                          <div className="text-sm text-gray-600">{agendamento.terapia?.nome}</div>
                          <div className="text-sm text-gray-500">
                            R$ {(agendamento.valor || agendamento.terapia?.preco || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={
                            agendamento.status === 'realizado' ? 'success' :
                            agendamento.status === 'confirmado' ? 'default' :
                            agendamento.status === 'cancelado' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {agendamento.status}
                        </Badge>
                        {agendamento.status === 'agendado' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleConfirmarAgendamento(agendamento.id)}
                            disabled={loading}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Confirmar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Próximos Agendamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ArrowRight className="w-5 h-5 mr-2 text-green-600" />
              Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximosAgendamentos.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhum agendamento futuro</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proximosAgendamentos.map((agendamento) => (
                  <div key={agendamento.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm font-medium text-gray-900">
                        {formatarDataCompleta(agendamento.data)}
                      </div>
                      <div className="text-sm text-blue-600">{agendamento.hora}</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{agendamento.paciente?.nome}</div>
                      <div className="text-xs text-gray-600">{agendamento.terapia?.nome}</div>
                    </div>
                    <Badge 
                      variant={agendamento.status === 'confirmado' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {agendamento.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart className="w-5 h-5 mr-2 text-purple-600" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dadosStatus}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {dadosStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Terapias Mais Populares */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="w-5 h-5 mr-2 text-amber-600" />
              Terapias Mais Populares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {terapiasPopulares.map((terapia, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-amber-600">#{index + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{terapia.nome}</div>
                      <div className="text-xs text-gray-500">{terapia.count} agendamentos</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">
                      R$ {terapia.receita.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/agenda">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                <Calendar className="w-6 h-6 mb-2" />
                <span className="text-sm">Nova Consulta</span>
              </Button>
            </Link>
            
            <Link href="/pacientes">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                <Users className="w-6 h-6 mb-2" />
                <span className="text-sm">Novo Paciente</span>
              </Button>
            </Link>
            
            <Link href="/relatorios">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                <BarChart className="w-6 h-6 mb-2" />
                <span className="text-sm">Relatórios</span>
              </Button>
            </Link>
            
            <Link href="/terapias">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                <BookOpen className="w-6 h-6 mb-2" />
                <span className="text-sm">Terapias</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}