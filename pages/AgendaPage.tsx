// pages/AgendaPage.tsx - Página Principal da Agenda com Calendário e Gestão de Agendamentos
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Switch } from '@/components/ui/Switch'
import { DatePicker } from '@/components/ui/DatePicker'
import { 
  Calendar,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  X,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Grid,
  Download,
  Settings,
  Bell,
  MapPin,
  DollarSign
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  isToday,
  parseISO,
  isSameMonth,
  getDay,
  addDays,
  startOfDay,
  setHours,
  setMinutes
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, Paciente, Terapia } from '@/types/agenda'

interface AgendamentoFormData {
  data: Date
  hora: string
  paciente_id: string
  terapia_id: string
  observacoes?: string
  valor?: number
  status: 'agendado' | 'confirmado'
  lembrete_email: boolean
  lembrete_sms: boolean
}

interface FiltrosAgenda {
  busca: string
  data: Date | null
  terapiaId: string | 'todas'
  pacienteId: string | 'todos'
  status: 'todos' | 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'faltou'
}

const FILTROS_INICIAL: FiltrosAgenda = {
  busca: '',
  data: null,
  terapiaId: 'todas',
  pacienteId: 'todos',
  status: 'todos'
}

const FORM_INICIAL: AgendamentoFormData = {
  data: new Date(),
  hora: '09:00',
  paciente_id: '',
  terapia_id: '',
  observacoes: '',
  valor: undefined,
  status: 'agendado',
  lembrete_email: true,
  lembrete_sms: false
}

const HORARIOS_DISPONIVEIS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00'
]

const CORES_STATUS = {
  agendado: '#94A3B8',
  confirmado: '#3B82F6', 
  realizado: '#10B981',
  cancelado: '#EF4444',
  faltou: '#F59E0B'
}

export default function AgendaPage() {
  const { state, actions } = useAgenda()
  const [filtros, setFiltros] = useState<FiltrosAgenda>(FILTROS_INICIAL)
  const [dataAtual, setDataAtual] = useState(new Date())
  const [visualizacao, setVisualizacao] = useState<'mes' | 'semana' | 'dia' | 'lista'>('mes')
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null)
  const [modoEdicao, setModoEdicao] = useState<'criar' | 'editar' | null>(null)
  const [formData, setFormData] = useState<AgendamentoFormData>(FORM_INICIAL)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [horarioSelecionado, setHorarioSelecionado] = useState<{ data: Date, hora: string } | null>(null)

  // Calcular período da visualização
  const periodo = useMemo(() => {
    switch (visualizacao) {
      case 'mes':
        return {
          inicio: startOfMonth(dataAtual),
          fim: endOfMonth(dataAtual),
          dias: eachDayOfInterval({
            start: startOfWeek(startOfMonth(dataAtual), { locale: ptBR }),
            end: endOfWeek(endOfMonth(dataAtual), { locale: ptBR })
          })
        }
      case 'semana':
        return {
          inicio: startOfWeek(dataAtual, { locale: ptBR }),
          fim: endOfWeek(dataAtual, { locale: ptBR }),
          dias: eachDayOfInterval({
            start: startOfWeek(dataAtual, { locale: ptBR }),
            end: endOfWeek(dataAtual, { locale: ptBR })
          })
        }
      case 'dia':
        return {
          inicio: startOfDay(dataAtual),
          fim: startOfDay(dataAtual),
          dias: [dataAtual]
        }
      default:
        return {
          inicio: startOfMonth(dataAtual),
          fim: endOfMonth(dataAtual),
          dias: []
        }
    }
  }, [dataAtual, visualizacao])

  // Filtrar agendamentos
  const agendamentosFiltrados = useMemo(() => {
    return state.agendamentos.filter(agendamento => {
      const dataAgendamento = parseISO(agendamento.data)

      // Filtro de período
      if (dataAgendamento < periodo.inicio || dataAgendamento > periodo.fim) {
        return false
      }

      // Filtro de busca
      if (filtros.busca) {
        const busca = filtros.busca.toLowerCase()
        if (!agendamento.paciente?.nome.toLowerCase().includes(busca) &&
            !agendamento.terapia?.nome.toLowerCase().includes(busca)) {
          return false
        }
      }

      // Filtro de data específica
      if (filtros.data && !isSameDay(dataAgendamento, filtros.data)) {
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
  }, [state.agendamentos, periodo, filtros])

  // Agrupar agendamentos por dia
  const agendamentosPorDia = useMemo(() => {
    const grupos: Record<string, Agendamento[]> = {}
    
    agendamentosFiltrados.forEach(agendamento => {
      const chave = format(parseISO(agendamento.data), 'yyyy-MM-dd')
      if (!grupos[chave]) {
        grupos[chave] = []
      }
      grupos[chave].push(agendamento)
    })

    // Ordenar por horário
    Object.keys(grupos).forEach(chave => {
      grupos[chave].sort((a, b) => a.hora.localeCompare(b.hora))
    })

    return grupos
  }, [agendamentosFiltrados])

  // Navegação de período
  const navegarPeriodo = useCallback((direcao: 'anterior' | 'proximo') => {
    setDataAtual(prev => {
      switch (visualizacao) {
        case 'mes':
          return direcao === 'anterior' ? subMonths(prev, 1) : addMonths(prev, 1)
        case 'semana':
          return direcao === 'anterior' ? addDays(prev, -7) : addDays(prev, 7)
        case 'dia':
          return direcao === 'anterior' ? addDays(prev, -1) : addDays(prev, 1)
        default:
          return prev
      }
    })
  }, [visualizacao])

  // Verificar se horário está ocupado
  const isHorarioOcupado = useCallback((data: Date, hora: string) => {
    const chave = format(data, 'yyyy-MM-dd')
    const agendamentosDia = agendamentosPorDia[chave] || []
    return agendamentosDia.some(a => a.hora === hora && a.status !== 'cancelado')
  }, [agendamentosPorDia])

  // Handlers
  const handleAbrirFormulario = (modo: 'criar' | 'editar', agendamento?: Agendamento, dataHora?: { data: Date, hora: string }) => {
    setModoEdicao(modo)
    
    if (modo === 'criar') {
      const novoForm = { ...FORM_INICIAL }
      if (dataHora) {
        novoForm.data = dataHora.data
        novoForm.hora = dataHora.hora
      }
      setFormData(novoForm)
    } else if (agendamento) {
      setFormData({
        data: parseISO(agendamento.data),
        hora: agendamento.hora,
        paciente_id: agendamento.paciente_id,
        terapia_id: agendamento.terapia_id,
        observacoes: agendamento.observacoes || '',
        valor: agendamento.valor,
        status: agendamento.status as 'agendado' | 'confirmado',
        lembrete_email: true,
        lembrete_sms: false
      })
      setAgendamentoSelecionado(agendamento)
    }
    
    setDialogAberto(true)
  }

  const handleSalvarAgendamento = async () => {
    if (!formData.paciente_id || !formData.terapia_id) {
      toast({
        title: "Dados incompletos",
        description: "Selecione paciente e terapia",
        variant: "destructive"
      })
      return
    }

    // Verificar conflitos de horário
    if (modoEdicao === 'criar' || 
        (agendamentoSelecionado && 
         (format(formData.data, 'yyyy-MM-dd') !== agendamentoSelecionado.data || 
          formData.hora !== agendamentoSelecionado.hora))) {
      
      if (isHorarioOcupado(formData.data, formData.hora)) {
        toast({
          title: "Horário ocupado",
          description: "Já existe um agendamento neste horário",
          variant: "destructive"
        })
        return
      }
    }

    setLoading(true)
    
    try {
      const dadosAgendamento = {
        data: format(formData.data, 'yyyy-MM-dd'),
        hora: formData.hora,
        paciente_id: formData.paciente_id,
        terapia_id: formData.terapia_id,
        observacoes: formData.observacoes,
        valor: formData.valor,
        status: formData.status
      }

      if (modoEdicao === 'criar') {
        await actions.createAgendamento(dadosAgendamento)
        toast({
          title: "Agendamento criado",
          description: "Agendamento criado com sucesso",
        })
      } else if (agendamentoSelecionado) {
        await actions.updateAgendamento(agendamentoSelecionado.id, dadosAgendamento)
        toast({
          title: "Agendamento atualizado",
          description: "Agendamento atualizado com sucesso",
        })
      }
      
      handleFecharDialog()
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar agendamento",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExcluirAgendamento = async (agendamento: Agendamento) => {
    try {
      await actions.deleteAgendamento(agendamento.id)
      toast({
        title: "Agendamento excluído",
        description: "Agendamento excluído com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir agendamento",
        variant: "destructive"
      })
    }
  }

  const handleAlterarStatus = async (agendamento: Agendamento, novoStatus: Agendamento['status']) => {
    try {
      await actions.updateAgendamento(agendamento.id, { status: novoStatus })
      toast({
        title: "Status atualizado",
        description: `Agendamento marcado como ${novoStatus}`,
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive"
      })
    }
  }

  const handleFecharDialog = () => {
    setDialogAberto(false)
    setFormData(FORM_INICIAL)
    setAgendamentoSelecionado(null)
    setModoEdicao(null)
    setHorarioSelecionado(null)
  }

  const resetarFiltros = () => {
    setFiltros(FILTROS_INICIAL)
  }

  // Título do período atual
  const tituloPeriodo = useMemo(() => {
    switch (visualizacao) {
      case 'mes':
        return format(dataAtual, "MMMM 'de' yyyy", { locale: ptBR })
      case 'semana':
        const inicioSemana = startOfWeek(dataAtual, { locale: ptBR })
        const fimSemana = endOfWeek(dataAtual, { locale: ptBR })
        return `${format(inicioSemana, 'dd/MM', { locale: ptBR })} - ${format(fimSemana, 'dd/MM/yyyy', { locale: ptBR })}`
      case 'dia':
        return format(dataAtual, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      default:
        return ''
    }
  }, [dataAtual, visualizacao])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-600">Gerencie seus agendamentos e horários</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Bell className="w-4 h-4 mr-2" />
            Lembretes
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button 
            onClick={() => handleAbrirFormulario('criar')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Controles de Visualização */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Navegação de Período */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => navegarPeriodo('anterior')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={() => setDataAtual(new Date())}>
                  Hoje
                </Button>
                <Button variant="outline" size="sm" onClick={() => navegarPeriodo('proximo')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-lg font-semibold text-gray-900">
                {tituloPeriodo}
              </div>
            </div>

            {/* Tipos de Visualização */}
            <div className="flex items-center space-x-2">
              {[
                { key: 'mes', label: 'Mês', icon: Grid },
                { key: 'semana', label: 'Semana', icon: CalendarDays },
                { key: 'dia', label: 'Dia', icon: Calendar },
                { key: 'lista', label: 'Lista', icon: List }
              ].map(opcao => (
                <Button
                  key={opcao.key}
                  variant={visualizacao === opcao.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao(opcao.key as any)}
                >
                  <opcao.icon className="w-4 h-4 mr-2" />
                  {opcao.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por paciente ou terapia..."
                  value={filtros.busca}
                  onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <DatePicker
              date={filtros.data}
              onSelect={(date) => setFiltros(prev => ({ ...prev, data: date }))}
              placeholder="Data específica"
            />

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
              value={filtros.pacienteId} 
              onValueChange={(value) => setFiltros(prev => ({ ...prev, pacienteId: value }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todos os pacientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os pacientes</SelectItem>
                {state.pacientes.map(paciente => (
                  <SelectItem key={paciente.id} value={paciente.id}>{paciente.nome}</SelectItem>
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

            <Button variant="outline" size="sm" onClick={resetarFiltros}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo Principal */}
      <Card>
        <CardContent className="p-0">
          {visualizacao === 'mes' && (
            <div className="p-6">
              {/* Calendário Mensal */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                {/* Cabeçalho dos dias da semana */}
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                  <div key={dia} className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-600">
                    {dia}
                  </div>
                ))}
                
                {/* Dias do mês */}
                {periodo.dias.map(dia => {
                  const chave = format(dia, 'yyyy-MM-dd')
                  const agendamentosDia = agendamentosPorDia[chave] || []
                  const isHoje = isToday(dia)
                  const isOutroMes = !isSameMonth(dia, dataAtual)
                  
                  return (
                    <div
                      key={chave}
                      className={`bg-white p-2 min-h-[120px] border-t border-l ${
                        isHoje ? 'bg-blue-50 border-blue-200' : ''
                      } ${isOutroMes ? 'bg-gray-50 text-gray-400' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${isHoje ? 'text-blue-600' : ''}`}>
                          {format(dia, 'd')}
                        </span>
                        {!isOutroMes && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAbrirFormulario('criar', undefined, { data: dia, hora: '09:00' })}
                            className="w-5 h-5 p-0 opacity-60 hover:opacity-100"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {agendamentosDia.slice(0, 3).map(agendamento => (
                          <div
                            key={agendamento.id}
                            className="text-xs p-1 rounded cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: CORES_STATUS[agendamento.status] + '20', borderLeft: `3px solid ${CORES_STATUS[agendamento.status]}` }}
                            onClick={() => setAgendamentoSelecionado(agendamento)}
                          >
                            <div className="font-medium truncate">{agendamento.hora}</div>
                            <div className="truncate text-gray-600">{agendamento.paciente?.nome}</div>
                          </div>
                        ))}
                        
                        {agendamentosDia.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{agendamentosDia.length - 3} mais
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {visualizacao === 'lista' && (
            <div className="p-6">
              {agendamentosFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum agendamento encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(agendamentosPorDia)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([data, agendamentos]) => (
                      <div key={data} className="space-y-3">
                        <div className="flex items-center space-x-2 border-b pb-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-gray-900">
                            {format(parseISO(data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </h3>
                          <Badge variant="secondary">{agendamentos.length}</Badge>
                        </div>
                        
                        <div className="grid gap-3">
                          {agendamentos.map(agendamento => (
                            <div
                              key={agendamento.id}
                              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="text-center min-w-[60px]">
                                  <div className="text-lg font-bold text-blue-600">{agendamento.hora}</div>
                                  <div className="text-xs text-gray-500">
                                    {agendamento.terapia?.duracao}min
                                  </div>
                                </div>
                                
                                <div 
                                  className="w-1 h-12 rounded-full"
                                  style={{ backgroundColor: CORES_STATUS[agendamento.status] }}
                                />
                                
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{agendamento.paciente?.nome}</div>
                                  <div className="text-sm text-gray-600">{agendamento.terapia?.nome}</div>
                                  <div className="text-sm text-gray-500">
                                    R$ {(agendamento.valor || agendamento.terapia?.preco || 0).toFixed(2)}
                                  </div>
                                  {agendamento.observacoes && (
                                    <div className="text-xs text-gray-500 mt-1 truncate max-w-[300px]">
                                      {agendamento.observacoes}
                                    </div>
                                  )}
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
                                
                                <div className="flex space-x-1">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleAbrirFormulario('editar', agendamento)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  
                                  {agendamento.status === 'agendado' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleAlterarStatus(agendamento, 'confirmado')}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  
                                  {agendamento.status === 'confirmado' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleAlterarStatus(agendamento, 'realizado')}
                                    >
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Formulário */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {modoEdicao === 'criar' ? 'Novo Agendamento' : 'Editar Agendamento'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <DatePicker
                  date={formData.data}
                  onSelect={(date) => date && setFormData(prev => ({ ...prev, data: date }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Select 
                  value={formData.hora} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, hora: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORARIOS_DISPONIVEIS.map(hora => {
                      const ocupado = isHorarioOcupado(formData.data, hora) && 
                        (modoEdicao === 'criar' || 
                         (agendamentoSelecionado && 
                          (format(formData.data, 'yyyy-MM-dd') !== agendamentoSelecionado.data || 
                           hora !== agendamentoSelecionado.hora)))
                      
                      return (
                        <SelectItem 
                          key={hora} 
                          value={hora}
                          disabled={ocupado}
                        >
                          {hora} {ocupado && '(Ocupado)'}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <Select 
                  value={formData.paciente_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, paciente_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.pacientes.map(paciente => (
                      <SelectItem key={paciente.id} value={paciente.id}>
                        {paciente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Terapia *</Label>
                <Select 
                  value={formData.terapia_id} 
                  onValueChange={(value) => {
                    const terapia = state.terapias.find(t => t.id === value)
                    setFormData(prev => ({ 
                      ...prev, 
                      terapia_id: value,
                      valor: terapia?.preco || prev.valor
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a terapia" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.terapias.filter(t => t.ativa).map(terapia => (
                      <SelectItem key={terapia.id} value={terapia.id}>
                        {terapia.nome} - R$ {terapia.preco.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="Valor da sessão"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.lembrete_email}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, lembrete_email: checked }))}
                />
                <Label>Enviar lembrete por email</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.lembrete_sms}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, lembrete_sms: checked }))}
                />
                <Label>Enviar lembrete por SMS</Label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleFecharDialog}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button onClick={handleSalvarAgendamento} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {modoEdicao === 'criar' ? 'Criar Agendamento' : 'Salvar Alterações'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Agendamento */}
      {agendamentoSelecionado && !dialogAberto && (
        <Dialog open={!!agendamentoSelecionado} onOpenChange={() => setAgendamentoSelecionado(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Data e Hora</Label>
                  <p className="font-medium">
                    {format(parseISO(agendamentoSelecionado.data), "dd/MM/yyyy", { locale: ptBR })} às {agendamentoSelecionado.hora}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Status</Label>
                  <Badge 
                    variant={
                      agendamentoSelecionado.status === 'realizado' ? 'success' :
                      agendamentoSelecionado.status === 'confirmado' ? 'default' :
                      agendamentoSelecionado.status === 'cancelado' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {agendamentoSelecionado.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Paciente</Label>
                <p className="font-medium">{agendamentoSelecionado.paciente?.nome}</p>
                {agendamentoSelecionado.paciente?.telefone && (
                  <p className="text-sm text-gray-600">{agendamentoSelecionado.paciente.telefone}</p>
                )}
              </div>

              <div>
                <Label className="text-sm text-gray-500">Terapia</Label>
                <p className="font-medium">{agendamentoSelecionado.terapia?.nome}</p>
                <p className="text-sm text-gray-600">
                  Duração: {agendamentoSelecionado.terapia?.duracao} minutos
                </p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Valor</Label>
                <p className="font-medium">
                  R$ {(agendamentoSelecionado.valor || agendamentoSelecionado.terapia?.preco || 0).toFixed(2)}
                </p>
              </div>

              {agendamentoSelecionado.observacoes && (
                <div>
                  <Label className="text-sm text-gray-500">Observações</Label>
                  <p className="text-sm">{agendamentoSelecionado.observacoes}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button 
                  variant="outline"
                  onClick={() => handleAbrirFormulario('editar', agendamentoSelecionado)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                
                {agendamentoSelecionado.status === 'agendado' && (
                  <Button 
                    variant="outline"
                    onClick={() => handleAlterarStatus(agendamentoSelecionado, 'confirmado')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar
                  </Button>
                )}
                
                {agendamentoSelecionado.status === 'confirmado' && (
                  <Button 
                    onClick={() => handleAlterarStatus(agendamentoSelecionado, 'realizado')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Realizado
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={() => handleExcluirAgendamento(agendamentoSelecionado)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}