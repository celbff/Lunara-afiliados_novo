// components/calendar/CalendarDropZone.tsx - Zona de Drop no Calendário
'use client'

import React, { useState, useCallback } from 'react'
import { useDropZone, type DragData, type DropTarget } from '@/hooks/useDragAndDrop'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Paciente, Terapia } from '@/types/agenda'

interface CalendarDropZoneProps {
  date: string // YYYY-MM-DD
  timeSlot: string // HH:MM
  children: React.ReactNode
  className?: string
  onAgendamentoCreate?: (agendamento: any) => void
}

export default function CalendarDropZone({
  date,
  timeSlot,
  children,
  className = '',
  onAgendamentoCreate
}: CalendarDropZoneProps) {
  const { actions } = useAgenda()
  const [isCreating, setIsCreating] = useState(false)

  // Configurar drop target
  const dropTarget: DropTarget = {
    type: 'calendar-slot',
    data: {
      date,
      time: timeSlot,
      slotId: `${date}-${timeSlot}`
    }
  }

  // Manipular drop
  const handleDrop = useCallback(async (dragData: DragData, target: DropTarget) => {
    if (isCreating) return // Evitar múltiplos drops simultâneos

    setIsCreating(true)

    try {
      // Verificar se a data/hora não é no passado
      const agendamentoDateTime = new Date(`${date}T${timeSlot}`)
      const agora = new Date()
      
      if (agendamentoDateTime < agora) {
        toast({
          title: "Erro ao criar agendamento",
          description: "Não é possível agendar no passado.",
          variant: "destructive"
        })
        return
      }

      if (dragData.type === 'paciente') {
        // Drop de paciente - abrir modal de seleção de terapia ou criar agendamento básico
        const paciente = dragData.data as Paciente
        
        toast({
          title: "Paciente adicionado",
          description: `${paciente.nome} foi posicionado em ${format(agendamentoDateTime, 'dd/MM/yyyy', { locale: ptBR })} às ${timeSlot}. Selecione uma terapia para completar o agendamento.`,
        })

        // Callback para abrir modal de agendamento com paciente pré-selecionado
        if (onAgendamentoCreate) {
          onAgendamentoCreate({
            paciente_id: paciente.id,
            data: date,
            hora: timeSlot,
            status: 'agendado'
          })
        }

      } else if (dragData.type === 'terapia') {
        // Drop de terapia - abrir modal de seleção de paciente ou criar agendamento básico
        const terapia = dragData.data as Terapia
        
        toast({
          title: "Terapia adicionada",
          description: `${terapia.nome} foi posicionada em ${format(agendamentoDateTime, 'dd/MM/yyyy', { locale: ptBR })} às ${timeSlot}. Selecione um paciente para completar o agendamento.`,
        })

        // Callback para abrir modal de agendamento com terapia pré-selecionada
        if (onAgendamentoCreate) {
          onAgendamentoCreate({
            terapia_id: terapia.id,
            data: date,
            hora: timeSlot,
            status: 'agendado',
            valor: terapia.preco
          })
        }

      } else if (dragData.type === 'agendamento') {
        // Drop de agendamento existente - mover agendamento
        const agendamento = dragData.data
        
        // Verificar conflito de horário
        const conflito = await actions.checkConflict(date, timeSlot, agendamento.id)
        
        if (conflito) {
          toast({
            title: "Conflito de horário",
            description: "Já existe um agendamento neste horário.",
            variant: "destructive"
          })
          return
        }

        // Atualizar agendamento
        await actions.updateAgendamento(agendamento.id, {
          data: date,
          hora: timeSlot
        })

        toast({
          title: "Agendamento movido",
          description: `Agendamento movido para ${format(agendamentoDateTime, 'dd/MM/yyyy', { locale: ptBR })} às ${timeSlot}.`,
        })
      }

    } catch (error) {
      console.error('Erro ao processar drop:', error)
      toast({
        title: "Erro ao processar ação",
        description: "Ocorreu um erro ao processar a ação. Tente novamente.",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }, [date, timeSlot, actions, onAgendamentoCreate, isCreating])

  // Usar hook de drop zone
  const { isOver, canDrop, dropProps } = useDropZone(dropTarget, handleDrop)

  // Classes CSS baseadas no estado
  const dropZoneClasses = [
    className,
    'transition-all duration-200',
    isOver && canDrop && 'bg-blue-50 border-blue-300 border-2 border-dashed',
    isOver && !canDrop && 'bg-red-50 border-red-300 border-2 border-dashed',
    isCreating && 'opacity-50 pointer-events-none'
  ].filter(Boolean).join(' ')

  return (
    <div
      className={dropZoneClasses}
      {...dropProps}
    >
      {children}
      
      {/* Indicator visual quando hovering */}
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          {canDrop ? (
            <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
              Soltar aqui
            </div>
          ) : (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
              Não permitido
            </div>
          )}
        </div>
      )}
      
      {/* Loading indicator */}
      {isCreating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-gray-800 bg-opacity-75 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
            Criando agendamento...
          </div>
        </div>
      )}
    </div>
  )
}

// Componente para slots de tempo vazios com visual de drop zone
export function EmptyTimeSlot({
  date,
  timeSlot,
  onAgendamentoCreate,
  className = ''
}: {
  date: string
  timeSlot: string
  onAgendamentoCreate?: (agendamento: any) => void
  className?: string
}) {
  return (
    <CalendarDropZone
      date={date}
      timeSlot={timeSlot}
      onAgendamentoCreate={onAgendamentoCreate}
      className={`min-h-[60px] border border-gray-200 rounded-lg hover:bg-gray-50 ${className}`}
    >
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        <div className="text-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            Arrastar para agendar
          </div>
        </div>
      </div>
    </CalendarDropZone>
  )
}

// Wrapper para agendamentos existentes que podem ser arrastados
export function DraggableAgendamento({
  agendamento,
  children,
  className = ''
}: {
  agendamento: any
  children: React.ReactNode
  className?: string
}) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const dragData: DragData = {
      type: 'agendamento',
      data: agendamento,
      preview: {
        title: agendamento.paciente?.nome || 'Agendamento',
        subtitle: `${agendamento.terapia?.nome || 'Terapia'} - ${agendamento.hora}`,
        color: agendamento.terapia?.cor || '#3B82F6'
      }
    }

    e.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'move'
  }, [agendamento])

  return (
    <div
      className={`cursor-grab active:cursor-grabbing ${className}`}
      draggable
      onDragStart={handleDragStart}
    >
      {children}
    </div>
  )
}

// Hook para integrar com o calendário principal
export function useCalendarDragDrop(onAgendamentoCreate?: (agendamento: any) => void) {
  const [draggedAgendamento, setDraggedAgendamento] = useState<any>(null)

  const handleAgendamentoDrag = useCallback((agendamento: any) => {
    setDraggedAgendamento(agendamento)
  }, [])

  const handleSlotDrop = useCallback((dragData: DragData, date: string, timeSlot: string) => {
    if (onAgendamentoCreate) {
      if (dragData.type === 'paciente') {
        onAgendamentoCreate({
          paciente_id: dragData.data.id,
          data: date,
          hora: timeSlot,
          status: 'agendado'
        })
      } else if (dragData.type === 'terapia') {
        onAgendamentoCreate({
          terapia_id: dragData.data.id,
          data: date,
          hora: timeSlot,
          status: 'agendado',
          valor: dragData.data.preco
        })
      }
    }
  }, [onAgendamentoCreate])

  const clearDragState = useCallback(() => {
    setDraggedAgendamento(null)
  }, [])

  return {
    draggedAgendamento,
    handleAgendamentoDrag,
    handleSlotDrop,
    clearDragState
  }
}