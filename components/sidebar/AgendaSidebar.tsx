// components/sidebar/AgendaSidebar.tsx - Sidebar Principal com Drag & Drop
'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { 
  Users, 
  Stethoscope, 
  Search, 
  Plus, 
  Filter,
  Clock,
  User,
  Phone,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Grip
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { useDragAndDrop } from '@/hooks/useDragAndDrop'
import type { Paciente, Terapia } from '@/types/agenda'

interface AgendaSidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  onOpenPacienteModal: (mode: 'create' | 'edit', paciente?: Paciente) => void
  onOpenTerapiaModal: (mode: 'create' | 'edit', terapia?: Terapia) => void
}

interface FilterState {
  searchTerm: string
  showInactive: boolean
  sortBy: 'nome' | 'data' | 'frequencia'
  sortOrder: 'asc' | 'desc'
}

export default function AgendaSidebar({
  isCollapsed,
  onToggle,
  onOpenPacienteModal,
  onOpenTerapiaModal
}: AgendaSidebarProps) {
  const { state } = useAgenda()
  const { pacientes, terapias, agendamentos, loading } = state
  const { startDrag } = useDragAndDrop()

  const [activeTab, setActiveTab] = useState<'pacientes' | 'terapias'>('pacientes')
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    showInactive: false,
    sortBy: 'nome',
    sortOrder: 'asc'
  })

  // Estatísticas dos pacientes
  const pacientesComEstatisticas = pacientes.map(paciente => {
    const agendamentosPaciente = agendamentos.filter(a => a.paciente_id === paciente.id)
    const ultimoAgendamento = agendamentosPaciente
      .sort((a, b) => new Date(b.data + 'T' + b.hora).getTime() - new Date(a.data + 'T' + a.hora).getTime())[0]
    
    return {
      ...paciente,
      totalAgendamentos: agendamentosPaciente.length,
      ultimoAgendamento: ultimoAgendamento?.data || null,
      proximoAgendamento: agendamentosPaciente
        .filter(a => new Date(a.data + 'T' + a.hora) > new Date() && a.status !== 'cancelado')
        .sort((a, b) => new Date(a.data + 'T' + a.hora).getTime() - new Date(b.data + 'T' + b.hora).getTime())[0]
    }
  })

  // Estatísticas das terapias
  const terapiasComEstatisticas = terapias.map(terapia => {
    const agendamentosTerapia = agendamentos.filter(a => a.terapia_id === terapia.id)
    const agendamentosAtivos = agendamentosTerapia.filter(a => 
      new Date(a.data + 'T' + a.hora) > new Date() && a.status !== 'cancelado'
    )
    
    return {
      ...terapia,
      totalAgendamentos: agendamentosTerapia.length,
      agendamentosAtivos: agendamentosAtivos.length,
      faturamentoTotal: agendamentosTerapia
        .filter(a => a.status === 'concluido' && a.valor)
        .reduce((total, a) => total + (a.valor || 0), 0)
    }
  })

  // Filtrar e ordenar pacientes
  const pacientesFiltrados = pacientesComEstatisticas
    .filter(paciente => {
      if (!filters.searchTerm) return true
      const termo = filters.searchTerm.toLowerCase()
      return (
        paciente.nome.toLowerCase().includes(termo) ||
        paciente.telefone.includes(termo) ||
        (paciente.email && paciente.email.toLowerCase().includes(termo))
      )
    })
    .sort((a, b) => {
      const multiplier = filters.sortOrder === 'asc' ? 1 : -1
      
      switch (filters.sortBy) {
        case 'nome':
          return a.nome.localeCompare(b.nome) * multiplier
        case 'data':
          const dateA = a.ultimoAgendamento ? new Date(a.ultimoAgendamento) : new Date(0)
          const dateB = b.ultimoAgendamento ? new Date(b.ultimoAgendamento) : new Date(0)
          return (dateA.getTime() - dateB.getTime()) * multiplier
        case 'frequencia':
          return (a.totalAgendamentos - b.totalAgendamentos) * multiplier
        default:
          return 0
      }
    })

  // Filtrar e ordenar terapias
  const terapiasFiltradas = terapiasComEstatisticas
    .filter(terapia => {
      if (!filters.showInactive && !terapia.ativa) return false
      if (!filters.searchTerm) return true
      const termo = filters.searchTerm.toLowerCase()
      return (
        terapia.nome.toLowerCase().includes(termo) ||
        (terapia.descricao && terapia.descricao.toLowerCase().includes(termo))
      )
    })
    .sort((a, b) => {
      const multiplier = filters.sortOrder === 'asc' ? 1 : -1
      
      switch (filters.sortBy) {
        case 'nome':
          return a.nome.localeCompare(b.nome) * multiplier
        case 'frequencia':
          return (a.totalAgendamentos - b.totalAgendamentos) * multiplier
        default:
          return 0
      }
    })

  // Manipular drag de paciente
  const handlePacienteDragStart = useCallback((paciente: Paciente) => {
    startDrag({
      type: 'paciente',
      data: paciente,
      preview: {
        title: paciente.nome,
        subtitle: paciente.telefone,
        color: '#3B82F6'
      }
    })
  }, [startDrag])

  // Manipular drag de terapia
  const handleTerapiaDragStart = useCallback((terapia: Terapia) => {
    startDrag({
      type: 'terapia',
      data: terapia,
      preview: {
        title: terapia.nome,
        subtitle: `R$ ${terapia.preco.toFixed(2)} • ${terapia.duracao}min`,
        color: terapia.cor
      }
    })
  }, [startDrag])

  // Atualizar filtros
  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-8 h-8 p-0"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        
        <div className="flex flex-col space-y-2 mt-4">
          <Button
            variant={activeTab === 'pacientes' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('pacientes')}
            className="w-8 h-8 p-0"
            title="Pacientes"
          >
            <Users className="w-4 h-4" />
          </Button>
          
          <Button
            variant={activeTab === 'terapias' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('terapias')}
            className="w-8 h-8 p-0"
            title="Terapias"
          >
            <Stethoscope className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Recursos</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="w-8 h-8 p-0"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Busca */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pacientes' | 'terapias')} className="flex-1 flex flex-col">
        <div className="px-4 pt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pacientes" className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Pacientes
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                {pacientesFiltrados.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="terapias" className="flex items-center">
              <Stethoscope className="w-4 h-4 mr-2" />
              Terapias
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                {terapiasFiltradas.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="text-sm border-none bg-transparent focus:ring-0"
              >
                <option value="nome">Nome</option>
                {activeTab === 'pacientes' && <option value="data">Último agendamento</option>}
                <option value="frequencia">Frequência</option>
              </select>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
              className="w-8 h-8 p-0"
            >
              {filters.sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          
          {activeTab === 'terapias' && (
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filters.showInactive}
                onChange={(e) => updateFilter('showInactive', e.target.checked)}
                className="w-4 h-4 mr-2 text-blue-600 rounded focus:ring-blue-500"
              />
              Mostrar terapias inativas
            </label>
          )}
        </div>

        {/* Conteúdo das Tabs */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="pacientes" className="h-full p-0 m-0">
            <div className="p-4 pb-2">
              <Button
                onClick={() => onOpenPacienteModal('create')}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Paciente
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    Carregando pacientes...
                  </div>
                ) : pacientesFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {filters.searchTerm ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
                  </div>
                ) : (
                  pacientesFiltrados.map((paciente) => (
                    <Card
                      key={paciente.id}
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                      draggable
                      onDragStart={() => handlePacienteDragStart(paciente)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-1">
                              <Grip className="w-3 h-3 text-gray-400 mr-2 flex-shrink-0" />
                              <h4 className="font-medium text-sm text-gray-900 truncate">
                                {paciente.nome}
                              </h4>
                            </div>
                            
                            <div className="flex items-center text-xs text-gray-600 mb-2">
                              <Phone className="w-3 h-3 mr-1" />
                              {paciente.telefone}
                            </div>
                            
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center text-gray-500">
                                <Calendar className="w-3 h-3 mr-1" />
                                {paciente.totalAgendamentos} agendamentos
                              </div>
                              
                              {paciente.proximoAgendamento && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  Próximo: {new Date(paciente.proximoAgendamento.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col space-y-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onOpenPacienteModal('edit', paciente)}
                              className="w-6 h-6 p-0"
                            >
                              <User className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="terapias" className="h-full p-0 m-0">
            <div className="p-4 pb-2">
              <Button
                onClick={() => onOpenTerapiaModal('create')}
                className="w-full bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Terapia
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    Carregando terapias...
                  </div>
                ) : terapiasFiltradas.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Stethoscope className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {filters.searchTerm ? 'Nenhuma terapia encontrada' : 'Nenhuma terapia cadastrada'}
                  </div>
                ) : (
                  terapiasFiltradas.map((terapia) => (
                    <Card
                      key={terapia.id}
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      style={{ borderLeftColor: terapia.cor, borderLeftWidth: '4px' }}
                      draggable
                      onDragStart={() => handleTerapiaDragStart(terapia)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-1">
                              <Grip className="w-3 h-3 text-gray-400 mr-2 flex-shrink-0" />
                              <div 
                                className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                                style={{ backgroundColor: terapia.cor }}
                              />
                              <h4 className="font-medium text-sm text-gray-900 truncate">
                                {terapia.nome}
                              </h4>
                              {!terapia.ativa && (
                                <EyeOff className="w-3 h-3 text-gray-400 ml-1" />
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between text-xs mb-2">
                              <div className="flex items-center text-gray-600">
                                <DollarSign className="w-3 h-3 mr-1" />
                                R$ {terapia.preco.toFixed(2)}
                              </div>
                              <div className="flex items-center text-gray-600">
                                <Clock className="w-3 h-3 mr-1" />
                                {terapia.duracao}min
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center text-gray-500">
                                <Calendar className="w-3 h-3 mr-1" />
                                {terapia.totalAgendamentos} agendamentos
                              </div>
                              
                              {terapia.agendamentosAtivos > 0 && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  {terapia.agendamentosAtivos} ativos
                                </Badge>
                              )}
                            </div>
                            
                            {terapia.faturamentoTotal > 0 && (
                              <div className="mt-1 text-xs text-green-600 font-medium">
                                Faturamento: R$ {terapia.faturamentoTotal.toFixed(2)}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col space-y-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onOpenTerapiaModal('edit', terapia)}
                              className="w-6 h-6 p-0"
                            >
                              <Stethoscope className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Rodapé com estatísticas */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600">
          {activeTab === 'pacientes' ? (
            <div className="space-y-1">
              <div>Total: {pacientes.length} pacientes</div>
              <div>Agendamentos: {agendamentos.length}</div>
            </div>
          ) : (
            <div className="space-y-1">
              <div>Total: {terapias.length} terapias</div>
              <div>Ativas: {terapias.filter(t => t.ativa).length}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}