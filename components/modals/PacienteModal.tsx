// components/modals/PacienteModal.tsx - Modal de Paciente
'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { 
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Save,
  X,
  AlertCircle,
  UserCheck,
  History
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Paciente } from '@/types/agenda'

interface PacienteModalProps {
  isOpen: boolean
  onClose: () => void
  paciente?: Paciente
  mode: 'create' | 'edit'
}

interface FormData {
  nome: string
  telefone: string
  email: string
  endereco: string
  dataNascimento: string
  cpf: string
  observacoes: string
}

interface FormErrors {
  nome?: string
  telefone?: string
  email?: string
  cpf?: string
  global?: string
}

export default function PacienteModal({
  isOpen,
  onClose,
  paciente,
  mode
}: PacienteModalProps) {
  const { state, actions } = useAgenda()
  const { agendamentos, loading } = state

  const [formData, setFormData] = useState<FormData>({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    dataNascimento: '',
    cpf: '',
    observacoes: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Carregar dados do paciente para edição
  useEffect(() => {
    if (mode === 'edit' && paciente) {
      setFormData({
        nome: paciente.nome,
        telefone: paciente.telefone,
        email: paciente.email || '',
        endereco: paciente.endereco || '',
        dataNascimento: paciente.dataNascimento || '',
        cpf: paciente.cpf || '',
        observacoes: paciente.observacoes || ''
      })
    } else if (mode === 'create') {
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        endereco: '',
        dataNascimento: '',
        cpf: '',
        observacoes: ''
      })
    }
  }, [mode, paciente])

  // Validação do formulário
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório'
    } else if (formData.nome.trim().length < 2) {
      newErrors.nome = 'Nome deve ter pelo menos 2 caracteres'
    }

    if (!formData.telefone.trim()) {
      newErrors.telefone = 'Telefone é obrigatório'
    } else if (!/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(formData.telefone)) {
      // Verificar se está no formato (99) 99999-9999 ou (99) 9999-9999
      const numeroLimpo = formData.telefone.replace(/\D/g, '')
      if (numeroLimpo.length < 10 || numeroLimpo.length > 11) {
        newErrors.telefone = 'Telefone deve ter formato válido'
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email deve ter formato válido'
    }

    if (formData.cpf && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(formData.cpf)) {
      const cpfLimpo = formData.cpf.replace(/\D/g, '')
      if (cpfLimpo.length !== 11) {
        newErrors.cpf = 'CPF deve ter 11 dígitos'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Formatação automática
  const formatTelefone = (value: string) => {
    const numero = value.replace(/\D/g, '')
    if (numero.length <= 10) {
      return numero.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    } else {
      return numero.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
  }

  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, '')
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  // Manipular mudanças no formulário
  const handleInputChange = (field: keyof FormData, value: string) => {
    let formattedValue = value

    if (field === 'telefone') {
      formattedValue = formatTelefone(value)
    } else if (field === 'cpf') {
      formattedValue = formatCPF(value)
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }))
    
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Submeter formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const pacienteData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim(),
        email: formData.email.trim() || undefined,
        endereco: formData.endereco.trim() || undefined,
        dataNascimento: formData.dataNascimento || undefined,
        cpf: formData.cpf.trim() || undefined,
        observacoes: formData.observacoes.trim() || undefined
      }

      if (mode === 'create') {
        await actions.addPaciente(pacienteData)
        toast({
          title: "Paciente cadastrado!",
          description: "O paciente foi cadastrado com sucesso.",
        })
      } else if (mode === 'edit' && paciente) {
        await actions.updatePaciente(paciente.id, pacienteData)
        toast({
          title: "Paciente atualizado!",
          description: "As alterações foram salvas com sucesso.",
        })
      }

      onClose()
    } catch (error) {
      console.error('Erro ao salvar paciente:', error)
      setErrors({ global: 'Erro ao salvar paciente. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calcular idade
  const calcularIdade = (dataNascimento: string): number | null => {
    if (!dataNascimento) return null
    const nascimento = new Date(dataNascimento)
    const hoje = new Date()
    let idade = hoje.getFullYear() - nascimento.getFullYear()
    const m = hoje.getMonth() - nascimento.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--
    }
    return idade
  }

  // Histórico do paciente (se estiver editando)
  const agendamentosPaciente = mode === 'edit' && paciente 
    ? agendamentos.filter(a => a.paciente_id === paciente.id)
    : []

  const estatisticasPaciente = {
    totalAgendamentos: agendamentosPaciente.length,
    agendamentosConcluidos: agendamentosPaciente.filter(a => a.status === 'concluido').length,
    agendamentosCancelados: agendamentosPaciente.filter(a => a.status === 'cancelado').length,
    ultimoAgendamento: agendamentosPaciente
      .sort((a, b) => new Date(b.data + 'T' + b.hora).getTime() - new Date(a.data + 'T' + a.hora).getTime())[0]
  }

  const idade = calcularIdade(formData.dataNascimento)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {mode === 'create' ? (
              <>
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Novo Paciente
              </>
            ) : (
              <>
                <UserCheck className="w-5 h-5 mr-2 text-green-600" />
                Editar Paciente
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Preencha os dados para cadastrar um novo paciente.'
              : 'Edite as informações do paciente.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário Principal */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Erro global */}
              {errors.global && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-700 text-sm">{errors.global}</span>
                </div>
              )}

              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Informações Básicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Nome */}
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => handleInputChange('nome', e.target.value)}
                      placeholder="Digite o nome completo"
                      className={errors.nome ? 'border-red-500' : ''}
                      disabled={isSubmitting}
                    />
                    {errors.nome && (
                      <p className="text-red-600 text-sm">{errors.nome}</p>
                    )}
                  </div>

                  {/* Telefone e Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telefone" className="flex items-center">
                        <Phone className="w-4 h-4 mr-2" />
                        Telefone *
                      </Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => handleInputChange('telefone', e.target.value)}
                        placeholder="(99) 99999-9999"
                        className={errors.telefone ? 'border-red-500' : ''}
                        disabled={isSubmitting}
                      />
                      {errors.telefone && (
                        <p className="text-red-600 text-sm">{errors.telefone}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="email@exemplo.com"
                        className={errors.email ? 'border-red-500' : ''}
                        disabled={isSubmitting}
                      />
                      {errors.email && (
                        <p className="text-red-600 text-sm">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Data de Nascimento e CPF */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dataNascimento" className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        Data de Nascimento
                      </Label>
                      <Input
                        id="dataNascimento"
                        type="date"
                        value={formData.dataNascimento}
                        onChange={(e) => handleInputChange('dataNascimento', e.target.value)}
                        disabled={isSubmitting}
                      />
                      {idade !== null && (
                        <p className="text-sm text-gray-600">{idade} anos</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => handleInputChange('cpf', e.target.value)}
                        placeholder="999.999.999-99"
                        className={errors.cpf ? 'border-red-500' : ''}
                        disabled={isSubmitting}
                      />
                      {errors.cpf && (
                        <p className="text-red-600 text-sm">{errors.cpf}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Endereço */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço Completo</Label>
                    <Textarea
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => handleInputChange('endereco', e.target.value)}
                      placeholder="Rua, número, bairro, cidade, CEP..."
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Observações */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações Gerais</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => handleInputChange('observacoes', e.target.value)}
                      placeholder="Alergias, medicamentos, condições especiais..."
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Botões */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Cadastrar Paciente' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>

          {/* Painel Lateral - Histórico (apenas no modo edição) */}
          {mode === 'edit' && paciente && (
            <div className="space-y-6">
              {/* Resumo do Paciente */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {estatisticasPaciente.totalAgendamentos}
                    </div>
                    <div className="text-sm text-blue-700">Total de Agendamentos</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="font-bold text-green-600">
                        {estatisticasPaciente.agendamentosConcluidos}
                      </div>
                      <div className="text-green-700">Concluídos</div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <div className="font-bold text-red-600">
                        {estatisticasPaciente.agendamentosCancelados}
                      </div>
                      <div className="text-red-700">Cancelados</div>
                    </div>
                  </div>

                  {estatisticasPaciente.ultimoAgendamento && (
                    <div className="pt-3 border-t">
                      <div className="text-sm text-gray-600 mb-1">Último agendamento:</div>
                      <div className="font-medium">
                        {format(parseISO(estatisticasPaciente.ultimoAgendamento.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-sm text-gray-600">
                        {estatisticasPaciente.ultimoAgendamento.terapia?.nome}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Histórico Recente */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <History className="w-5 h-5 mr-2" />
                    Histórico Recente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {agendamentosPaciente
                      .sort((a, b) => new Date(b.data + 'T' + b.hora).getTime() - new Date(a.data + 'T' + a.hora).getTime())
                      .slice(0, 10)
                      .map((agendamento) => (
                        <div key={agendamento.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-medium text-sm">
                              {agendamento.terapia?.nome}
                            </div>
                            <div className={`px-2 py-1 rounded text-xs text-white ${
                              agendamento.status === 'concluido' ? 'bg-green-500' :
                              agendamento.status === 'confirmado' ? 'bg-blue-500' :
                              agendamento.status === 'cancelado' ? 'bg-red-500' :
                              agendamento.status === 'faltou' ? 'bg-orange-500' :
                              'bg-gray-500'
                            }`}>
                              {agendamento.status}
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            {format(parseISO(agendamento.data), 'dd/MM/yyyy', { locale: ptBR })} às {agendamento.hora}
                          </div>
                          {agendamento.valor && (
                            <div className="text-xs text-gray-600 mt-1">
                              R$ {agendamento.valor.toFixed(2)}
                              {agendamento.pago && (
                                <span className="text-green-600 ml-1">✓ Pago</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    
                    {agendamentosPaciente.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Nenhum agendamento encontrado
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}