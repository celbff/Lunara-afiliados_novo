// app/agenda/calendar/page.tsx - Calendário Completo com Drag & Drop
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Download,
  Settings
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  format as formatDate,
  parseISO
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

interface DragItem {
  type: 'agendamento'
  id: string
  agendamento: any
}

// Componente de Agendamento Arrastável
function AgendamentoItem({ agendamento }: { agendamento: any }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'agendamento',
    item: { type: 'agendamento', id: agendamento.id, agendamento },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado': return 'bg-green-500'
      case 'agendado': return 'bg-blue-500'
      case 'concluido': return 'bg-gray-500'
      case 'cancelado': return 'bg-red-500'
      case 'faltou': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div
      ref={drag}
      className={`p-2 mb-1 rounded text-white text-xs cursor-move transition-opacity ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${getStatusColor(agendamento.status)}`}
      style={{ backgroundColor: agendamento.terapia?.cor || '#6B7280' }}
    >
      <div className="font-medium truncate">
        {agendamento.paciente?.nome}
      </div>
      <div className="text-xs opacity-90">
        {agendamento.hora} - {agendamento.terapia?.nome}
      </div>
    </div>
  )
}

// Componente de Dia do Calendário
function DiaCalendario({ 
  data, 
  agendamentos, 
  isCurrentMonth, 
  isToday: ehHoje, 
  onDropAgendamento 
}: {
  data: Date
  agendamentos: any[]
  isCurrentMonth: boolean
  isToday: boolean
  onDropAgendamento: (agendamento: any, novaData: string) => void
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'agendamento',
    drop: (item: DragItem) => {
      const novaData = format(data, 'yyyy-MM-dd')
      onDropAgendamento(item.agendamento, novaData)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }))

  const agendamentosHoje = agendamentos.filter(
    agendamento => agendamento.data === format(data, 'yyyy-MM-dd')
  )

  return (
    <div
      ref={drop}
      className={`min-h-24 border border-gray-200 p-1 transition-colors ${
        isCurrentMonth ? 'bg-white' : 'bg-gray-50'
      } ${ehHoje ? 'ring-2 ring-blue-500' : ''} ${
        isOver ? 'bg-blue-50 border-blue-300' : ''
      }`}
    >
      <div className={`text-sm font-medium mb-1 ${
        isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
      } ${ehHoje ? 'text-blue-600' : ''}`}>
        {format(data, 'd')}
      </div>
      
      <div className="space-y-1">
        {agendamentosHoje.map((agendamento) => (
          <AgendamentoItem key={agendamento.id} agendamento={agendamento} />
        ))}
      </div>
      
      {agendamentosHoje.length > 3 && (
        <div className="text-xs text-gray-500 mt-1">
          +{agendamentosHoje.length - 3} mais
        </div>
      )}
    </div>
  )
}

export default function CalendarioPage() {
  const { state, actions } = useAgenda()
  const { agendamentos, pacientes, terapias, loading } = state
  
  const [dataAtual, setDataAtual] = useState(new Date())
  const [filtroTerapia, setFiltroTerapia] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  
  // Dados do mês atual
  const inicioMes = startOfMonth(dataAtual)
  const fimMes = endOfMonth(dataAtual)
  const diasMes = eachDayOfInterval({ start: inicioMes, end: fimMes })
  
  // Adicionar dias da semana anterior e posterior para completar a grade
  const primeiroDiaSemana = diasMes[0].getDay()
  const ultimoDiaSemana = diasMes[diasMes.length - 1].getDay()
  
  const diasAntes = []
  for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
    const dia = new Date(inicioMes)
    dia.setDate(dia.getDate() - (i + 1))
    diasAntes.push(dia)
  }
  
  const diasDepois = []
  for (let i = ultimoDiaSemana + 1; i <= 6; i++) {
    const dia = new Date(fimMes)
    dia.setDate(dia.getDate() + (i - ultimoDiaSemana))
    diasDepois.push(dia)
  }
  
  const todosOsDias = [...diasAntes, ...diasMes, ...diasDepois]
  
  // Filtrar agendamentos
  const agendamentosFiltrados = agendamentos.filter(agendamento => {
    if (filtroTerapia && agendamento.terapia_id !== filtroTerapia) return false
    if (filtroStatus && agendamento.status !== filtroStatus) return false
    return true
  })
  
  // Função para mover agendamento
  const onDropAgendamento = async (agendamento: any, novaData: string) => {
    if (agendamento.data === novaData) return
    
    try {
      await actions.updateAgendamento(agendamento.id, { data: novaData })
    } catch (error) {
      console.error('Erro ao mover agendamento:', error)
    }
  }
  
  // Navegar entre meses
  const mesAnterior = () => setDataAtual(subMonths(dataAtual, 1))
  const proximoMes = () => setDataAtual(addMonths(dataAtual, 1))
  const irParaHoje = () => setDataAtual(new Date())
  
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Header do Calendário */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={mesAnterior}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h2 className="text-2xl font-bold text-gray-900">
              {format(dataAtual, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            
            <Button variant="outline" onClick={proximoMes}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button variant="outline" onClick={irParaHoje}>
              Hoje
            </Button>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Filtros */}
            <select
              value={filtroTerapia}
              onChange={(e) => setFiltroTerapia(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas as terapias</option>
              {terapias.map(terapia => (
                <option key={terapia.id} value={terapia.id}>
                  {terapia.nome}
                </option>
              ))}
            </select>
            
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="agendado">Agendado</option>
              <option value="confirmado">Confirmado</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
              <option value="faltou">Faltou</option>
            </select>
            
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </div>
        
        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {agendamentosFiltrados.filter(a => 
                    format(parseISO(a.data), 'yyyy-MM') === format(dataAtual, 'yyyy-MM')
                  ).length}
                </p>
                <p className="text-sm text-gray-600">Agendamentos do Mês</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {agendamentosFiltrados.filter(a => 
                    a.status === 'concluido' && 
                    format(parseISO(a.data), 'yyyy-MM') === format(dataAtual, 'yyyy-MM')
                  ).length}
                </p>
                <p className="text-sm text-gray-600">Concluídos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {agendamentosFiltrados.filter(a => 
                    a.status === 'agendado' && 
                    format(parseISO(a.data), 'yyyy-MM') === format(dataAtual, 'yyyy-MM')
                  ).length}
                </p>
                <p className="text-sm text-gray-600">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {agendamentosFiltrados.filter(a => 
                    a.status === 'cancelado' && 
                    format(parseISO(a.data), 'yyyy-MM') === format(dataAtual, 'yyyy-MM')
                  ).length}
                </p>
                <p className="text-sm text-gray-600">Cancelados</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Grade do Calendário */}
        <Card>
          <CardContent className="p-6">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 gap-px mb-2">
              {diasSemana.map(dia => (
                <div key={dia} className="text-center text-sm font-medium text-gray-700 py-2">
                  {dia}
                </div>
              ))}
            </div>
            
            {/* Grade dos dias */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {todosOsDias.map((dia, index) => (
                <DiaCalendario
                  key={index}
                  data={dia}
                  agendamentos={agendamentosFiltrados}
                  isCurrentMonth={isSameMonth(dia, dataAtual)}
                  isToday={isToday(dia)}
                  onDropAgendamento={onDropAgendamento}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Legenda */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Legenda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-sm">Agendado</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm">Confirmado</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-500 rounded"></div>
                <span className="text-sm">Concluído</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm">Cancelado</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-sm">Faltou</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DndProvider>
  )
}