// components/modals/TerapiaModal.tsx - Modal de Terapia
'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { 
  Stethoscope,
  DollarSign,
  Clock,
  Palette,
  FileText,
  Save,
  X,
  AlertCircle,
  Activity,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Terapia } from '@/types/agenda'

interface TerapiaModalProps {
  isOpen: boolean
  onClose: () => void
  terapia?: Terapia
  mode: 'create' | 'edit'
}

interface FormData {
  nome: string
  cor: string
  preco: string
  duracao: string
  descricao: string
  ativa: boolean
}

interface FormErrors {
  nome?: string
  cor?: string
  preco?: string
  duracao?: string
  global?: string
}

// Cores predefinidas para terapias
const coresPredefinidas = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#F59E0B', // Amarelo
  '#EF4444', // Vermelho
  '#8B5CF6', // Roxo
  '#F97316', // Laranja
  '#06B6D4', // Ciano
  '#84CC16', // Lima
  '#EC4899', // Rosa
  '#6B7280', // Cinza
  '#14B8A6', // Teal
  '#A855F7', // Violeta
  '#DC2626', // Vermelho escuro
  '#059669', // Verde escuro
  '#7C3AED', // Índigo
  '#DB2777'  // Rosa escuro
]

export default function TerapiaModal({
  isOpen,
  onClose,
  terapia,
  mode
}: TerapiaModalProps) {
  const { state, actions } = useAgenda()
  const { agendamentos, loading } = state

  const [formData, setFormData] = useState<FormData>({
    nome: '',
    cor: coresPredefinidas[0],
    preco: '',
    duracao: '60',
    descricao: '',
    ativa: true
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Carregar dados da terapia para edição
  useEffect(() => {
    if (mode === 'edit' && terapia) {
      setFormData({
        nome: terapia.nome,
        cor: terapia.cor,
        preco: terapia.preco.toString(),
        duracao: terapia.duracao.toString(),
        descricao: terapia.descricao || '',
        ativa: terapia.ativa
      })
    } else if (mode === 'create') {
      setFormData({
        nome: '',
        cor: coresPredefinidas[0],
        preco: '',
        duracao: '60',
        descricao: '',
        ativa: true
      })
    }
  }, [mode, terapia])

  // Validação do formulário
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório'
    } else if (formData.nome.trim().length < 2) {
      newErrors.nome = 'Nome deve ter pelo menos 2 caracteres'
    }

    if (!formData.cor) {
      newErrors.cor = 'Cor é obrigatória'
    }

    const preco = parseFloat(formData.preco)
    if (!formData.preco || isNaN(preco) || preco < 0) {
      newErrors.preco = 'Preço deve ser um valor válido'
    }

    const duracao = parseInt(formData.duracao)
    if (!formData.duracao || isNaN(duracao) || duracao <= 0) {
      newErrors.duracao = 'Duração deve ser um valor válido em minutos'
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
      const terapiaData = {
        nome: formData.nome.trim(),
        cor: formData.cor,
        preco: parseFloat(formData.preco),
        duracao: parseInt(formData.duracao),
        descricao: formData.descricao.trim() || undefined,
        ativa: formData.ativa
      }

      if (mode === 'create') {
        await actions.addTerapia(terapiaData)
        toast({
          title: "Terapia cadastrada!",
          description: "A terapia foi cadastrada com sucesso.",
        })
      } else if (mode === 'edit' && terapia) {
        await actions.updateTerapia(terapia.id, terapiaData)
        toast({
          title: "Terapia atualizada!",
          description: "As alterações foram salvas com sucesso.",
        })
      }

      onClose()
    } catch (error) {
      console.error('Erro ao salvar terapia:', error)
      setErrors({ global: 'Erro ao salvar terapia. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Estatísticas da terapia (se estiver editando)
  const agendamentosTerapia = mode === 'edit' && terapia 
    ? agendamentos.filter(a => a.terapia_id === terapia.id)
    : []

  const estatisticasTerapia = {
    totalAgendamentos: agendamentosTerapia.length,
    agendamentosConcluidos: agendamentosTerapia.filter(a => a.status === 'concluido').length,
    agendamentosCancelados: agendamentosTerapia.filter(a => a.status === 'cancelado').length,
    faturamentoTotal: agendamentosTerapia
      .filter(a => a.status === 'concluido' && a.valor)
      .reduce((total, a) => total + (a.valor || 0), 0),
    ultimoAgendamento: agendamentosTerapia
      .sort((a, b) => new Date(b.data + 'T' + b.hora).getTime() - new Date(a.data + 'T' + a.hora).getTime())[0]
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {mode === 'create' ? (
              <>
                <Stethoscope className="w-5 h-5 mr-2 text-blue-600" />
                Nova Terapia
              </>
            ) : (
              <>
                <Activity className="w-5 h-5 mr-2 text-green-600" />
                Editar Terapia
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Preencha os dados para cadastrar uma nova terapia.'
              : 'Edite as informações da terapia.'
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
                    <Stethoscope className="w-5 h-5 mr-2" />
                    Informações Básicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Nome */}
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Terapia *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => handleInputChange('nome', e.target.value)}
                      placeholder="Ex: Fisioterapia, Massoterapia, Acupuntura..."
                      className={errors.nome ? 'border-red-500' : ''}
                      disabled={isSubmitting}
                    />
                    {errors.nome && (
                      <p className="text-red-600 text-sm">{errors.nome}</p>
                    )}
                  </div>

                  {/* Cor */}
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <Palette className="w-4 h-4 mr-2" />
                      Cor *
                    </Label>
                    <div className="space-y-3">
                      {/* Cores Predefinidas */}
                      <div className="grid grid-cols-8 gap-2">
                        {coresPredefinidas.map((cor, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleInputChange('cor', cor)}
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                              formData.cor === cor 
                                ? 'border-gray-800 ring-2 ring-blue-500' 
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: cor }}
                            disabled={isSubmitting}
                            title={`Cor ${index + 1}`}
                          />
                        ))}
                      </div>
                      
                      {/* Seletor de cor customizada */}
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={formData.cor}
                          onChange={(e) => handleInputChange('cor', e.target.value)}
                          className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                          disabled={isSubmitting}
                        />
                        <Input
                          value={formData.cor}
                          onChange={(e) => handleInputChange('cor', e.target.value)}
                          placeholder="#000000"
                          className="flex-1"
                          disabled={isSubmitting}
                        />
                      </div>
                      
                      {/* Preview da cor */}
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-16 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: formData.cor }}
                        />
                        <span className="text-sm text-gray-600">
                          Esta cor será usada no calendário e identificação da terapia
                        </span>
                      </div>
                    </div>
                    {errors.cor && (
                      <p className="text-red-600 text-sm">{errors.cor}</p>
                    )}
                  </div>

                  {/* Preço e Duração */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="preco" className="flex items-center">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Preço (R$) *
                      </Label>
                      <Input
                        id="preco"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.preco}
                        onChange={(e) => handleInputChange('preco', e.target.value)}
                        placeholder="0,00"
                        className={errors.preco ? 'border-red-500' : ''}
                        disabled={isSubmitting}
                      />
                      {errors.preco && (
                        <p className="text-red-600 text-sm">{errors.preco}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duracao" className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Duração (minutos) *
                      </Label>
                      <select
                        id="duracao"
                        value={formData.duracao}
                        onChange={(e) => handleInputChange('duracao', e.target.value)}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.duracao ? 'border-red-500' : 'border-gray-300'
                        }`}
                        disabled={isSubmitting}
                      >
                        <option value="15">15 minutos</option>
                        <option value="30">30 minutos</option>
                        <option value="45">45 minutos</option>
                        <option value="60">1 hora</option>
                        <option value="90">1h 30min</option>
                        <option value="120">2 horas</option>
                        <option value="150">2h 30min</option>
                        <option value="180">3 horas</option>
                      </select>
                      {errors.duracao && (
                        <p className="text-red-600 text-sm">{errors.duracao}</p>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.ativa}
                          onChange={(e) => handleInputChange('ativa', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                        <span className="ml-2 text-sm">Terapia ativa (disponível para agendamento)</span>
                      </label>
                    </div>
                    {!formData.ativa && (
                      <p className="text-amber-600 text-sm">
                        ⚠️ Terapias inativas não aparecem na lista de agendamentos
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Descrição */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Descrição
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição da Terapia</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => handleInputChange('descricao', e.target.value)}
                      placeholder="Descreva o tipo de tratamento, benefícios, indicações..."
                      rows={4}
                      disabled={isSubmitting}
                    />
                    <p className="text-sm text-gray-500">
                      Esta descrição pode ser usada em relatórios e na identificação da terapia.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Preview da Terapia */}
              <Card className="bg-gray-50 border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg">Preview da Terapia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center p-4 bg-white rounded-lg border">
                    <div 
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: formData.cor }}
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {formData.nome || 'Nome da Terapia'}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        {formData.preco && (
                          <span>R$ {parseFloat(formData.preco || '0').toFixed(2)}</span>
                        )}
                        {formData.duracao && (
                          <span>{formData.duracao} min</span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs ${
                          formData.ativa ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {formData.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                    </div>
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
                  {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Cadastrar Terapia' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>

          {/* Painel Lateral - Estatísticas (apenas no modo edição) */}
          {mode === 'edit' && terapia && (
            <div className="space-y-6">
              {/* Estatísticas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Estatísticas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {estatisticasTerapia.totalAgendamentos}
                    </div>
                    <div className="text-sm text-blue-700">Total de Agendamentos</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="font-bold text-green-600">
                        {estatisticasTerapia.agendamentosConcluidos}
                      </div>
                      <div className="text-green-700">Concluídos</div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <div className="font-bold text-red-600">
                        {estatisticasTerapia.agendamentosCancelados}
                      </div>
                      <div className="text-red-700">Cancelados</div>
                    </div>
                  </div>

                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">
                      R$ {estatisticasTerapia.faturamentoTotal.toFixed(2)}
                    </div>
                    <div className="text-sm text-green-700">Faturamento Total</div>
                  </div>

                  {estatisticasTerapia.ultimoAgendamento && (
                    <div className="pt-3 border-t">
                      <div className="text-sm text-gray-600 mb-1">Último agendamento:</div>
                      <div className="font-medium">
                        {format(parseISO(estatisticasTerapia.ultimoAgendamento.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-sm text-gray-600">
                        {estatisticasTerapia.ultimoAgendamento.paciente?.nome}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agendamentos Recentes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Agendamentos Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {agendamentosTerapia
                      .sort((a, b) => new Date(b.data + 'T' + b.hora).getTime() - new Date(a.data + 'T' + a.hora).getTime())
                      .slice(0, 10)
                      .map((agendamento) => (
                        <div key={agendamento.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-medium text-sm">
                              {agendamento.paciente?.nome}
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
                    
                    {agendamentosTerapia.length === 0 && (
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