// hooks/useAgenda.ts - Hook principal para gerenciar estado da agenda
'use client'

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/use-toast'
import type {
  AgendaState,
  AgendaAction,
  Paciente,
  Terapia,
  Agendamento,
  TratamentoPendente,
  ConfiguracoesAgenda,
  EstatisticasAgenda,
  FiltrosAgenda,
  UseAgendaReturn
} from '@/types/agenda'

// Estado inicial
const initialState: AgendaState = {
  pacientes: [],
  terapias: [],
  agendamentos: [],
  tratamentosPendentes: [],
  configuracoes: {
    horaAbertura: '08:00',
    horaFechamento: '18:00',
    intervaloAgendamento: 30,
    diasFuncionamento: [1, 2, 3, 4, 5], // Segunda a sexta
    feriados: [],
    lembreteWhatsApp: true,
    lembreteEmail: true,
    antecedenciaLembrete: 24
  },
  loading: false,
  error: null
}

// Reducer
function agendaReducer(state: AgendaState, action: AgendaAction): AgendaState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    
    case 'SET_PACIENTES':
      return { ...state, pacientes: action.payload }
    
    case 'ADD_PACIENTE':
      return { 
        ...state, 
        pacientes: [...state.pacientes, action.payload]
      }
    
    case 'UPDATE_PACIENTE':
      return {
        ...state,
        pacientes: state.pacientes.map(p => 
          p.id === action.payload.id ? action.payload : p
        )
      }
    
    case 'DELETE_PACIENTE':
      return {
        ...state,
        pacientes: state.pacientes.filter(p => p.id !== action.payload)
      }
    
    case 'SET_TERAPIAS':
      return { ...state, terapias: action.payload }
    
    case 'ADD_TERAPIA':
      return { 
        ...state, 
        terapias: [...state.terapias, action.payload]
      }
    
    case 'UPDATE_TERAPIA':
      return {
        ...state,
        terapias: state.terapias.map(t => 
          t.id === action.payload.id ? action.payload : t
        )
      }
    
    case 'DELETE_TERAPIA':
      return {
        ...state,
        terapias: state.terapias.filter(t => t.id !== action.payload)
      }
    
    case 'SET_AGENDAMENTOS':
      return { ...state, agendamentos: action.payload }
    
    case 'ADD_AGENDAMENTO':
      return { 
        ...state, 
        agendamentos: [...state.agendamentos, action.payload]
      }
    
    case 'UPDATE_AGENDAMENTO':
      return {
        ...state,
        agendamentos: state.agendamentos.map(a => 
          a.id === action.payload.id ? action.payload : a
        )
      }
    
    case 'DELETE_AGENDAMENTO':
      return {
        ...state,
        agendamentos: state.agendamentos.filter(a => a.id !== action.payload)
      }
    
    case 'SET_TRATAMENTOS_PENDENTES':
      return { ...state, tratamentosPendentes: action.payload }
    
    case 'ADD_TRATAMENTO_PENDENTE':
      return { 
        ...state, 
        tratamentosPendentes: [...state.tratamentosPendentes, action.payload]
      }
    
    case 'UPDATE_TRATAMENTO_PENDENTE':
      return {
        ...state,
        tratamentosPendentes: state.tratamentosPendentes.map(t => 
          t.id === action.payload.id ? action.payload : t
        )
      }
    
    case 'DELETE_TRATAMENTO_PENDENTE':
      return {
        ...state,
        tratamentosPendentes: state.tratamentosPendentes.filter(t => t.id !== action.payload)
      }
    
    case 'SET_CONFIGURACOES':
      return { ...state, configuracoes: action.payload }
    
    default:
      return state
  }
}

// Context
const AgendaContext = createContext<UseAgendaReturn | null>(null)

// Provider
interface AgendaProviderProps {
  children: ReactNode
}

export function AgendaProvider({ children }: AgendaProviderProps) {
  const [state, dispatch] = useReducer(agendaReducer, initialState)
  const { user } = useAuth()

  // Funções auxiliares
  const handleError = (error: any, message: string) => {
    console.error(error)
    const errorMessage = error.message || message
    dispatch({ type: 'SET_ERROR', payload: errorMessage })
    toast({
      title: "Erro",
      description: errorMessage,
      variant: "destructive",
    })
  }

  const handleSuccess = (message: string) => {
    toast({
      title: "Sucesso",
      description: message,
    })
  }

  // Ações dos Pacientes
  const loadPacientes = async () => {
    if (!user) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('user_id', user.id)
        .order('nome')

      if (error) throw error

      dispatch({ type: 'SET_PACIENTES', payload: data || [] })
    } catch (error) {
      handleError(error, 'Erro ao carregar pacientes')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const addPaciente = async (pacienteData: Omit<Paciente, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('pacientes')
        .insert([{ ...pacienteData, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      dispatch({ type: 'ADD_PACIENTE', payload: data })
      handleSuccess('Paciente adicionado com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao adicionar paciente')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const updatePaciente = async (id: string, pacienteData: Partial<Paciente>) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('pacientes')
        .update(pacienteData)
        .eq('id', id)
        .eq('user_id', user?.id)
        .select()
        .single()

      if (error) throw error

      dispatch({ type: 'UPDATE_PACIENTE', payload: data })
      handleSuccess('Paciente atualizado com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao atualizar paciente')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const deletePaciente = async (id: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { error } = await supabase
        .from('pacientes')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id)

      if (error) throw error

      dispatch({ type: 'DELETE_PACIENTE', payload: id })
      handleSuccess('Paciente excluído com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao excluir paciente')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  // Ações das Terapias
  const loadTerapias = async () => {
    if (!user) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('terapias')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .order('nome')

      if (error) throw error

      dispatch({ type: 'SET_TERAPIAS', payload: data || [] })
    } catch (error) {
      handleError(error, 'Erro ao carregar terapias')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const addTerapia = async (terapiaData: Omit<Terapia, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('terapias')
        .insert([{ ...terapiaData, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      dispatch({ type: 'ADD_TERAPIA', payload: data })
      handleSuccess('Terapia adicionada com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao adicionar terapia')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const updateTerapia = async (id: string, terapiaData: Partial<Terapia>) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('terapias')
        .update(terapiaData)
        .eq('id', id)
        .eq('user_id', user?.id)
        .select()
        .single()

      if (error) throw error

      dispatch({ type: 'UPDATE_TERAPIA', payload: data })
      handleSuccess('Terapia atualizada com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao atualizar terapia')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const deleteTerapia = async (id: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { error } = await supabase
        .from('terapias')
        .update({ ativa: false })
        .eq('id', id)
        .eq('user_id', user?.id)

      if (error) throw error

      dispatch({ type: 'DELETE_TERAPIA', payload: id })
      handleSuccess('Terapia desativada com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao desativar terapia')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  // Ações dos Agendamentos
  const loadAgendamentos = async (filtros?: FiltrosAgenda) => {
    if (!user) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      let query = supabase
        .from('agendamentos')
        .select(`
          *,
          paciente:pacientes(*),
          terapia:terapias(*)
        `)
        .eq('user_id', user.id)

      // Aplicar filtros
      if (filtros?.dataInicio) {
        query = query.gte('data', filtros.dataInicio)
      }
      if (filtros?.dataFim) {
        query = query.lte('data', filtros.dataFim)
      }
      if (filtros?.paciente_id) {
        query = query.eq('paciente_id', filtros.paciente_id)
      }
      if (filtros?.terapia_id) {
        query = query.eq('terapia_id', filtros.terapia_id)
      }
      if (filtros?.status && filtros.status.length > 0) {
        query = query.in('status', filtros.status)
      }
      if (filtros?.pago !== undefined) {
        query = query.eq('pago', filtros.pago)
      }

      query = query.order('data').order('hora')

      const { data, error } = await query

      if (error) throw error

      dispatch({ type: 'SET_AGENDAMENTOS', payload: data || [] })
    } catch (error) {
      handleError(error, 'Erro ao carregar agendamentos')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const addAgendamento = async (agendamentoData: Omit<Agendamento, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return

    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('agendamentos')
        .insert([{ ...agendamentoData, user_id: user.id }])
        .select(`
          *,
          paciente:pacientes(*),
          terapia:terapias(*)
        `)
        .single()

      if (error) throw error

      dispatch({ type: 'ADD_AGENDAMENTO', payload: data })
      handleSuccess('Agendamento criado com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao criar agendamento')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const updateAgendamento = async (id: string, agendamentoData: Partial<Agendamento>) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { data, error } = await supabase
        .from('agendamentos')
        .update(agendamentoData)
        .eq('id', id)
        .eq('user_id', user?.id)
        .select(`
          *,
          paciente:pacientes(*),
          terapia:terapias(*)
        `)
        .single()

      if (error) throw error

      dispatch({ type: 'UPDATE_AGENDAMENTO', payload: data })
      handleSuccess('Agendamento atualizado com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao atualizar agendamento')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const deleteAgendamento = async (id: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id)

      if (error) throw error

      dispatch({ type: 'DELETE_AGENDAMENTO', payload: id })
      handleSuccess('Agendamento excluído com sucesso!')
    } catch (error) {
      handleError(error, 'Erro ao excluir agendamento')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  // Outras funções...
  const loadTratamentosPendentes = async () => {
    // Implementar
  }

  const addTratamentoPendente = async (tratamentoData: Omit<TratamentoPendente, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    // Implementar
  }

  const updateTratamentoPendente = async (id: string, tratamentoData: Partial<TratamentoPendente>) => {
    // Implementar
  }

  const deleteTratamentoPendente = async (id: string) => {
    // Implementar
  }

  const loadConfiguracoes = async () => {
    // Implementar
  }

  const updateConfiguracoes = async (configuracoes: Partial<ConfiguracoesAgenda>) => {
    // Implementar
  }

  const getEstatisticas = async (periodo?: { inicio: string; fim: string }): Promise<EstatisticasAgenda> => {
    // Implementar
    return {} as EstatisticasAgenda
  }

  const exportarDados = async () => {
    // Implementar
  }

  const importarDados = async (dados: any) => {
    // Implementar
  }

  // Carregar dados iniciais
  useEffect(() => {
    if (user) {
      loadPacientes()
      loadTerapias()
      loadAgendamentos()
      loadTratamentosPendentes()
      loadConfiguracoes()
    }
  }, [user])

  const actions = {
    loadPacientes,
    addPaciente,
    updatePaciente,
    deletePaciente,
    loadTerapias,
    addTerapia,
    updateTerapia,
    deleteTerapia,
    loadAgendamentos,
    addAgendamento,
    updateAgendamento,
    deleteAgendamento,
    loadTratamentosPendentes,
    addTratamentoPendente,
    updateTratamentoPendente,
    deleteTratamentoPendente,
    loadConfiguracoes,
    updateConfiguracoes,
    getEstatisticas,
    exportarDados,
    importarDados
  }

  return (
    <AgendaContext.Provider value={{ state, actions }}>
      {children}
    </AgendaContext.Provider>
  )
}

// Hook
export function useAgenda(): UseAgendaReturn {
  const context = useContext(AgendaContext)
  if (!context) {
    throw new Error('useAgenda must be used within an AgendaProvider')
  }
  return context
}