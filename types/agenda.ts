// types/agenda.ts - Definições de tipos baseadas no AgendaV2
export interface Paciente {
  id: string
  nome: string
  telefone: string
  email?: string
  endereco?: string
  observacoes?: string
  dataNascimento?: string
  cpf?: string
  created_at: string
  updated_at: string
  user_id: string
}

export interface Terapia {
  id: string
  nome: string
  cor: string
  preco: number
  duracao: number // em minutos
  descricao?: string
  ativa: boolean
  created_at: string
  updated_at: string
  user_id: string
}

export interface Agendamento {
  id: string
  paciente_id: string
  terapia_id: string
  data: string
  hora: string
  status: 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou'
  observacoes?: string
  valor?: number
  pago?: boolean
  created_at: string
  updated_at: string
  user_id: string
  
  // Dados relacionados (joins)
  paciente?: Paciente
  terapia?: Terapia
}

export interface TratamentoPendente {
  id: string
  paciente_id: string
  terapia_id: string
  sessoes_total: number
  sessoes_concluidas: number
  valor_total: number
  valor_pago: number
  data_inicio: string
  data_fim?: string
  status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
  observacoes?: string
  created_at: string
  updated_at: string
  user_id: string
  
  // Dados relacionados
  paciente?: Paciente
  terapia?: Terapia
}

// Tipos para o calendário
export interface DiaCalendario {
  data: string
  agendamentos: Agendamento[]
  feriado?: string
  disponivel: boolean
}

export interface MesCalendario {
  ano: number
  mes: number
  dias: DiaCalendario[]
}

// Tipos para estatísticas
export interface EstatisticasAgenda {
  agendamentosHoje: number
  agendamentosSemana: number
  agendamentosMes: number
  pacientesAtivos: number
  terapiasAtivas: number
  faturamentoHoje: number
  faturamentoSemana: number
  faturamentoMes: number
  taxaOcupacao: number
  sessoesConcluidas: number
  sessoesCanceladas: number
  pacientesNovos: number
}

// Tipos para filtros
export interface FiltrosAgenda {
  dataInicio?: string
  dataFim?: string
  paciente_id?: string
  terapia_id?: string
  status?: Agendamento['status'][]
  pago?: boolean
}

// Tipos para drag & drop (baseado no AgendaV2)
export interface DragItem {
  type: 'terapia' | 'paciente' | 'agendamento'
  id: string
  data?: any
}

// Tipos para configurações
export interface ConfiguracoesAgenda {
  horaAbertura: string
  horaFechamento: string
  intervaloAgendamento: number // em minutos
  diasFuncionamento: number[] // 0-6 (domingo-sabado)
  feriados: string[] // datas em formato YYYY-MM-DD
  lembreteWhatsApp: boolean
  lembreteEmail: boolean
  antecedenciaLembrete: number // em horas
}

// Tipos para relatórios
export interface RelatorioAgenda {
  periodo: {
    inicio: string
    fim: string
  }
  agendamentos: {
    total: number
    confirmados: number
    concluidos: number
    cancelados: number
    faltaram: number
  }
  faturamento: {
    total: number
    recebido: number
    pendente: number
  }
  pacientes: {
    total: number
    novos: number
    retornos: number
  }
  terapias: {
    mais_procuradas: Array<{
      terapia: Terapia
      quantidade: number
      faturamento: number
    }>
  }
}

// Estado global da agenda (para contexto)
export interface AgendaState {
  pacientes: Paciente[]
  terapias: Terapia[]
  agendamentos: Agendamento[]
  tratamentosPendentes: TratamentoPendente[]
  configuracoes: ConfiguracoesAgenda
  loading: boolean
  error: string | null
}

// Ações do contexto
export type AgendaAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PACIENTES'; payload: Paciente[] }
  | { type: 'ADD_PACIENTE'; payload: Paciente }
  | { type: 'UPDATE_PACIENTE'; payload: Paciente }
  | { type: 'DELETE_PACIENTE'; payload: string }
  | { type: 'SET_TERAPIAS'; payload: Terapia[] }
  | { type: 'ADD_TERAPIA'; payload: Terapia }
  | { type: 'UPDATE_TERAPIA'; payload: Terapia }
  | { type: 'DELETE_TERAPIA'; payload: string }
  | { type: 'SET_AGENDAMENTOS'; payload: Agendamento[] }
  | { type: 'ADD_AGENDAMENTO'; payload: Agendamento }
  | { type: 'UPDATE_AGENDAMENTO'; payload: Agendamento }
  | { type: 'DELETE_AGENDAMENTO'; payload: string }
  | { type: 'SET_TRATAMENTOS_PENDENTES'; payload: TratamentoPendente[] }
  | { type: 'ADD_TRATAMENTO_PENDENTE'; payload: TratamentoPendente }
  | { type: 'UPDATE_TRATAMENTO_PENDENTE'; payload: TratamentoPendente }
  | { type: 'DELETE_TRATAMENTO_PENDENTE'; payload: string }
  | { type: 'SET_CONFIGURACOES'; payload: ConfiguracoesAgenda }

// Tipos para modais (baseado no AgendaV2)
export interface ModalState {
  agendamento: {
    isOpen: boolean
    agendamento?: Agendamento
    mode: 'create' | 'edit'
  }
  paciente: {
    isOpen: boolean
    paciente?: Paciente
    mode: 'create' | 'edit'
  }
  terapia: {
    isOpen: boolean
    terapia?: Terapia
    mode: 'create' | 'edit'
  }
  tratamento: {
    isOpen: boolean
    tratamento?: TratamentoPendente
    mode: 'create' | 'edit'
  }
  configuracao: {
    isOpen: boolean
  }
}

// Tipos para validação de formulários
export interface FormErrors {
  [key: string]: string | undefined
}

// Tipos para hooks customizados
export interface UseAgendaReturn {
  state: AgendaState
  actions: {
    loadPacientes: () => Promise<void>
    addPaciente: (paciente: Omit<Paciente, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>
    updatePaciente: (id: string, paciente: Partial<Paciente>) => Promise<void>
    deletePaciente: (id: string) => Promise<void>
    
    loadTerapias: () => Promise<void>
    addTerapia: (terapia: Omit<Terapia, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>
    updateTerapia: (id: string, terapia: Partial<Terapia>) => Promise<void>
    deleteTerapia: (id: string) => Promise<void>
    
    loadAgendamentos: (filtros?: FiltrosAgenda) => Promise<void>
    addAgendamento: (agendamento: Omit<Agendamento, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>
    updateAgendamento: (id: string, agendamento: Partial<Agendamento>) => Promise<void>
    deleteAgendamento: (id: string) => Promise<void>
    
    loadTratamentosPendentes: () => Promise<void>
    addTratamentoPendente: (tratamento: Omit<TratamentoPendente, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>
    updateTratamentoPendente: (id: string, tratamento: Partial<TratamentoPendente>) => Promise<void>
    deleteTratamentoPendente: (id: string) => Promise<void>
    
    loadConfiguracoes: () => Promise<void>
    updateConfiguracoes: (configuracoes: Partial<ConfiguracoesAgenda>) => Promise<void>
    
    getEstatisticas: (periodo?: { inicio: string; fim: string }) => Promise<EstatisticasAgenda>
    exportarDados: () => Promise<void>
    importarDados: (dados: any) => Promise<void>
  }
}