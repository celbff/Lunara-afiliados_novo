// components/CalendarioAvancado.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiClient } from '../lib/api';
import { useNotification } from '../hooks/useNotification';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import '../styles/CalendarioAvancado.css';

const CalendarioAvancado = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [isMoving, setIsMoving] = useState(false);
  const [isBulkAction, setIsBulkAction] = useState(false);
  
  const { showNotification } = useNotification();
  const { state, setState, undo, redo } = useUndoRedo(bookings);
  const { registerShortcut } = useKeyboardShortcuts();

  // Registrar atalhos de teclado
  useEffect(() => {
    registerShortcut('ctrl+z', () => {
      undo();
      showNotification('Desfeito', 'info');
    });
    
    registerShortcut('ctrl+y', () => {
      redo();
      showNotification('Refeito', 'info');
    });
    
    registerShortcut('escape', () => {
      setSelectedBooking(null);
      setShowBookingModal(false);
    });
  }, [undo, redo, showNotification, registerShortcut]);

  // Carregar agendamentos
  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const endDate = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const response = await apiClient.getBookings({ startDate, endDate });
      
      if (response.success) {
        const bookingsData = response.data.bookings;
        setBookings(bookingsData);
        setState(bookingsData);
      } else {
        showNotification(response.message || 'Erro ao carregar agendamentos', 'error');
      }
    } catch (error) {
      showNotification('Erro na comunicação com o servidor', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentDate, setState, showNotification]);

  // Carregar terapeutas - memoizado para evitar recargas desnecessárias
  const loadTherapists = useCallback(async () => {
    try {
      const response = await apiClient.getTherapists();
      
      if (response.success) {
        setTherapists(response.data.therapists);
      } else {
        showNotification(response.message || 'Erro ao carregar terapeutas', 'error');
      }
    } catch (error) {
      showNotification('Erro na comunicação com o servidor', 'error');
    }
  }, [showNotification]);

  useEffect(() => {
    loadBookings();
    loadTherapists();
  }, [loadBookings, loadTherapists]);

  // Atualizar estado quando undo/redo for usado
  useEffect(() => {
    setBookings(state);
  }, [state]);

  // Gerar dias da semana - memoizado para evitar recálculos
  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(currentDate, { weekStartsOn: 1 }),
      end: endOfWeek(currentDate, { weekStartsOn: 1 })
    });
  }, [currentDate]);

  // Agrupar agendamentos por dia - memoizado para melhor performance
  const bookingsByDay = useMemo(() => {
    const result = {};
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      result[dayKey] = bookings.filter(booking => 
        isSameDay(parseISO(booking.date), day)
      );
    });
    return result;
  }, [bookings, weekDays]);

  // Lidar com drag and drop - melhorado com feedback visual
  const handleDragEnd = useCallback(async (result) => {
    if (!result.destination) return;
    
    const { source, destination, draggableId } = result;
    const bookingId = parseInt(draggableId);
    const booking = bookings.find(b => b.id === bookingId);
    
    if (!booking) return;
    
    try {
      setIsMoving(true);
      
      // Se for movido para outro dia
      if (source.droppableId !== destination.droppableId) {
        const newDay = weekDays.find(day => 
          format(day, 'yyyy-MM-dd') === destination.droppableId
        );
        
        if (!newDay) return;
        
        // Preparar dados para atualização
        const updateData = {
          date: format(newDay, 'yyyy-MM-dd'),
          startTime: booking.start_time
        };
        
        // Se o destino for um horário específico
        if (destination.index !== undefined) {
          const dayBookings = bookingsByDay[destination.droppableId];
          const targetBooking = dayBookings[destination.index];
          
          if (targetBooking) {
            updateData.startTime = targetBooking.start_time;
          }
        }
        
        // Enviar para API
        const response = await apiClient.moveBooking(bookingId, updateData);
        
        if (response.success) {
          // Atualizar estado local
          const updatedBookings = bookings.map(b => 
            b.id === bookingId 
              ? { 
                  ...b, 
                  date: updateData.date, 
                  start_time: updateData.startTime 
                } 
              : b
          );
          
          setBookings(updatedBookings);
          setState(updatedBookings);
          showNotification('Agendamento movido com sucesso', 'success');
        } else {
          showNotification(response.message || 'Erro ao mover agendamento', 'error');
        }
      }
    } catch (error) {
      showNotification('Erro na comunicação com o servidor', 'error');
    } finally {
      setIsMoving(false);
    }
  }, [bookings, weekDays, bookingsByDay, setState, showNotification]);

  // Selecionar agendamento
  const handleSelectBooking = useCallback((booking) => {
    setSelectedBooking(booking);
    setShowBookingModal(true);
  }, []);

  // Alternar seleção para ações em lote
  const toggleBookingSelection = useCallback((bookingId) => {
    setSelectedBookings(prev => 
      prev.includes(bookingId) 
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  }, []);

  // Executar ação em lote - melhorado com processamento paralelo
  const executeBulkAction = useCallback(async (action) => {
    if (selectedBookings.length === 0) {
      showNotification('Nenhum agendamento selecionado', 'warning');
      return;
    }
    
    try {
      setIsBulkAction(true);
      
      // Criar array de promessas para execução paralela
      const promises = selectedBookings.map(bookingId => {
        switch (action) {
          case 'confirm':
            return apiClient.updateBookingStatus(bookingId, 'completed');
          case 'cancel':
            return apiClient.deleteBooking(bookingId);
          default:
            return Promise.resolve({ success: false });
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      const successCount = results.filter(
        result => result.status === 'fulfilled' && result.value.success
      ).length;
      
      if (successCount === selectedBookings.length) {
        showNotification(
          `${action === 'confirm' ? 'Confirmação' : 'Cancelamento'} de ${successCount} agendamentos realizado com sucesso`, 
          'success'
        );
      } else {
        showNotification(
          `${successCount} de ${selectedBookings.length} agendamentos ${action === 'confirm' ? 'confirmados' : 'cancelados'}`, 
          'warning'
        );
      }
      
      // Limpar seleção e recarregar
      setSelectedBookings([]);
      loadBookings();
    } catch (error) {
      showNotification('Erro ao executar ação em lote', 'error');
    } finally {
      setIsBulkAction(false);
    }
  }, [selectedBookings, loadBookings, showNotification]);

  // Renderizar dia da semana - memoizado para melhor performance
  const renderDay = useCallback((day, index) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayBookings = bookingsByDay[dayKey] || [];
    
    return (
      <div key={dayKey} className="calendar-day">
        <div className="day-header">
          <h3>{format(day, 'EEEE', { locale: ptBR })}</h3>
          <span>{format(day, 'dd/MM')}</span>
        </div>
        
        <Droppable droppableId={dayKey}>
          {(provided) => (
            <div 
              ref={provided.innerRef} 
              {...provided.droppableProps}
              className="day-content"
            >
              {dayBookings.map((booking, bookingIndex) => (
                <Draggable 
                  key={booking.id} 
                  draggableId={booking.id.toString()} 
                  index={bookingIndex}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`booking-item ${booking.status} ${
                        selectedBookings.includes(booking.id) ? 'selected' : ''
                      }`}
                      onClick={() => handleSelectBooking(booking)}
                    >
                      <div className="booking-time">{booking.start_time}</div>
                      <div className="booking-info">
                        <div className="booking-client">{booking.client_name}</div>
                        <div className="booking-service">{booking.service_name}</div>
                      </div>
                      <div className="booking-actions">
                        <input
                          type="checkbox"
                          checked={selectedBookings.includes(booking.id)}
                          onChange={() => toggleBookingSelection(booking.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  }, [bookingsByDay, selectedBookings, handleSelectBooking, toggleBookingSelection]);

  if (loading) {
    return <div className="loading">Carregando calendário...</div>;
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>Agenda de Terapeutas</h2>
        <div className="calendar-controls">
          <button onClick={() => setCurrentDate(addDays(currentDate, -7))}>
            Semana Anterior
          </button>
          <span>
            {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
          </span>
          <button onClick={() => setCurrentDate(addDays(currentDate, 7))}>
            Próxima Semana
          </button>
          <button 
            className={`bulk-actions-btn ${showBulkActions ? 'active' : ''}`}
            onClick={() => setShowBulkActions(!showBulkActions)}
          >
            Ações em Lote
          </button>
        </div>
      </div>
      
      {showBulkActions && (
        <div className="bulk-actions">
          <span>{selectedBookings.length} agendamentos selecionados</span>
          <button 
            onClick={() => executeBulkAction('confirm')}
            disabled={isBulkAction}
          >
            {isBulkAction ? 'Processando...' : 'Confirmar Selecionados'}
          </button>
          <button 
            onClick={() => executeBulkAction('cancel')}
            disabled={isBulkAction}
          >
            {isBulkAction ? 'Processando...' : 'Cancelar Selecionados'}
          </button>
          <button onClick={() => setSelectedBookings([])}>
            Limpar Seleção
          </button>
        </div>
      )}
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={`calendar-grid ${isMoving ? 'moving' : ''}`}>
          {weekDays.map(renderDay)}
        </div>
      </DragDropContext>
      
      {showBookingModal && selectedBooking && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalhes do Agendamento</h3>
              <button onClick={() => setShowBookingModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>Cliente:</strong> {selectedBooking.client_name}</p>
              <p><strong>Terapeuta:</strong> {selectedBooking.therapist_name}</p>
              <p><strong>Serviço:</strong> {selectedBooking.service_name}</p>
              <p><strong>Data:</strong> {format(parseISO(selectedBooking.date), 'dd/MM/yyyy')}</p>
              <p><strong>Horário:</strong> {selectedBooking.start_time} - {selectedBooking.end_time}</p>
              <p><strong>Status:</strong> {selectedBooking.status}</p>
              {selectedBooking.notes && (
                <p><strong>Observações:</strong> {selectedBooking.notes}</p>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowBookingModal(false)}>Fechar</button>
              {selectedBooking.status === 'scheduled' && (
                <>
                  <button 
                    onClick={async () => {
                      const response = await apiClient.updateBookingStatus(selectedBooking.id, 'completed');
                      if (response.success) {
                        showNotification('Agendamento confirmado com sucesso', 'success');
                        loadBookings();
                        setShowBookingModal(false);
                      } else {
                        showNotification(response.message || 'Erro ao confirmar agendamento', 'error');
                      }
                    }}
                  >
                    Confirmar
                  </button>
                  <button 
                    onClick={async () => {
                      const response = await apiClient.deleteBooking(selectedBooking.id);
                      if (response.success) {
                        showNotification('Agendamento cancelado com sucesso', 'success');
                        loadBookings();
                        setShowBookingModal(false);
                      } else {
                        showNotification(response.message || 'Erro ao cancelar agendamento', 'error');
                      }
                    }}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarioAvancado;