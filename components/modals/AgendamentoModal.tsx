// components/modals/AgendamentoModal.tsx - Modal de Agendamento
'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { 
  Calendar,
  Clock,
  User,
  Stethoscope,
  DollarSign,
  Save,
  X,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Agendamento, Paciente, Terapia } from '@/types/agenda'

interface AgendamentoModalProps {
  isOpen: boolean
  onClose: () => void
  agendamento?: Agendamento
  mode: 'create' | 'edit'
  dataInicial?: string
  horaInicial?: string
}

interface FormData {
  paciente_id: string
  terapia_id: string
  data: string
  hora: string
  status: 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou'
  observacoes: string
  valor: string
  pago: boolean
}

interface FormErrors {
  paciente_id?: string
  terapia_id?: string
  data?: string
  hora?: string
  valor?: string
  global?: string
}

export default function AgendamentoModal({
  isOpen,
  onClose,
  agendamento,
  mode,
  dataInicial,
  horaInicial
}: AgendamentoModalProps) {
  const { state, actions } = useAgenda()
  const { pacientes, terapias, loading } = state

  const [formData, setFormData] = useState<FormData>({
    paciente_id: '',
    terapia_id: '',
    data: dataInicial || format(new Date(), 'yyyy-MM-dd'),
    hora: horaInicial || '09:00',
    status: 'agendado',
    observacoes: '',
    valor: '',
    pago: false
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Carregar dados do agendamento para edição
  useEffect(() => {
    if (mode === 'edit' && agendamento) {
      setFormData({
        paciente_id: agendamento.paciente_id,
        terapia_id: agendamento.terapia_id,
        data: agendamento.data,
        hora: agendamento.hora,
        status: agendamento.status,
        observacoes: agendamento.observacoes || '',
        valor: agendamento.valor?.toString() || '',
        pago: agendamento.pago || false
      })
    } else if (mode === 'create') {
      setFormData({
        paciente_id: '',
        terapia_id: '',
        data: dataInicial || format(new Date(), 'yyyy-MM-dd'),
        hora: horaInicial || '09:00',
        status: 'agendado',
        observacoes: '',
        valor: '',
        pago: false
      })
    }
  }, [mode, agendamento, dataInicial, horaInicial])

  // Auto-preenchimento do valor quando terapia é selecionada
  useEffect(() => {
    if (formData.terapia_id && !formData.valor) {
      const terapia = terapias.find(t => t.id === formData.terapia_id)
      if (terapia && terapia.preco > 0) {
        setFormData(prev => ({
          ...prev,
          valor: terapia.preco.toString()
        }))
      }
    }
  }, [formData.terapia_id, terapias])

  // Validação do formulário
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.paciente_id) {
      newErrors.paciente_id = 'Selecione um paciente'
    }

    if (!formData.terapia_id) {
      newErrors.terapia_id = 'Selecione uma terapia'
    }

    if (!formData.data) {
      newErrors.data = 'Data é obrigatória'
    } else {
      const dataAgendamento = new Date(formData.data + 'T' + formData.hora)
      const agora = new Date()
      
      if (mode === 'create' && dataAgendamento < agora) {
        newErrors.data = 'Não é possível agendar no passado'
      }
    }

    if (!formData.hora) {
      newErrors.hora = 'Hora é obrigatória'
    }

    if (formData.valor && isNaN(parseFloat(formData.valor))) {
      newErrors.valor = 'Valor deve ser um número válido'
    }

    // Verificar conflito de horário
    if (mode === 'create' || (mode === 'edit' && agendamento && 
        (formData.data !== agendamento.data || formData.hora !== agendamento.hora))) {
      
      const conflito = state.agendamentos.find(a => 
        a.id !== agendamento?.id &&
        a.data === formData.data &&
        a.hora === formData.hora &&
        a.status !== 'cancelado'
      )

      if (conflito) {
        newErrors.hora = 'Já existe um agendamento neste horário'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Manipular mudanças no formulário
  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
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
      const agendamentoData = {
        paciente_id: formData.paciente_id,
        terapia_id: formData.terapia_id,
        data: formData.data,
        hora: formData.hora,
        status: formData.status,
        observacoes: formData.observacoes.trim() || undefined,
        valor: formData.valor ? parseFloat(formData.valor) : undefined,
        pago: formData.pago
      }

      if (mode === 'create') {
        await actions.addAgendamento(agendamentoData)
        toast({
          title: "Agendamento criado!",
          description: "O agendamento foi criado com sucesso.",
        })
      } else if (mode === 'edit' && agendamento) {
        await actions.updateAgendamento(agendamento.id, agendamentoData)
        toast({
          title: "Agendamento atualizado!",
          description: "As alterações foram salvas com sucesso.",
        })
      }

      onClose()
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error)
      setErrors({ global: 'Erro ao salvar agendamento. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Obter dados do paciente e terapia selecionados
  const pacienteSelecionado = pacientes.find(p => p.id === formData.paciente_id)
  const terapiaSelecionada = terapias.find(t => t.id === formData.terapia_id)

  // Opções de status
  const statusOptions = [
    { value: 'agendado', label: 'Agendado', color: 'bg-blue-500' },
    { value: 'confirmado', label: 'Confirmado', color: 'bg-green-500' },
    { value: 'concluido', label: 'Concluído', color: 'bg-gray-500' },
    { value: 'cancelado', label: 'Cancelado', color: 'bg-red-500' },
    { value: 'faltou', label: 'Faltou', color: 'bg-orange-500' }
  ]

  const statusAtual = statusOptions.find(s => s.value === formData.status)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {mode === 'create' ? (
              <>
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Novo Agendamento
              </>
            ) : (
              <>
                <Calendar className="w-5 h-5 mr-2 text-green-600" />
                Editar Agendamento
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Preencha os dados para criar um novo agendamento.'
              : 'Edite as informações do agendamento.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Erro global */}
          {errors.global && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-700 text-sm">{errors.global}</span>
            </div>
          )}

          {/* Paciente */}
          <div className="space-y-2">
            <Label htmlFor="paciente" className="flex items-center">
              <User className="w-4 h-4 mr-2" />
              Paciente *
            </Label>
            <select
              id="paciente"
              value={formData.paciente_id}
              onChange={(e) => handleInputChange('paciente_id', e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.paciente_id ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
            >
              <option value="">Selecione um paciente...</option>
              {pacientes.map(paciente => (
                <option key={paciente.id} value={paciente.id}>
                  {paciente.nome} {paciente.telefone && `- ${paciente.telefone}`}
                </option>
              ))}
            </select>
            {errors.paciente_id && (
              <p className="text-red-600 text-sm">{errors.paciente_id}</p>
            )}
            {pacienteSelecionado && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-blue-900">{pacienteSelecionado.nome}</h4>
                      {pacienteSelecionado.telefone && (
                        <p className="text-blue-700 text-sm">{pacienteSelecionado.telefone}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Selecionado
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Terapia */}
          <div className="space-y-2">
            <Label htmlFor="terapia" className="flex items-center">
              <Stethoscope className="w-4 h-4 mr-2" />
              Terapia *
            </Label>
            <select
              id="terapia"
              value={formData.terapia_id}
              onChange={(e) => handleInputChange('terapia_id', e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.terapia_id ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
            >
              <option value="">Selecione uma terapia...</option>
              {terapias.map(terapia => (
                <option key={terapia.id} value={terapia.id}>
                  {terapia.nome} - R$ {terapia.preco.toFixed(2)} ({terapia.duracao}min)
                </option>
              ))}
            </select>
            {errors.terapia_id && (
              <p className="text-red-600 text-sm">{errors.terapia_id}</p>
            )}
            {terapiaSelecionada && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-green-900">{terapiaSelecionada.nome}</h4>
                      <p className="text-green-700 text-sm">
                        R$ {terapiaSelecionada.preco.toFixed(2)} • {terapiaSelecionada.duracao} minutos
                      </p>
                    </div>
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: terapiaSelecionada.cor }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data" className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Data *
              </Label>
              <Input
                id="data"
                type="date"
                value={formData.data}
                onChange={(e) => handleInputChange('data', e.target.value)}
                className={errors.data ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.data && (
                <p className="text-red-600 text-sm">{errors.data}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="hora" className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Hora *
              </Label>
              <Input
                id="hora"
                type="time"
                value={formData.hora}
                onChange={(e) => handleInputChange('hora', e.target.value)}
                className={errors.hora ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.hora && (
                <p className="text-red-600 text-sm">{errors.hora}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(status => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => handleInputChange('status', status.value)}
                  className={`px-3 py-2 rounded-lg text-white text-sm font-medium transition-all ${
                    formData.status === status.value 
                      ? `${status.color} ring-2 ring-blue-500` 
                      : `${status.color} opacity-60 hover:opacity-80`
                  }`}
                  disabled={isSubmitting}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Valor e Pagamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor" className="flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Valor (R$)
              </Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.valor}
                onChange={(e) => handleInputChange('valor', e.target.value)}
                className={errors.valor ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.valor && (
                <p className="text-red-600 text-sm">{errors.valor}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Pagamento
              </Label>
              <div className="flex items-center space-x-3 pt-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.pago}
                    onChange={(e) => handleInputChange('pago', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="ml-2 text-sm">Pagamento confirmado</span>
                </label>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações sobre o agendamento..."
              value={formData.observacoes}
              onChange={(e) => handleInputChange('observacoes', e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Resumo do agendamento */}
          {formData.paciente_id && formData.terapia_id && (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-4">
                <h4 className="font-medium mb-3 text-gray-900">Resumo do Agendamento</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paciente:</span>
                    <span className="font-medium">{pacienteSelecionado?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Terapia:</span>
                    <span className="font-medium">{terapiaSelecionada?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data/Hora:</span>
                    <span className="font-medium">
                      {formData.data && format(parseISO(formData.data), 'dd/MM/yyyy', { locale: ptBR })} às {formData.hora}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge className={`${statusAtual?.color} text-white`}>
                      {statusAtual?.label}
                    </Badge>
                  </div>
                  {formData.valor && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor:</span>
                      <span className="font-medium">R$ {parseFloat(formData.valor).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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
              {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Criar Agendamento' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}