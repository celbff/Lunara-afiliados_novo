// pages/TerapiasPage.tsx - Página Completa de Gestão de Terapias
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Switch } from '@/components/ui/Switch'
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Clock, 
  DollarSign, 
  Activity, 
  TrendingUp, 
  Calendar, 
  Users, 
  Eye, 
  Copy, 
  CheckCircle, 
  X, 
  RefreshCw,
  Palette,
  BarChart3,
  Settings,
  Star,
  Award
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Terapia } from '@/types/agenda'

interface TerapiaFormData extends Omit<Terapia, 'id' | 'created_at' | 'updated_at'> {}

interface FiltrosTerapias {
  busca: string
  precoMin: number | null
  precoMax: number | null
  duracaoMin: number | null
  duracaoMax: number | null
  ativa: 'todas' | 'ativa' | 'inativa'
  ordenarPor: 'nome' | 'preco' | 'duracao' | 'popularidade' | 'receita'
  ordenacao: 'asc' | 'desc'
}

const FILTROS_INICIAL: FiltrosTerapias = {
  busca: '',
  precoMin: null,
  precoMax: null,
  duracaoMin: null,
  duracaoMax: null,
  ativa: 'todas',
  ordenarPor: 'nome',
  ordenacao: 'asc'
}

const FORM_INICIAL: TerapiaFormData = {
  nome: '',
  descricao: '',
  duracao: 60,
  preco: 0,
  cor: '#3B82F6',
  ativa: true
}

const CORES_PREDEFINIDAS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1', '#14B8A6', '#EAB308'
]

export default function TerapiasPage() {
  const { state, actions } = useAgenda()
  const [filtros, setFiltros] = useState<FiltrosTerapias>(FILTROS_INICIAL)
  const [terapiaSelecionada, setTerapiaSelecionada] = useState<Terapia | null>(null)
  const [modoEdicao, setModoEdicao] = useState<'criar' | 'editar' | null>(null)
  const [formData, setFormData] = useState<TerapiaFormData>(FORM_INICIAL)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('lista')

  // Calcular estatísticas de cada terapia
  const terapiasComEstatisticas = useMemo(() => {
    return state.terapias.map(terapia => {
      const agendamentos = state.agendamentos.filter(a => a.terapia_id === terapia.id)
      const agendamentosConfirmados = agendamentos.filter(a => a.status === 'confirmado')
      const agendamentosRealizados = agendamentos.filter(a => a.status === 'realizado')
      
      const totalAgendamentos = agendamentos.length
      const totalRealizados = agendamentosRealizados.length
      const receita = agendamentosRealizados.reduce((acc, a) => acc + (a.valor || terapia.preco), 0)
      const taxaRealizacao = totalAgendamentos > 0 ? (totalRealizados / totalAgendamentos) * 100 : 0
      
      // Últimos 30 dias
      const dataLimite = new Date()
      dataLimite.setDate(dataLimite.getDate() - 30)
      const agendamentosRecentes = agendamentos.filter(a => new Date(a.data) >= dataLimite)
      
      return {
        ...terapia,
        estatisticas: {
          totalAgendamentos,
          totalRealizados,
          receita,
          taxaRealizacao,
          agendamentosRecentes: agendamentosRecentes.length,
          mediaValor: totalRealizados > 0 ? receita / totalRealizados : terapia.preco
        }
      }
    })
  }, [state.terapias, state.agendamentos])

  // Filtrar e ordenar terapias
  const terapiasFiltradas = useMemo(() => {
    let resultado = [...terapiasComEstatisticas]

    // Filtro de busca
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase()
      resultado = resultado.filter(t => 
        t.nome.toLowerCase().includes(busca) ||
        t.descricao?.toLowerCase().includes(busca)
      )
    }

    // Filtros de preço
    if (filtros.precoMin !== null) {
      resultado = resultado.filter(t => t.preco >= filtros.precoMin!)
    }
    if (filtros.precoMax !== null) {
      resultado = resultado.filter(t => t.preco <= filtros.precoMax!)
    }

    // Filtros de duração
    if (filtros.duracaoMin !== null) {
      resultado = resultado.filter(t => t.duracao >= filtros.duracaoMin!)
    }
    if (filtros.duracaoMax !== null) {
      resultado = resultado.filter(t => t.duracao <= filtros.duracaoMax!)
    }

    // Filtro de status
    if (filtros.ativa !== 'todas') {
      const ativa = filtros.ativa === 'ativa'
      resultado = resultado.filter(t => t.ativa === ativa)
    }

    // Ordenação
    resultado.sort((a, b) => {
      let comparacao = 0
      
      switch (filtros.ordenarPor) {
        case 'nome':
          comparacao = a.nome.localeCompare(b.nome)
          break
        case 'preco':
          comparacao = a.preco - b.preco
          break
        case 'duracao':
          comparacao = a.duracao - b.duracao
          break
        case 'popularidade':
          comparacao = a.estatisticas.totalAgendamentos - b.estatisticas.totalAgendamentos
          break
        case 'receita':
          comparacao = a.estatisticas.receita - b.estatisticas.receita
          break
      }
      
      return filtros.ordenacao === 'desc' ? -comparacao : comparacao
    })

    return resultado
  }, [terapiasComEstatisticas, filtros])

  // Estatísticas gerais
  const estatisticasGerais = useMemo(() => {
    const total = state.terapias.length
    const ativas = state.terapias.filter(t => t.ativa).length
    const inativas = total - ativas
    
    const precoMedio = total > 0 
      ? state.terapias.reduce((acc, t) => acc + t.preco, 0) / total 
      : 0
    
    const duracaoMedia = total > 0 
      ? state.terapias.reduce((acc, t) => acc + t.duracao, 0) / total 
      : 0

    const receitaTotal = terapiasComEstatisticas.reduce((acc, t) => acc + t.estatisticas.receita, 0)
    
    const maisPopular = terapiasComEstatisticas.reduce((prev, current) => 
      current.estatisticas.totalAgendamentos > prev.estatisticas.totalAgendamentos ? current : prev,
      terapiasComEstatisticas[0]
    )

    return {
      total,
      ativas,
      inativas,
      precoMedio,
      duracaoMedia,
      receitaTotal,
      maisPopular
    }
  }, [state.terapias, terapiasComEstatisticas])

  // Handlers
  const handleAbrirFormulario = (modo: 'criar' | 'editar', terapia?: Terapia) => {
    setModoEdicao(modo)
    if (modo === 'criar') {
      setFormData(FORM_INICIAL)
    } else if (terapia) {
      setFormData({
        nome: terapia.nome,
        descricao: terapia.descricao || '',
        duracao: terapia.duracao,
        preco: terapia.preco,
        cor: terapia.cor,
        ativa: terapia.ativa
      })
      setTerapiaSelecionada(terapia)
    }
    setDialogAberto(true)
  }

  const handleSalvarTerapia = async () => {
    if (!formData.nome || formData.preco < 0 || formData.duracao <= 0) {
      toast({
        title: "Dados inválidos",
        description: "Verifique nome, preço e duração",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      if (modoEdicao === 'criar') {
        await actions.createTerapia(formData)
        toast({
          title: "Terapia criada",
          description: "Terapia criada com sucesso",
        })
      } else if (modoEdicao === 'editar' && terapiaSelecionada) {
        await actions.updateTerapia(terapiaSelecionada.id, formData)
        toast({
          title: "Terapia atualizada",
          description: "Terapia atualizada com sucesso",
        })
      }
      
      setDialogAberto(false)
      setFormData(FORM_INICIAL)
      setTerapiaSelecionada(null)
      setModoEdicao(null)
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar terapia",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExcluirTerapia = async (terapia: Terapia) => {
    // Verificar se terapia tem agendamentos
    const temAgendamentos = state.agendamentos.some(a => a.terapia_id === terapia.id)
    
    if (temAgendamentos) {
      toast({
        title: "Não é possível excluir",
        description: "Terapia possui agendamentos. Desative-a ao invés de excluir.",
        variant: "destructive"
      })
      return
    }

    try {
      await actions.deleteTerapia(terapia.id)
      toast({
        title: "Terapia excluída",
        description: "Terapia excluída com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir terapia",
        variant: "destructive"
      })
    }
  }

  const handleToggleStatus = async (terapia: Terapia) => {
    try {
      await actions.updateTerapia(terapia.id, { ativa: !terapia.ativa })
      toast({
        title: terapia.ativa ? "Terapia desativada" : "Terapia ativada",
        description: `Terapia ${terapia.ativa ? 'desativada' : 'ativada'} com sucesso`,
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao alterar status da terapia",
        variant: "destructive"
      })
    }
  }

  const handleDuplicarTerapia = (terapia: Terapia) => {
    setFormData({
      nome: `${terapia.nome} (Cópia)`,
      descricao: terapia.descricao || '',
      duracao: terapia.duracao,
      preco: terapia.preco,
      cor: terapia.cor,
      ativa: true
    })
    setModoEdicao('criar')
    setDialogAberto(true)
  }

  const resetarFiltros = () => {
    setFiltros(FILTROS_INICIAL)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Terapias</h1>
          <p className="text-gray-600">Gerencie os tipos de terapia oferecidos</p>
        </div>
        <Button 
          onClick={() => handleAbrirFormulario('criar')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Terapia
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lista">Lista de Terapias</TabsTrigger>
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        {/* ==================== ABA LISTA ==================== */}
        <TabsContent value="lista" className="space-y-6">
          {/* Estatísticas Rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-blue-600">{estatisticasGerais.total}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ativas</p>
                    <p className="text-2xl font-bold text-green-600">{estatisticasGerais.ativas}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Preço Médio</p>
                    <p className="text-2xl font-bold text-purple-600">R$ {estatisticasGerais.precoMedio.toFixed(0)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Duração Média</p>
                    <p className="text-2xl font-bold text-orange-600">{estatisticasGerais.duracaoMedia.toFixed(0)}min</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Receita Total</p>
                    <p className="text-2xl font-bold text-emerald-600">R$ {estatisticasGerais.receitaTotal.toFixed(0)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Mais Popular</p>
                    <p className="text-lg font-bold text-amber-600 truncate">
                      {estatisticasGerais.maisPopular?.nome || '-'}
                    </p>
                  </div>
                  <Star className="w-8 h-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar por nome ou descrição..."
                      value={filtros.busca}
                      onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Label className="text-sm">Preço:</Label>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtros.precoMin || ''}
                    onChange={(e) => setFiltros(prev => ({ ...prev, precoMin: e.target.value ? Number(e.target.value) : null }))}
                    className="w-20"
                  />
                  <span>-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtros.precoMax || ''}
                    onChange={(e) => setFiltros(prev => ({ ...prev, precoMax: e.target.value ? Number(e.target.value) : null }))}
                    className="w-20"
                  />
                </div>

                <Select 
                  value={filtros.ativa} 
                  onValueChange={(value) => setFiltros(prev => ({ ...prev, ativa: value as any }))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="ativa">Ativas</SelectItem>
                    <SelectItem value="inativa">Inativas</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={filtros.ordenarPor} 
                  onValueChange={(value) => setFiltros(prev => ({ ...prev, ordenarPor: value as any }))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nome">Nome</SelectItem>
                    <SelectItem value="preco">Preço</SelectItem>
                    <SelectItem value="duracao">Duração</SelectItem>
                    <SelectItem value="popularidade">Popularidade</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={resetarFiltros}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Terapias */}
          <Card>
            <CardHeader>
              <CardTitle>Terapias ({terapiasFiltradas.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terapia</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Agendamentos</TableHead>
                    <TableHead>Receita</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terapiasFiltradas.map((terapia) => (
                    <TableRow key={terapia.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: terapia.cor }}
                          />
                          <div>
                            <div className="font-medium">{terapia.nome}</div>
                            {terapia.descricao && (
                              <div className="text-sm text-gray-500 truncate max-w-[200px]">
                                {terapia.descricao}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">R$ {terapia.preco.toFixed(2)}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1 text-gray-400" />
                          {terapia.duracao}min
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">{terapia.estatisticas.totalAgendamentos}</div>
                          <div className="text-sm text-gray-500">
                            {terapia.estatisticas.totalRealizados} realizados
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">R$ {terapia.estatisticas.receita.toFixed(0)}</div>
                          <div className="text-sm text-gray-500">
                            Taxa: {terapia.estatisticas.taxaRealizacao.toFixed(1)}%
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={terapia.ativa ? 'success' : 'secondary'}>
                          {terapia.ativa ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => setTerapiaSelecionada(terapia)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleAbrirFormulario('editar', terapia)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDuplicarTerapia(terapia)}
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleToggleStatus(terapia)}
                            >
                              {terapia.ativa ? (
                                <>
                                  <X className="w-4 h-4 mr-2" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleExcluirTerapia(terapia)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {terapiasFiltradas.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma terapia encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ABA ESTATÍSTICAS ==================== */}
        <TabsContent value="estatisticas" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 Terapias por Popularidade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="w-5 h-5 mr-2 text-amber-600" />
                  Top 5 - Mais Populares
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {terapiasComEstatisticas
                    .filter(t => t.ativa)
                    .sort((a, b) => b.estatisticas.totalAgendamentos - a.estatisticas.totalAgendamentos)
                    .slice(0, 5)
                    .map((terapia, index) => (
                      <div key={terapia.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-amber-600">#{index + 1}</span>
                          </div>
                          <div>
                            <div className="font-medium">{terapia.nome}</div>
                            <div className="text-sm text-gray-500">
                              {terapia.estatisticas.totalAgendamentos} agendamentos
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">R$ {terapia.estatisticas.receita.toFixed(0)}</div>
                          <div className="text-sm text-gray-500">
                            {terapia.estatisticas.taxaRealizacao.toFixed(1)}% realizado
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Top 5 Terapias por Receita */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                  Top 5 - Maior Receita
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {terapiasComEstatisticas
                    .filter(t => t.ativa)
                    .sort((a, b) => b.estatisticas.receita - a.estatisticas.receita)
                    .slice(0, 5)
                    .map((terapia, index) => (
                      <div key={terapia.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-green-600">#{index + 1}</span>
                          </div>
                          <div>
                            <div className="font-medium">{terapia.nome}</div>
                            <div className="text-sm text-gray-500">
                              R$ {terapia.preco.toFixed(2)} por sessão
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">
                            R$ {terapia.estatisticas.receita.toFixed(0)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {terapia.estatisticas.totalRealizados} sessões
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo Detalhado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Resumo Detalhado por Terapia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terapia</TableHead>
                    <TableHead>Agendamentos</TableHead>
                    <TableHead>Taxa Realização</TableHead>
                    <TableHead>Receita Total</TableHead>
                    <TableHead>Valor Médio</TableHead>
                    <TableHead>Últimos 30 dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terapiasComEstatisticas
                    .filter(t => t.ativa)
                    .sort((a, b) => b.estatisticas.receita - a.estatisticas.receita)
                    .map((terapia) => (
                      <TableRow key={terapia.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: terapia.cor }}
                            />
                            <span className="font-medium">{terapia.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{terapia.estatisticas.totalAgendamentos}</div>
                            <div className="text-sm text-gray-500">
                              {terapia.estatisticas.totalRealizados} realizados
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={terapia.estatisticas.taxaRealizacao >= 80 ? 'success' : 
                                   terapia.estatisticas.taxaRealizacao >= 60 ? 'warning' : 'destructive'}
                          >
                            {terapia.estatisticas.taxaRealizacao.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            R$ {terapia.estatisticas.receita.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          R$ {terapia.estatisticas.mediaValor.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Activity className="w-4 h-4 mr-1 text-blue-500" />
                            {terapia.estatisticas.agendamentosRecentes}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ABA CONFIGURAÇÕES ==================== */}
        <TabsContent value="configuracoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2 text-gray-600" />
                Configurações Globais de Terapias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Configurações Padrão</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Duração padrão (minutos)</Label>
                      <Input className="w-20" defaultValue="60" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Permitir sobreposição</Label>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Auto-confirmar agendamentos</Label>
                      <Switch />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Notificações</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Lembrete por email</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Lembrete por SMS</Label>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Relatório mensal</Label>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium mb-4">Ações em Lote</h3>
                <div className="flex space-x-3">
                  <Button variant="outline">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Ativar Todas
                  </Button>
                  <Button variant="outline">
                    <X className="w-4 h-4 mr-2" />
                    Desativar Selecionadas
                  </Button>
                  <Button variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recalcular Estatísticas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Formulário */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {modoEdicao === 'criar' ? 'Nova Terapia' : 'Editar Terapia'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Terapia *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Massagem Relaxante"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor da Terapia</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                    className="w-10 h-10 rounded border"
                  />
                  <div className="flex flex-wrap gap-1">
                    {CORES_PREDEFINIDAS.map(cor => (
                      <button
                        key={cor}
                        className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400"
                        style={{ backgroundColor: cor }}
                        onClick={() => setFormData(prev => ({ ...prev, cor }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração (minutos) *</Label>
                <Input
                  type="number"
                  value={formData.duracao}
                  onChange={(e) => setFormData(prev => ({ ...prev, duracao: Number(e.target.value) }))}
                  min="1"
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label>Preço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData(prev => ({ ...prev, preco: Number(e.target.value) }))}
                  min="0"
                  placeholder="150.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição da terapia, benefícios, técnicas utilizadas..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.ativa}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativa: checked }))}
              />
              <Label>Terapia ativa (disponível para agendamento)</Label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setDialogAberto(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button onClick={handleSalvarTerapia} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {modoEdicao === 'criar' ? 'Criar Terapia' : 'Salvar Alterações'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}