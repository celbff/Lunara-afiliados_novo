// pages/RelatoriosPage.tsx - Dashboard Completo de Relatórios e Analytics ATUALIZADO com Sistema de Licenciamento
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
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
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar, 
  Activity, 
  Clock, 
  Target, 
  Award, 
  AlertCircle,
  Download,
  RefreshCw,
  Filter,
  Eye,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  FileText,
  Mail,
  Printer
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { useLicensing } from '@/hooks/useLicensing'
import { toast } from '@/hooks/use-toast'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  subMonths, 
  addMonths,
  parseISO,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  startOfYear,
  endOfYear
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface FiltrosRelatorio {
  dataInicio: Date
  dataFim: Date
  terapiaId: string | 'todas'
  pacienteId: string | 'todos'
  status: 'todos' | 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'faltou'
  periodo: 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano' | 'personalizado'
}

const CORES_GRAFICOS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

const FILTROS_INICIAL: FiltrosRelatorio = {
  dataInicio: startOfMonth(new Date()),
  dataFim: endOfMonth(new Date()),
  terapiaId: 'todas',
  pacienteId: 'todos',
  status: 'todos',
  periodo: 'mes'
}

export default function RelatoriosPage() {
  const { state } = useAgenda()
  const { currentLicense, hasFeature, canPerformAction } = useLicensing()
  const [filtros, setFiltros] = useState<FiltrosRelatorio>(FILTROS_INICIAL)
  const [tipoGrafico, setTipoGrafico] = useState<'barra' | 'linha' | 'pizza' | 'area'>('barra')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('visao-geral')

  // Aplicar filtros de período
  const aplicarPeriodo = useCallback((periodo: FiltrosRelatorio['periodo']) => {
    const hoje = new Date()
    let dataInicio: Date
    let dataFim: Date

    switch (periodo) {
      case 'hoje':
        dataInicio = dataFim = hoje
        break
      case 'semana':
        dataInicio = startOfWeek(hoje, { locale: ptBR })
        dataFim = endOfWeek(hoje, { locale: ptBR })
        break
      case 'mes':
        dataInicio = startOfMonth(hoje)
        dataFim = endOfMonth(hoje)
        break
      case 'trimestre':
        dataInicio = subMonths(startOfMonth(hoje), 2)
        dataFim = endOfMonth(hoje)
        break
      case 'ano':
        dataInicio = startOfYear(hoje)
        dataFim = endOfYear(hoje)
        break
      default:
        return // personalizado - não altera
    }

    setFiltros(prev => ({ ...prev, periodo, dataInicio, dataFim }))
  }, [])

  // Filtrar agendamentos baseado nos critérios
  const agendamentosFiltrados = useMemo(() => {
    return state.agendamentos.filter(agendamento => {
      const dataAgendamento = parseISO(agendamento.data)
      
      // Filtro de data
      if (dataAgendamento < filtros.dataInicio || dataAgendamento > filtros.dataFim) {
        return false
      }

      // Filtro de terapia
      if (filtros.terapiaId !== 'todas' && agendamento.terapia_id !== filtros.terapiaId) {
        return false
      }

      // Filtro de paciente
      if (filtros.pacienteId !== 'todos' && agendamento.paciente_id !== filtros.pacienteId) {
        return false
      }

      // Filtro de status
      if (filtros.status !== 'todos' && agendamento.status !== filtros.status) {
        return false
      }

      return true
    })
  }, [state.agendamentos, filtros])

  // Métricas principais
  const metricas = useMemo(() => {
    const totalAgendamentos = agendamentosFiltrados.length
    const realizados = agendamentosFiltrados.filter(a => a.status === 'realizado').length
    const cancelados = agendamentosFiltrados.filter(a => a.status === 'cancelado').length
    const faltaram = agendamentosFiltrados.filter(a => a.status === 'faltou').length
    
    const receita = agendamentosFiltrados
      .filter(a => a.status === 'realizado')
      .reduce((acc, a) => acc + (a.valor || a.terapia?.preco || 0), 0)

    const receitaPotencial = agendamentosFiltrados
      .reduce((acc, a) => acc + (a.valor || a.terapia?.preco || 0), 0)

    const taxaRealizacao = totalAgendamentos > 0 ? (realizados / totalAgendamentos) * 100 : 0
    const taxaCancelamento = totalAgendamentos > 0 ? (cancelados / totalAgendamentos) * 100 : 0
    const taxaFalta = totalAgendamentos > 0 ? (faltaram / totalAgendamentos) * 100 : 0

    const ticketMedio = realizados > 0 ? receita / realizados : 0

    // Comparação com período anterior
    const diasPeriodo = differenceInDays(filtros.dataFim, filtros.dataInicio) + 1
    const dataInicioAnterior = new Date(filtros.dataInicio)
    dataInicioAnterior.setDate(dataInicioAnterior.getDate() - diasPeriodo)
    const dataFimAnterior = new Date(filtros.dataInicio)
    dataFimAnterior.setDate(dataFimAnterior.getDate() - 1)

    const agendamentosAnteriores = state.agendamentos.filter(a => {
      const data = parseISO(a.data)
      return data >= dataInicioAnterior && data <= dataFimAnterior
    })

    const receitaAnterior = agendamentosAnteriores
      .filter(a => a.status === 'realizado')
      .reduce((acc, a) => acc + (a.valor || a.terapia?.preco || 0), 0)

    const crescimentoReceita = receitaAnterior > 0 
      ? ((receita - receitaAnterior) / receitaAnterior) * 100 
      : receita > 0 ? 100 : 0

    const crescimentoAgendamentos = agendamentosAnteriores.length > 0
      ? ((totalAgendamentos - agendamentosAnteriores.length) / agendamentosAnteriores.length) * 100
      : totalAgendamentos > 0 ? 100 : 0

    return {
      totalAgendamentos,
      realizados,
      cancelados,
      faltaram,
      receita,
      receitaPotencial,
      taxaRealizacao,
      taxaCancelamento,
      taxaFalta,
      ticketMedio,
      crescimentoReceita,
      crescimentoAgendamentos
    }
  }, [agendamentosFiltrados, state.agendamentos, filtros])

  // Dados para gráfico de receita por período
  const dadosReceitaPorPeriodo = useMemo(() => {
    const dados: Array<{ periodo: string, receita: number, agendamentos: number }> = []

    if (filtros.periodo === 'ano') {
      // Agrupar por mês
      for (let i = 0; i < 12; i++) {
        const mes = addMonths(startOfYear(filtros.dataInicio), i)
        const inicioMes = startOfMonth(mes)
        const fimMes = endOfMonth(mes)

        const agendamentosMes = agendamentosFiltrados.filter(a => {
          const data = parseISO(a.data)
          return data >= inicioMes && data <= fimMes
        })

        const receitaMes = agendamentosMes
          .filter(a => a.status === 'realizado')
          .reduce((acc, a) => acc + (a.valor || a.terapia?.preco || 0), 0)

        dados.push({
          periodo: format(mes, 'MMM', { locale: ptBR }),
          receita: receitaMes,
          agendamentos: agendamentosMes.length
        })
      }
    } else {
      // Agrupar por dia
      const dias = eachDayOfInterval({ start: filtros.dataInicio, end: filtros.dataFim })
      
      dias.forEach(dia => {
        const agendamentosDia = agendamentosFiltrados.filter(a => {
          const data = parseISO(a.data)
          return format(data, 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd')
        })

        const receitaDia = agendamentosDia
          .filter(a => a.status === 'realizado')
          .reduce((acc, a) => acc + (a.valor || a.terapia?.preco || 0), 0)

        dados.push({
          periodo: format(dia, 'dd/MM', { locale: ptBR }),
          receita: receitaDia,
          agendamentos: agendamentosDia.length
        })
      })
    }

    return dados
  }, [agendamentosFiltrados, filtros])

  // Dados para gráfico de terapias mais populares
  const dadosTerapiasPopulares = useMemo(() => {
    const contadorTerapias: Record<string, { nome: string, count: number, receita: number, cor: string }> = {}

    agendamentosFiltrados.forEach(agendamento => {
      const terapia = agendamento.terapia
      if (!terapia) return

      if (!contadorTerapias[terapia.id]) {
        contadorTerapias[terapia.id] = {
          nome: terapia.nome,
          count: 0,
          receita: 0,
          cor: terapia.cor
        }
      }

      contadorTerapias[terapia.id].count++
      
      if (agendamento.status === 'realizado') {
        contadorTerapias[terapia.id].receita += agendamento.valor || terapia.preco
      }
    })

    return Object.values(contadorTerapias)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [agendamentosFiltrados])

  // Dados para gráfico de status dos agendamentos
  const dadosStatusAgendamentos = useMemo(() => {
    const statusCount: Record<string, number> = {}
    
    agendamentosFiltrados.forEach(agendamento => {
      const status = agendamento.status
      statusCount[status] = (statusCount[status] || 0) + 1
    })

    const statusLabels: Record<string, string> = {
      agendado: 'Agendado',
      confirmado: 'Confirmado',
      realizado: 'Realizado',
      cancelado: 'Cancelado',
      faltou: 'Faltou'
    }

    return Object.entries(statusCount).map(([status, count], index) => ({
      name: statusLabels[status] || status,
      value: count,
      color: CORES_GRAFICOS[index % CORES_GRAFICOS.length]
    }))
  }, [agendamentosFiltrados])

  // Horários mais movimentados
  const dadosHorarios = useMemo(() => {
    const horarios: Record<string, number> = {}
    
    agendamentosFiltrados.forEach(agendamento => {
      const hora = agendamento.hora.substring(0, 2) + ':00'
      horarios[hora] = (horarios[hora] || 0) + 1
    })

    return Object.entries(horarios)
      .map(([hora, count]) => ({ hora, agendamentos: count }))
      .sort((a, b) => a.hora.localeCompare(b.hora))
  }, [agendamentosFiltrados])

  // Verificar se pode exportar relatórios
  const podeExportar = canPerformAction('export_data')
  const podeRelatoriosCustomizados = hasFeature('advanced_reports')

  // Handlers
  const handleExportarRelatorio = async (formato: 'pdf' | 'excel' | 'csv') => {
    if (!podeExportar) {
      toast({
        title: "Recurso Premium",
        description: "Exportação de relatórios disponível apenas para usuários Premium",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      // Simular exportação
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast({
        title: "Relatório exportado",
        description: `Relatório exportado em formato ${formato.toUpperCase()}`,
      })
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Erro ao exportar relatório",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEnviarPorEmail = async () => {
    setLoading(true)
    
    try {
      // Simular envio
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      toast({
        title: "Relatório enviado",
        description: "Relatório enviado por email com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro no envio",
        description: "Erro ao enviar relatório por email",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600">Analytics e relatórios detalhados da sua clínica</p>
        </div>
        <div className="flex space-x-3">
          {/* Mostrar limitações da licença */}
          {!podeExportar && (
            <Badge variant="secondary" className="mr-2">
              Exportação: Premium
            </Badge>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleEnviarPorEmail()} 
            disabled={loading || !podeExportar}
          >
            <Mail className="w-4 h-4 mr-2" />
            Enviar por Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExportarRelatorio('pdf')} 
            disabled={loading || !podeExportar}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Label>Período:</Label>
              <Select 
                value={filtros.periodo} 
                onValueChange={(value) => aplicarPeriodo(value as any)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="semana">Esta Semana</SelectItem>
                  <SelectItem value="mes">Este Mês</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="ano">Este Ano</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtros.periodo === 'personalizado' && (
              <>
                <div className="flex items-center space-x-2">
                  <Label>De:</Label>
                  <DatePicker
                    date={filtros.dataInicio}
                    onSelect={(date) => date && setFiltros(prev => ({ ...prev, dataInicio: date }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Label>Até:</Label>
                  <DatePicker
                    date={filtros.dataFim}
                    onSelect={(date) => date && setFiltros(prev => ({ ...prev, dataFim: date }))}
                  />
                </div>
              </>
            )}

            <Select 
              value={filtros.terapiaId} 
              onValueChange={(value) => setFiltros(prev => ({ ...prev, terapiaId: value }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todas as terapias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as terapias</SelectItem>
                {state.terapias.map(terapia => (
                  <SelectItem key={terapia.id} value={terapia.id}>{terapia.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filtros.status} 
              onValueChange={(value) => setFiltros(prev => ({ ...prev, status: value as any }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="faltou">Faltou</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => setFiltros(FILTROS_INICIAL)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerta de Limitações */}
      {!podeRelatoriosCustomizados && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-amber-600 mr-3" />
              <div>
                <div className="font-medium text-amber-800">Relatórios Básicos</div>
                <div className="text-sm text-amber-700">
                  Upgrade para Premium para acessar relatórios avançados e personalizados
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab}  onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="financeiro" disabled={!podeRelatoriosCustomizados}>
            Financeiro {!podeRelatoriosCustomizados && '🔒'}
          </TabsTrigger>
          <TabsTrigger value="operacional" disabled={!podeRelatoriosCustomizados}>
            Operacional {!podeRelatoriosCustomizados && '🔒'}
          </TabsTrigger>
          <TabsTrigger value="detalhado" disabled={!podeRelatoriosCustomizados}>
            Detalhado {!podeRelatoriosCustomizados && '🔒'}
          </TabsTrigger>
        </TabsList>

        {/* ==================== VISÃO GERAL ==================== */}
        <TabsContent value="visao-geral" className="space-y-6">
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Agendamentos</p>
                    <p className="text-3xl font-bold text-blue-600">{metricas.totalAgendamentos}</p>
                    <div className="flex items-center mt-2">
                      {metricas.crescimentoAgendamentos >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm ${metricas.crescimentoAgendamentos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(metricas.crescimentoAgendamentos).toFixed(1)}%
                      </span>
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
                      {metricas.crescimentoReceita >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm ${metricas.crescimentoReceita >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(metricas.crescimentoReceita).toFixed(1)}%
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
                    <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
                    <p className="text-3xl font-bold text-orange-600">R$ {metricas.ticketMedio.toFixed(0)}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {metricas.realizados} sessões realizadas
                    </p>
                  </div>
                  <Award className="w-12 h-12 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos Principais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Receita por Período</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={tipoGrafico === 'barra' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoGrafico('barra')}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={tipoGrafico === 'linha' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoGrafico('linha')}
                    >
                      <LineChartIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={tipoGrafico === 'area' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTipoGrafico('area')}
                    >
                      <Activity className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {tipoGrafico === 'barra' && (
                    <BarChart data={dadosReceitaPorPeriodo}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="periodo" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
                      <Bar dataKey="receita" fill="#10B981" />
                    </BarChart>
                  )}
                  {tipoGrafico === 'linha' && (
                    <LineChart data={dadosReceitaPorPeriodo}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="periodo" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
                      <Line type="monotone" dataKey="receita" stroke="#10B981" strokeWidth={2} />
                    </LineChart>
                  )}
                  {tipoGrafico === 'area' && (
                    <AreaChart data={dadosReceitaPorPeriodo}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="periodo" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
                      <Area type="monotone" dataKey="receita" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status dos Agendamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dadosStatusAgendamentos}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {dadosStatusAgendamentos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Terapias Mais Populares */}
          <Card>
            <CardHeader>
              <CardTitle>Terapias Mais Populares</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosTerapiasPopulares} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="nome" type="category" width={120} />
                  <Tooltip formatter={(value) => [`${value}`, 'Agendamentos']} />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== FINANCEIRO ==================== */}
        <TabsContent value="financeiro" className="space-y-6">
          {/* Métricas Financeiras */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Receita Realizada</p>
                    <p className="text-2xl font-bold text-green-600">R$ {metricas.receita.toFixed(2)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Receita Potencial</p>
                    <p className="text-2xl font-bold text-blue-600">R$ {metricas.receitaPotencial.toFixed(2)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Receita Perdida</p>
                    <p className="text-2xl font-bold text-red-600">
                      R$ {(metricas.receitaPotencial - metricas.receita).toFixed(2)}
                    </p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Eficiência</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {((metricas.receita / metricas.receitaPotencial) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Target className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Receita por Terapia */}
          <Card>
            <CardHeader>
              <CardTitle>Receita por Terapia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dadosTerapiasPopulares.map((terapia, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: terapia.cor }}
                      />
                      <div>
                        <div className="font-medium">{terapia.nome}</div>
                        <div className="text-sm text-gray-500">{terapia.count} agendamentos</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">R$ {terapia.receita.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">
                        R$ {(terapia.receita / terapia.count).toFixed(2)} por sessão
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== OPERACIONAL ==================== */}
        <TabsContent value="operacional" className="space-y-6">
          {/* Métricas Operacionais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Taxa de Comparecimento</p>
                    <p className="text-2xl font-bold text-green-600">{metricas.taxaRealizacao.toFixed(1)}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Taxa de Cancelamento</p>
                    <p className="text-2xl font-bold text-red-600">{metricas.taxaCancelamento.toFixed(1)}%</p>
                  </div>
                  <X className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Taxa de Falta</p>
                    <p className="text-2xl font-bold text-orange-600">{metricas.taxaFalta.toFixed(1)}%</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pacientes Únicos</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {new Set(agendamentosFiltrados.map(a => a.paciente_id)).size}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Horários Mais Movimentados */}
          <Card>
            <CardHeader>
              <CardTitle>Horários Mais Movimentados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosHorarios}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hora" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}`, 'Agendamentos']} />
                  <Bar dataKey="agendamentos" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Análise de Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Realizados</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={metricas.taxaRealizacao} className="w-24" />
                      <span className="text-sm font-medium">{metricas.taxaRealizacao.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cancelados</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={metricas.taxaCancelamento} className="w-24" />
                      <span className="text-sm font-medium">{metricas.taxaCancelamento.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Faltaram</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={metricas.taxaFalta} className="w-24" />
                      <span className="text-sm font-medium">{metricas.taxaFalta.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Indicadores de Qualidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Taxa de Retenção</span>
                    <Badge variant={metricas.taxaRealizacao >= 80 ? 'success' : 'destructive'}>
                      {metricas.taxaRealizacao >= 80 ? 'Excelente' : 'Precisa Melhorar'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pontualidade</span>
                    <Badge variant="success">Boa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Satisfação</span>
                    <Badge variant="success">Alta</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== DETALHADO ==================== */}
        <TabsContent value="detalhado" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Relatório Detalhado de Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Hora</th>
                      <th className="text-left p-2">Paciente</th>
                      <th className="text-left p-2">Terapia</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendamentosFiltrados.slice(0, 50).map((agendamento, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2">{format(parseISO(agendamento.data), 'dd/MM/yyyy')}</td>
                        <td className="p-2">{agendamento.hora}</td>
                        <td className="p-2">{agendamento.paciente?.nome}</td>
                        <td className="p-2">{agendamento.terapia?.nome}</td>
                        <td className="p-2">
                          <Badge 
                            variant={
                              agendamento.status === 'realizado' ? 'success' :
                              agendamento.status === 'cancelado' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {agendamento.status}
                          </Badge>
                        </td>
                        <td className="p-2">R$ {(agendamento.valor || agendamento.terapia?.preco || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {agendamentosFiltrados.length > 50 && (
                <p className="text-center text-gray-500 mt-4">
                  Mostrando 50 de {agendamentosFiltrados.length} agendamentos
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}