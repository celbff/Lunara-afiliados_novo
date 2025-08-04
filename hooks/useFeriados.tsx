// hooks/useFeriados.tsx - Hook para Sistema de Feriados e Dias Não Úteis
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { 
  addDays, 
  format, 
  isWeekend, 
  parseISO, 
  startOfYear, 
  endOfYear,
  addYears,
  getYear,
  eachDayOfInterval,
  isAfter,
  isBefore,
  isSameDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface Feriado {
  id: string
  nome: string
  data: string // YYYY-MM-DD
  tipo: 'nacional' | 'estadual' | 'municipal' | 'personalizado'
  recorrente: boolean
  ativo: boolean
  cor?: string
  observacoes?: string
}

export interface ConfiguracaoFeriados {
  incluirFeriadosNacionais: boolean
  incluirFeriadosEstaduais: boolean
  incluirFeriadosMunicipais: boolean
  estado?: string
  cidade?: string
  bloquearAgendamentosFinsDeSemana: boolean
  bloquearAgendamentosFeriados: boolean
  diasUteis: number[] // 0 = domingo, 6 = sábado
}

interface FeriadosState {
  feriados: Feriado[]
  configuracao: ConfiguracaoFeriados
  loading: boolean
  error: string | null
}

const CONFIGURACAO_PADRAO: ConfiguracaoFeriados = {
  incluirFeriadosNacionais: true,
  incluirFeriadosEstaduais: false,
  incluirFeriadosMunicipais: false,
  estado: 'SP',
  cidade: 'São Paulo',
  bloquearAgendamentosFinsDeSemana: true,
  bloquearAgendamentosFeriados: true,
  diasUteis: [1, 2, 3, 4, 5] // Segunda a sexta
}

export function useFeriados() {
  const [state, setState] = useState<FeriadosState>({
    feriados: [],
    configuracao: CONFIGURACAO_PADRAO,
    loading: false,
    error: null
  })

  // Feriados nacionais brasileiros
  const feriadosNacionaisBrasil = useCallback((ano: number): Feriado[] => {
    const feriados: Feriado[] = [
      {
        id: `confraternizacao-${ano}`,
        nome: 'Confraternização Universal',
        data: `${ano}-01-01`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#FF6B6B'
      },
      {
        id: `tiradentes-${ano}`,
        nome: 'Tiradentes',
        data: `${ano}-04-21`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#4ECDC4'
      },
      {
        id: `trabalhadores-${ano}`,
        nome: 'Dia do Trabalhador',
        data: `${ano}-05-01`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#45B7D1'
      },
      {
        id: `independencia-${ano}`,
        nome: 'Independência do Brasil',
        data: `${ano}-09-07`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#96CEB4'
      },
      {
        id: `aparecida-${ano}`,
        nome: 'Nossa Senhora Aparecida',
        data: `${ano}-10-12`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#FFEAA7'
      },
      {
        id: `finados-${ano}`,
        nome: 'Finados',
        data: `${ano}-11-02`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#DDA0DD'
      },
      {
        id: `proclamacao-${ano}`,
        nome: 'Proclamação da República',
        data: `${ano}-11-15`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#98D8C8'
      },
      {
        id: `natal-${ano}`,
        nome: 'Natal',
        data: `${ano}-12-25`,
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#FF7675'
      }
    ]

    // Adicionar feriados móveis (Carnaval, Páscoa, etc.)
    const feriadosMoveis = calcularFeriadosMoveis(ano)
    return [...feriados, ...feriadosMoveis]
  }, [])

  // Calcular feriados móveis baseados na Páscoa
  const calcularFeriadosMoveis = useCallback((ano: number): Feriado[] => {
    const pascoa = calcularPascoa(ano)
    
    return [
      {
        id: `carnaval-${ano}`,
        nome: 'Carnaval',
        data: format(addDays(pascoa, -47), 'yyyy-MM-dd'),
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#FDCB6E'
      },
      {
        id: `sexta-santa-${ano}`,
        nome: 'Sexta-feira Santa',
        data: format(addDays(pascoa, -2), 'yyyy-MM-dd'),
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#6C5CE7'
      },
      {
        id: `corpus-christi-${ano}`,
        nome: 'Corpus Christi',
        data: format(addDays(pascoa, 60), 'yyyy-MM-dd'),
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
        cor: '#A29BFE'
      }
    ]
  }, [])

  // Algoritmo para calcular a data da Páscoa
  const calcularPascoa = useCallback((ano: number): Date => {
    const a = ano % 19
    const b = Math.floor(ano / 100)
    const c = ano % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const n = Math.floor((h + l - 7 * m + 114) / 31)
    const p = (h + l - 7 * m + 114) % 31
    
    return new Date(ano, n - 1, p + 1)
  }, [])

  // Feriados estaduais (exemplo para SP)
  const feriadosEstaduaisSP = useCallback((ano: number): Feriado[] => {
    return [
      {
        id: `revolucao-constitucionalista-${ano}`,
        nome: 'Revolução Constitucionalista',
        data: `${ano}-07-09`,
        tipo: 'estadual',
        recorrente: true,
        ativo: true,
        cor: '#00B894'
      },
      {
        id: `consciencia-negra-sp-${ano}`,
        nome: 'Dia da Consciência Negra',
        data: `${ano}-11-20`,
        tipo: 'estadual',
        recorrente: true,
        ativo: true,
        cor: '#2D3436'
      }
    ]
  }, [])

  // Feriados municipais (exemplo para São Paulo)
  const feriadosMunicipaisSP = useCallback((ano: number): Feriado[] => {
    return [
      {
        id: `aniversario-sao-paulo-${ano}`,
        nome: 'Aniversário de São Paulo',
        data: `${ano}-01-25`,
        tipo: 'municipal',
        recorrente: true,
        ativo: true,
        cor: '#E17055'
      }
    ]
  }, [])

  // Carregar feriados para um ano
  const carregarFeriadosAno = useCallback(async (ano: number) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      let todosFeriados: Feriado[] = []

      // Adicionar feriados nacionais
      if (state.configuracao.incluirFeriadosNacionais) {
        todosFeriados = [...todosFeriados, ...feriadosNacionaisBrasil(ano)]
      }

      // Adicionar feriados estaduais
      if (state.configuracao.incluirFeriadosEstaduais && state.configuracao.estado === 'SP') {
        todosFeriados = [...todosFeriados, ...feriadosEstaduaisSP(ano)]
      }

      // Adicionar feriados municipais
      if (state.configuracao.incluirFeriadosMunicipais && state.configuracao.cidade === 'São Paulo') {
        todosFeriados = [...todosFeriados, ...feriadosMunicipaisSP(ano)]
      }

      // Adicionar feriados personalizados
      const feriadosPersonalizados = JSON.parse(localStorage.getItem('feriados_personalizados') || '[]')
      const feriadosPersonalizadosAno = feriadosPersonalizados.filter((f: Feriado) => 
        getYear(parseISO(f.data)) === ano || f.recorrente
      )

      todosFeriados = [...todosFeriados, ...feriadosPersonalizadosAno]

      // Ordenar por data
      todosFeriados.sort((a, b) => a.data.localeCompare(b.data))

      setState(prev => ({
        ...prev,
        feriados: todosFeriados,
        loading: false
      }))

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao carregar feriados',
        loading: false
      }))
    }
  }, [state.configuracao, feriadosNacionaisBrasil, feriadosEstaduaisSP, feriadosMunicipaisSP])

  // Verificar se uma data é feriado
  const isFeriado = useCallback((data: string | Date): boolean => {
    const dataStr = typeof data === 'string' ? data : format(data, 'yyyy-MM-dd')
    return state.feriados.some(f => f.ativo && f.data === dataStr)
  }, [state.feriados])

  // Verificar se uma data é dia útil
  const isDiaUtil = useCallback((data: string | Date): boolean => {
    const dataObj = typeof data === 'string' ? parseISO(data) : data
    const diaSemana = dataObj.getDay()

    // Verificar se está nos dias úteis configurados
    if (!state.configuracao.diasUteis.includes(diaSemana)) {
      return false
    }

    // Verificar se é feriado (se configurado para bloquear)
    if (state.configuracao.bloquearAgendamentosFeriados && isFeriado(data)) {
      return false
    }

    return true
  }, [state.configuracao, isFeriado])

  // Obter informações de um feriado
  const getFeriadoInfo = useCallback((data: string | Date): Feriado | null => {
    const dataStr = typeof data === 'string' ? data : format(data, 'yyyy-MM-dd')
    return state.feriados.find(f => f.ativo && f.data === dataStr) || null
  }, [state.feriados])

  // Obter próximos feriados
  const getProximosFeriados = useCallback((limite: number = 5): Feriado[] => {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    
    return state.feriados
      .filter(f => f.ativo && f.data >= hoje)
      .slice(0, limite)
  }, [state.feriados])

  // Contar dias úteis entre duas datas
  const contarDiasUteis = useCallback((inicio: string | Date, fim: string | Date): number => {
    const dataInicio = typeof inicio === 'string' ? parseISO(inicio) : inicio
    const dataFim = typeof fim === 'string' ? parseISO(fim) : fim
    
    let contador = 0
    let dataAtual = dataInicio

    while (!isAfter(dataAtual, dataFim)) {
      if (isDiaUtil(dataAtual)) {
        contador++
      }
      dataAtual = addDays(dataAtual, 1)
    }

    return contador
  }, [isDiaUtil])

  // Obter próximo dia útil
  const getProximoDiaUtil = useCallback((data: string | Date): Date => {
    let proximaData = typeof data === 'string' ? parseISO(data) : data
    proximaData = addDays(proximaData, 1)

    while (!isDiaUtil(proximaData)) {
      proximaData = addDays(proximaData, 1)
    }

    return proximaData
  }, [isDiaUtil])

  // Adicionar feriado personalizado
  const adicionarFeriadoPersonalizado = useCallback((feriado: Omit<Feriado, 'id'>) => {
    const novoFeriado: Feriado = {
      ...feriado,
      id: `personalizado-${Date.now()}`,
      tipo: 'personalizado'
    }

    const feriadosPersonalizados = JSON.parse(localStorage.getItem('feriados_personalizados') || '[]')
    feriadosPersonalizados.push(novoFeriado)
    localStorage.setItem('feriados_personalizados', JSON.stringify(feriadosPersonalizados))

    // Re-carregar feriados do ano atual
    const anoAtual = getYear(new Date())
    carregarFeriadosAno(anoAtual)

    return novoFeriado
  }, [carregarFeriadosAno])

  // Remover feriado personalizado
  const removerFeriadoPersonalizado = useCallback((feriadoId: string) => {
    const feriadosPersonalizados = JSON.parse(localStorage.getItem('feriados_personalizados') || '[]')
    const feriadosAtualizados = feriadosPersonalizados.filter((f: Feriado) => f.id !== feriadoId)
    localStorage.setItem('feriados_personalizados', JSON.stringify(feriadosAtualizados))

    // Re-carregar feriados do ano atual
    const anoAtual = getYear(new Date())
    carregarFeriadosAno(anoAtual)
  }, [carregarFeriadosAno])

  // Atualizar configuração
  const atualizarConfiguracao = useCallback((novaConfiguracao: Partial<ConfiguracaoFeriados>) => {
    const configAtualizada = { ...state.configuracao, ...novaConfiguracao }
    
    setState(prev => ({ ...prev, configuracao: configAtualizada }))
    
    // Salvar no localStorage
    localStorage.setItem('configuracao_feriados', JSON.stringify(configAtualizada))
    
    // Re-carregar feriados do ano atual
    const anoAtual = getYear(new Date())
    carregarFeriadosAno(anoAtual)
  }, [state.configuracao, carregarFeriadosAno])

  // Gerar lista de dias não úteis para um período
  const getDiasNaoUteis = useCallback((inicio: string | Date, fim: string | Date) => {
    const dataInicio = typeof inicio === 'string' ? parseISO(inicio) : inicio
    const dataFim = typeof fim === 'string' ? parseISO(fim) : fim
    
    const diasNaoUteis: Array<{
      data: string
      motivo: string
      tipo: 'feriado' | 'fim_semana' | 'dia_nao_util'
    }> = []

    const todasAsDatas = eachDayOfInterval({ start: dataInicio, end: dataFim })

    todasAsDatas.forEach(data => {
      if (!isDiaUtil(data)) {
        let motivo = ''
        let tipo: 'feriado' | 'fim_semana' | 'dia_nao_util' = 'dia_nao_util'

        const feriado = getFeriadoInfo(data)
        if (feriado) {
          motivo = feriado.nome
          tipo = 'feriado'
        } else if (isWeekend(data)) {
          motivo = 'Fim de semana'
          tipo = 'fim_semana'
        } else {
          motivo = 'Dia não útil configurado'
        }

        diasNaoUteis.push({
          data: format(data, 'yyyy-MM-dd'),
          motivo,
          tipo
        })
      }
    })

    return diasNaoUteis
  }, [isDiaUtil, getFeriadoInfo])

  // Carregar configuração salva
  useEffect(() => {
    const configSalva = localStorage.getItem('configuracao_feriados')
    if (configSalva) {
      try {
        const config = JSON.parse(configSalva)
        setState(prev => ({ ...prev, configuracao: { ...CONFIGURACAO_PADRAO, ...config } }))
      } catch (error) {
        console.error('Erro ao carregar configuração de feriados:', error)
      }
    }
  }, [])

  // Carregar feriados do ano atual na inicialização
  useEffect(() => {
    const anoAtual = getYear(new Date())
    carregarFeriadosAno(anoAtual)
  }, []) // Executar apenas uma vez

  return {
    feriados: state.feriados,
    configuracao: state.configuracao,
    loading: state.loading,
    error: state.error,
    
    // Funções de verificação
    isFeriado,
    isDiaUtil,
    getFeriadoInfo,
    
    // Funções de cálculo
    contarDiasUteis,
    getProximoDiaUtil,
    getProximosFeriados,
    getDiasNaoUteis,
    
    // Funções de gerenciamento
    carregarFeriadosAno,
    adicionarFeriadoPersonalizado,
    removerFeriadoPersonalizado,
    atualizarConfiguracao
  }
}