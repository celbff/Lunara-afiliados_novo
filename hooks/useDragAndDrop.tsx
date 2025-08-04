// hooks/useDragAndDrop.tsx - Hook para funcionalidade de Drag & Drop
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Paciente, Terapia } from '@/types/agenda'

// Tipos para drag & drop
export interface DragData {
  type: 'paciente' | 'terapia' | 'agendamento'
  data: Paciente | Terapia | any
  preview: {
    title: string
    subtitle: string
    color: string
  }
}

export interface DropTarget {
  type: 'calendar-slot' | 'trash' | 'sidebar'
  data?: {
    date?: string
    time?: string
    slotId?: string
  }
}

export interface DragState {
  isDragging: boolean
  dragData: DragData | null
  dropTarget: DropTarget | null
  dragPosition: { x: number; y: number }
}

export interface UseDragAndDropReturn {
  dragState: DragState
  startDrag: (data: DragData) => void
  endDrag: () => void
  updateDragPosition: (x: number, y: number) => void
  setDropTarget: (target: DropTarget | null) => void
  handleDrop: (onDrop: (dragData: DragData, target: DropTarget) => void) => void
}

export function useDragAndDrop(): UseDragAndDropReturn {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragData: null,
    dropTarget: null,
    dragPosition: { x: 0, y: 0 }
  })

  const dropCallbackRef = useRef<((dragData: DragData, target: DropTarget) => void) | null>(null)

  // Iniciar drag
  const startDrag = useCallback((data: DragData) => {
    setDragState(prev => ({
      ...prev,
      isDragging: true,
      dragData: data,
      dropTarget: null
    }))

    // Adicionar listeners globais para mouse
    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => ({
        ...prev,
        dragPosition: { x: e.clientX, y: e.clientY }
      }))
    }

    const handleMouseUp = () => {
      // Se há um alvo de drop válido, executar callback
      if (dragState.dropTarget && dragState.dragData && dropCallbackRef.current) {
        dropCallbackRef.current(dragState.dragData, dragState.dropTarget)
      }
      
      endDrag()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [dragState.dropTarget, dragState.dragData])

  // Finalizar drag
  const endDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      dragData: null,
      dropTarget: null,
      dragPosition: { x: 0, y: 0 }
    })
  }, [])

  // Atualizar posição do drag
  const updateDragPosition = useCallback((x: number, y: number) => {
    setDragState(prev => ({
      ...prev,
      dragPosition: { x, y }
    }))
  }, [])

  // Definir alvo de drop
  const setDropTarget = useCallback((target: DropTarget | null) => {
    setDragState(prev => ({
      ...prev,
      dropTarget: target
    }))
  }, [])

  // Configurar callback de drop
  const handleDrop = useCallback((onDrop: (dragData: DragData, target: DropTarget) => void) => {
    dropCallbackRef.current = onDrop
  }, [])

  // Limpar listeners ao desmontar
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', () => {})
      document.removeEventListener('mouseup', () => {})
    }
  }, [])

  return {
    dragState,
    startDrag,
    endDrag,
    updateDragPosition,
    setDropTarget,
    handleDrop
  }
}

// Hook para elementos que podem receber drop
export function useDropZone(
  target: DropTarget,
  onDrop?: (dragData: DragData, target: DropTarget) => void
) {
  const [isOver, setIsOver] = useState(false)
  const [canDrop, setCanDrop] = useState(false)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(true)
    
    // Verificar se o tipo de drag é compatível
    const dragType = e.dataTransfer?.types?.[0]
    setCanDrop(dragType === 'text/plain') // Simplificado - melhorar validação
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    setCanDrop(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    setCanDrop(false)

    try {
      const dragDataString = e.dataTransfer?.getData('text/plain')
      if (dragDataString && onDrop) {
        const dragData: DragData = JSON.parse(dragDataString)
        onDrop(dragData, target)
      }
    } catch (error) {
      console.error('Erro ao processar drop:', error)
    }
  }, [target, onDrop])

  return {
    isOver,
    canDrop,
    dropProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop
    }
  }
}

// Componente de preview do drag
export function DragPreview({ dragState }: { dragState: DragState }) {
  if (!dragState.isDragging || !dragState.dragData) {
    return null
  }

  const { preview } = dragState.dragData
  const { x, y } = dragState.dragPosition

  return (
    <div
      className="fixed pointer-events-none z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-xs"
      style={{
        left: x + 10,
        top: y + 10,
        transform: 'translate(0, -50%)'
      }}
    >
      <div className="flex items-center">
        <div
          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
          style={{ backgroundColor: preview.color }}
        />
        <div className="min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">
            {preview.title}
          </div>
          <div className="text-xs text-gray-600 truncate">
            {preview.subtitle}
          </div>
        </div>
      </div>
    </div>
  )
}

// Utilitários para drag & drop
export const DragUtils = {
  // Converter dados para formato de transferência
  serializeDragData: (data: DragData): string => {
    return JSON.stringify(data)
  },

  // Recuperar dados do formato de transferência
  deserializeDragData: (dataString: string): DragData | null => {
    try {
      return JSON.parse(dataString)
    } catch {
      return null
    }
  },

  // Verificar se um elemento é válido para drop
  isValidDropTarget: (dragType: string, targetType: string): boolean => {
    const validCombinations: Record<string, string[]> = {
      'paciente': ['calendar-slot'],
      'terapia': ['calendar-slot'],
      'agendamento': ['calendar-slot', 'trash']
    }

    return validCombinations[dragType]?.includes(targetType) || false
  },

  // Obter cursor apropriado para o estado de drag
  getDragCursor: (isDragging: boolean, canDrop: boolean): string => {
    if (!isDragging) return 'default'
    return canDrop ? 'grabbing' : 'no-drop'
  }
}

// Hook para integração com HTML5 Drag API
export function useHTML5Drag(data: DragData) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const serializedData = DragUtils.serializeDragData(data)
    e.dataTransfer.setData('text/plain', serializedData)
    e.dataTransfer.effectAllowed = 'move'
    
    // Criar imagem de preview customizada se necessário
    const dragImage = document.createElement('div')
    dragImage.innerHTML = `
      <div style="
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 8px 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        max-width: 200px;
      ">
        <div style="font-weight: 500; color: #111; margin-bottom: 2px;">
          ${data.preview.title}
        </div>
        <div style="font-size: 12px; color: #666;">
          ${data.preview.subtitle}
        </div>
      </div>
    `
    
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    document.body.appendChild(dragImage)
    
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    
    // Remover elemento temporário após um pequeno delay
    setTimeout(() => {
      document.body.removeChild(dragImage)
    }, 100)
  }, [data])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    // Drag finalizado
    e.dataTransfer.clearData()
  }, [])

  return {
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    draggable: true
  }
}