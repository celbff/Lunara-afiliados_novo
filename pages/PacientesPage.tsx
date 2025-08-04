// pages/PacientesPage.tsx - Página Completa de Gestão de Pacientes
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarFallback, AvatarInitials } from '@/components/ui/Avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  User, 
  FileText, 
  Activity, 
  TrendingUp, 
  Clock, 
  DollarSign,
  Download,
  Upload,
  RefreshCw,
  Eye,
  UserPlus,
  Users,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format, parseISO, differenceInYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Paciente } from '@/types/agenda'

interface PacienteFormData extends Omit<Paciente, 'id' | 'created_at' | 'updated_at'> {}

interface FiltrosPacientes {
  busca: string
  idade: {
    min: number | null
    max: number | null
  }
  genero: 'todos' | 'masculino' | 'feminino' | 'outro'
  ativo: 'todos' | 'ativo' | 'inativo'
  ordenarPor: 'nome' | 'idade' | 'cadastro' | 'ultimo_agendamento'
  ordenacao: 'asc' | 'desc'
}

const FILTROS_INICIAL: FiltrosPacientes = {
  busca: '',
  idade: { min: null, max: null },
  genero: 'todos',
  ativo: 'todos',
  ordenarPor: 'nome',
  ordenacao: 'asc'
}

const FORM_INICIAL: PacienteFormData = {
  nome: '',
  telefone: '',
  email: '',
  data_nascimento: '',
  genero: 'outro',
  endereco: '',
  observacoes: '',
  ativo: true
}

export default function PacientesPage() {
  const { state, actions } = useAgenda()
  const [filtros, setFiltros] = useState<FiltrosPacientes>(FILTROS_INICIAL)
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null)
  const [modoEdicao, setModoEdicao] = useState<'criar' | 'editar' | null>(null)
  const [formData, setFormData] = useState<PacienteFormData>(FORM_INICIAL)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 10

  // Calcular idade
  const calcularIdade = useCallback((dataNascimento: string): number => {
    if (!dataNascimento) return 0
    return differenceInYears(new Date(), parseISO(dataNascimento))
  }, [])

  // Filtrar e ordenar pacientes
  const pacientesFiltrados = useMemo(() => {
    let resultado = [...state.pacientes]

    // Filtro de busca
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase()
      resultado = resultado.filter(p => 
        p.nome.toLowerCase().includes(busca) ||
        p.telefone.includes(busca) ||
        p.email?.toLowerCase().includes(busca)
      )
    }

    // Filtro de idade
    if (filtros.idade.min !== null || filtros.idade.max !== null) {
      resultado = resultado.filter(p => {
        const idade = calcularIdade(p.data_nascimento || '')
        const min = filtros.idade.min || 0
        const max = filtros.idade.max || 999
        return idade >= min && idade <= max
      })
    }

    // Filtro de gênero
    if (filtros.genero !== 'todos') {
      resultado = resultado.filter(p => p.genero === filtros.genero)
    }

    // Filtro de status
    if (filtros.ativo !== 'todos') {
      const ativo = filtros.ativo === 'ativo'
      resultado = resultado.filter(p => p.ativo === ativo)
    }

    // Ordenação
    resultado.sort((a, b) => {
      let comparacao = 0
      
      switch (filtros.ordenarPor) {
        case 'nome':
          comparacao = a.nome.localeCompare(b.nome)
          break
        case 'idade':
          comparacao = calcularIdade(a.data_nascimento || '') - calcularIdade(b.data_nascimento || '')
          break
        case 'cadastro':
          comparacao = new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
          break
        case 'ultimo_agendamento':
          // Encontrar último agendamento de cada paciente
          const ultimoA = state.agendamentos
            .filter(ag => ag.paciente_id === a.id)
            .sort((x, y) => y.data.localeCompare(x.data))[0]
          const ultimoB = state.agendamentos
            .filter(ag => ag.paciente_id === b.id)
            .sort((x, y) => y.data.localeCompare(x.data))[0]
          
          if (!ultimoA && !ultimoB) return 0
          if (!ultimoA) return 1
          if (!ultimoB) return -1
          
          comparacao = ultimoA.data.localeCompare(ultimoB.data)
          break
      }
      
      return filtros.ordenacao === 'desc' ? -comparacao : comparacao
    })

    return resultado
  }, [state.pacientes, state.agendamentos, filtros, calcularIdade])

  // Paginação
  const totalPaginas = Math.ceil(pacientesFiltrados.length / itensPorPagina)
  const pacientesPaginados = pacientesFiltrados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  )

  // Estatísticas
  const estatisticas = useMemo(() => {
    const total = state.pacientes.length
    const ativos = state.pacientes.filter(p => p.ativo).length
    const inativos = total - ativos
    
    const idades = state.pacientes
      .filter(p => p.data_nascimento)
      .map(p => calcularIdade(p.data_nascimento!))
    
    const idadeMedia = idades.length > 0 
      ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length)
      : 0

    const totalAgendamentos = state.agendamentos.length
    const agendamentosPorPaciente = total > 0 ? Math.round(totalAgendamentos / total) : 0

    return {
      total,
      ativos,
      inativos,
      idadeMedia,
      agendamentosPorPaciente
    }
  }, [state.pacientes, state.agendamentos, calcularIdade])

  // Obter histórico de agendamentos do paciente
  const getHistoricoPaciente = useCallback((pacienteId: string) => {
    return state.agendamentos
      .filter(a => a.paciente_id === pacienteId)
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [state.agendamentos])

  // Handlers
  const handleAbrirFormulario = (modo: 'criar' | 'editar', paciente?: Paciente) => {
    setModoEdicao(modo)
    if (modo === 'criar') {
      setFormData(FORM_INICIAL)
    } else if (paciente) {
      setFormData({
        nome: paciente.nome,
        telefone: paciente.telefone,
        email: paciente.email || '',
        data_nascimento: paciente.data_nascimento || '',
        genero: paciente.genero || 'outro',
        endereco: paciente.endereco || '',
        observacoes: paciente.observacoes || '',
        ativo: paciente.ativo
      })
      setPacienteSelecionado(paciente)
    }
    setDialogAberto(true)
  }

  const handleSalvarPaciente = async () => {
    if (!formData.nome || !formData.telefone) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      if (modoEdicao === 'criar') {
        await actions.createPaciente(formData)
        toast({
          title: "Paciente criado",
          description: "Paciente criado com sucesso",
        })
      } else if (modoEdicao === 'editar' && pacienteSelecionado) {
        await actions.updatePaciente(pacienteSelecionado.id, formData)
        toast({
          title: "Paciente atualizado",
          description: "Paciente atualizado com sucesso",
        })
      }
      
      setDialogAberto(false)
      setFormData(FORM_INICIAL)
      setPacienteSelecionado(null)
      setModoEdicao(null)
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar paciente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExcluirPaciente = async (paciente: Paciente) => {
    // Verificar se paciente tem agendamentos
    const temAgendamentos = state.agendamentos.some(a => a.paciente_id === paciente.id)
    
    if (temAgendamentos) {
      toast({
        title: "Não é possível excluir",
        description: "Paciente possui agendamentos. Desative-o ao invés de excluir.",
        variant: "destructive"
      })
      return
    }

    try {
      await actions.deletePaciente(paciente.id)
      toast({
        title: "Paciente excluído",
        description: "Paciente excluído com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir paciente",
        variant: "destructive"
      })
    }
  }

  const handleToggleStatus = async (paciente: Paciente) => {
    try {
      await actions.updatePaciente(paciente.id, { ativo: !paciente.ativo })
      toast({
        title: paciente.ativo ? "Paciente desativado" : "Paciente ativado",
        description: `Paciente ${paciente.ativo ? 'desativado' : 'ativado'} com sucesso`,
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao alterar status do paciente",
        variant: "destructive"
      })
    }
  }

  const resetarFiltros = () => {
    setFiltros(FILTROS_INICIAL)
    setPaginaAtual(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-gray-600">Gerencie os pacientes da sua clínica</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
          <Button 
            onClick={() => handleAbrirFormulario('criar')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-blue-600">{estatisticas.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ativos</p>
                <p className="text-2xl font-bold text-green-600">{estatisticas.ativos}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inativos</p>
                <p className="text-2xl font-bold text-red-600">{estatisticas.inativos}</p>
              </div>
              <X className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Idade Média</p>
                <p className="text-2xl font-bold text-purple-600">{estatisticas.idadeMedia}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Agend./Paciente</p>
                <p className="text-2xl font-bold text-orange-600">{estatisticas.agendamentosPorPaciente}</p>
              </div>
              <Activity className="w-8 h-8 text-orange-600" />
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
                  placeholder="Buscar por nome, telefone ou email..."
                  value={filtros.busca}
                  onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <Select 
              value={filtros.genero} 
              onValueChange={(value) => setFiltros(prev => ({ ...prev, genero: value as any }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os gêneros</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filtros.ativo} 
              onValueChange={(value) => setFiltros(prev => ({ ...prev, ativo: value as any }))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filtros.ordenarPor} 
              onValueChange={(value) => setFiltros(prev => ({ ...prev, ordenarPor: value as any }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="idade">Idade</SelectItem>
                <SelectItem value="cadastro">Data Cadastro</SelectItem>
                <SelectItem value="ultimo_agendamento">Último Agendamento</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={resetarFiltros}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pacientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Lista de Pacientes ({pacientesFiltrados.length})
            </CardTitle>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Página {paginaAtual} de {totalPaginas}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Último Agendamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacientesPaginados.map((paciente) => {
                const idade = calcularIdade(paciente.data_nascimento || '')
                const historico = getHistoricoPaciente(paciente.id)
                const ultimoAgendamento = historico[0]

                return (
                  <TableRow key={paciente.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {paciente.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{paciente.nome}</div>
                          <div className="text-sm text-gray-500">
                            {paciente.genero === 'masculino' ? 'M' : 
                             paciente.genero === 'feminino' ? 'F' : 'O'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Phone className="w-3 h-3 mr-1 text-gray-400" />
                          {paciente.telefone}
                        </div>
                        {paciente.email && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Mail className="w-3 h-3 mr-1 text-gray-400" />
                            {paciente.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {idade > 0 ? `${idade} anos` : '-'}
                    </TableCell>
                    
                    <TableCell>
                      {ultimoAgendamento ? (
                        <div>
                          <div className="text-sm">
                            {format(new Date(ultimoAgendamento.data), 'dd/MM/yyyy')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {ultimoAgendamento.terapia?.nome}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Nunca</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={paciente.ativo ? 'success' : 'secondary'}>
                        {paciente.ativo ? 'Ativo' : 'Inativo'}
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
                            onClick={() => setPacienteSelecionado(paciente)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAbrirFormulario('editar', paciente)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleStatus(paciente)}
                          >
                            {paciente.ativo ? (
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
                            onClick={() => handleExcluirPaciente(paciente)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {pacientesPaginados.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum paciente encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
            disabled={paginaAtual === 1}
          >
            Anterior
          </Button>
          
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(pagina => (
            <Button
              key={pagina}
              variant={pagina === paginaAtual ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPaginaAtual(pagina)}
            >
              {pagina}
            </Button>
          ))}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
            disabled={paginaAtual === totalPaginas}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Dialog de Formulário */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {modoEdicao === 'criar' ? 'Novo Paciente' : 'Editar Paciente'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_nascimento: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select 
                  value={formData.genero} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, genero: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.ativo ? 'ativo' : 'inativo'} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, ativo: value === 'ativo' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                placeholder="Endereço completo"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações importantes sobre o paciente..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setDialogAberto(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button onClick={handleSalvarPaciente} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {modoEdicao === 'criar' ? 'Criar Paciente' : 'Salvar Alterações'}
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