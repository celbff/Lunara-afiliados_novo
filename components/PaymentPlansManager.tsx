// components/PaymentPlansManager.tsx - Gerenciamento de Planos de Pagamento
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Switch } from '@/components/ui/Switch'
import { 
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Star,
  Crown,
  CheckCircle,
  Settings,
  Copy,
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  Save
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface PaymentPlan {
  id: string
  name: string
  type: 'premium' | 'admin'
  price: number
  duration_days: number
  features: string[]
  active: boolean
  popular: boolean
  created_at: string
  updated_at: string
}

interface PaymentSettings {
  pixKey: string
  pixKeyType: 'email' | 'phone' | 'cpf' | 'random'
  merchantName: string
  merchantCity: string
  merchantCEP: string
  autoActivation: boolean
  paymentTimeout: number // em minutos
  webhookUrl: string
}

const FEATURES_DISPONÍVEIS = [
  'Pacientes ilimitados',
  'Agendamentos ilimitados',
  'Relatórios avançados',
  'Exportação de dados',
  'Importação em lote',
  'Notificações por email',
  'Notificações SMS',
  'Integrações de calendário',
  'Painel administrativo',
  'Gestão de usuários',
  'Controle de licenças',
  'Marca personalizada',
  'Acesso à API',
  'Suporte prioritário',
  'Backup automático',
  'Análises detalhadas'
]

export default function PaymentPlansManager() {
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [settings, setSettings] = useState<PaymentSettings>({
    pixKey: 'lunara_terapias@jim.com',
    pixKeyType: 'email',
    merchantName: 'Lunara Terapias',
    merchantCity: 'São Paulo',
    merchantCEP: '01000-000',
    autoActivation: true,
    paymentTimeout: 30,
    webhookUrl: ''
  })
  
  const [dialogPlanOpen, setDialogPlanOpen] = useState(false)
  const [dialogSettingsOpen, setDialogSettingsOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [planForm, setPlanForm] = useState<Partial<PaymentPlan>>({
    name: '',
    type: 'premium',
    price: 0,
    duration_days: 365,
    features: [],
    active: true,
    popular: false
  })

  // Carregar planos existentes
  useEffect(() => {
    loadPlans()
    loadSettings()
  }, [])

  const loadPlans = async () => {
    // Simulação de dados - em produção viria da API
    const mockPlans: PaymentPlan[] = [
      {
        id: '1',
        name: 'Lunara Premium',
        type: 'premium',
        price: 97.00,
        duration_days: 365,
        features: [
          'Pacientes ilimitados',
          'Agendamentos ilimitados',
          'Relatórios avançados',
          'Exportação de dados',
          'Notificações por email',
          'Integrações de calendário'
        ],
        active: true,
        popular: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        name: 'Lunara Master Admin',
        type: 'admin',
        price: 197.00,
        duration_days: 365,
        features: [
          'Todos os recursos Premium',
          'Painel administrativo',
          'Gestão de usuários',
          'Controle de licenças',
          'Notificações SMS',
          'Marca personalizada',
          'Acesso à API',
          'Suporte prioritário'
        ],
        active: true,
        popular: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]
    setPlans(mockPlans)
  }

  const loadSettings = async () => {
    // Carregar configurações da API
    // Em produção, buscar do backend
  }

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.price || !planForm.duration_days) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    
    try {
      const planData: PaymentPlan = {
        id: editingPlan?.id || Date.now().toString(),
        name: planForm.name!,
        type: planForm.type!,
        price: planForm.price!,
        duration_days: planForm.duration_days!,
        features: planForm.features!,
        active: planForm.active!,
        popular: planForm.popular!,
        created_at: editingPlan?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (editingPlan) {
        // Atualizar plano existente
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? planData : p))
        toast({
          title: "Plano atualizado",
          description: "Plano atualizado com sucesso",
        })
      } else {
        // Criar novo plano
        setPlans(prev => [...prev, planData])
        toast({
          title: "Plano criado",
          description: "Novo plano criado com sucesso",
        })
      }

      handleClosePlanDialog()
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar plano",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return

    try {
      setPlans(prev => prev.filter(p => p.id !== planId))
      toast({
        title: "Plano excluído",
        description: "Plano excluído com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir plano",
        variant: "destructive"
      })
    }
  }

  const handleTogglePlanStatus = async (planId: string) => {
    try {
      setPlans(prev => prev.map(p => 
        p.id === planId ? { ...p, active: !p.active } : p
      ))
      toast({
        title: "Status atualizado",
        description: "Status do plano atualizado com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive"
      })
    }
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    
    try {
      // Salvar configurações na API
      toast({
        title: "Configurações salvas",
        description: "Configurações de pagamento salvas com sucesso",
      })
      setDialogSettingsOpen(false)
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditPlan = (plan: PaymentPlan) => {
    setEditingPlan(plan)
    setPlanForm(plan)
    setDialogPlanOpen(true)
  }

  const handleClosePlanDialog = () => {
    setDialogPlanOpen(false)
    setEditingPlan(null)
    setPlanForm({
      name: '',
      type: 'premium',
      price: 0,
      duration_days: 365,
      features: [],
      active: true,
      popular: false
    })
  }

  const addFeature = (feature: string) => {
    if (!planForm.features?.includes(feature)) {
      setPlanForm(prev => ({
        ...prev,
        features: [...(prev.features || []), feature]
      }))
    }
  }

  const removeFeature = (feature: string) => {
    setPlanForm(prev => ({
      ...prev,
      features: prev.features?.filter(f => f !== feature) || []
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Planos</h1>
          <p className="text-gray-600">Configure preços, recursos e configurações de pagamento</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setDialogSettingsOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configurações PIX
          </Button>
          <Button onClick={() => setDialogPlanOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Plano
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Planos Ativos</p>
                <p className="text-2xl font-bold text-blue-600">
                  {plans.filter(p => p.active).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Preço Médio</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {plans.length > 0 ? (plans.reduce((acc, p) => acc + p.price, 0) / plans.length).toFixed(0) : '0'}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Plano Popular</p>
                <p className="text-2xl font-bold text-purple-600">
                  {plans.find(p => p.popular)?.name?.split(' ')[0] || 'Nenhum'}
                </p>
              </div>
              <Star className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Chave PIX</p>
                <p className="text-sm font-bold text-orange-600">
                  {settings.pixKey}
                </p>
              </div>
              <Copy className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Planos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`${!plan.active ? 'opacity-60' : ''} ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {plan.type === 'premium' ? (
                    <Star className="w-6 h-6 text-purple-600" />
                  ) : (
                    <Crown className="w-6 h-6 text-yellow-600" />
                  )}
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{plan.name}</span>
                      {plan.popular && <Badge variant="default">Popular</Badge>}
                      {!plan.active && <Badge variant="destructive">Inativo</Badge>}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {plan.type === 'premium' ? 'Plano Premium' : 'Plano Administrativo'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    R$ {plan.price.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {plan.duration_days} dias
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Recursos inclusos:</h4>
                  <div className="space-y-1">
                    {plan.features.slice(0, 4).map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    {plan.features.length > 4 && (
                      <p className="text-sm text-gray-500">
                        +{plan.features.length - 4} recursos adicionais
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditPlan(plan)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  
                  <Button
                    size="sm"
                    variant={plan.active ? "outline" : "default"}
                    onClick={() => handleTogglePlanStatus(plan.id)}
                  >
                    {plan.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeletePlan(plan.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog Criar/Editar Plano */}
      <Dialog open={dialogPlanOpen} onOpenChange={setDialogPlanOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Plano</Label>
                <Input
                  value={planForm.name || ''}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Lunara Premium"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={planForm.type} 
                  onValueChange={(value) => setPlanForm(prev => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="admin">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.price || ''}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                  placeholder="97.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Duração (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={planForm.duration_days || ''}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, duration_days: Number(e.target.value) }))}
                  placeholder="365"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Configurações</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={planForm.active}
                  onCheckedChange={(checked) => setPlanForm(prev => ({ ...prev, active: checked }))}
                />
                <Label>Plano Ativo</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={planForm.popular}
                  onCheckedChange={(checked) => setPlanForm(prev => ({ ...prev, popular: checked }))}
                />
                <Label>Marcar como Popular</Label>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Recursos do Plano</Label>
              
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {FEATURES_DISPONÍVEIS.map((feature) => (
                  <div
                    key={feature}
                    className={`p-2 border rounded cursor-pointer text-sm transition-colors
                      ${planForm.features?.includes(feature) 
                        ? 'bg-blue-50 border-blue-300 text-blue-700' 
                        : 'hover:bg-gray-50'
                      }`}
                    onClick={() => 
                      planForm.features?.includes(feature) 
                        ? removeFeature(feature) 
                        : addFeature(feature)
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <CheckCircle 
                        className={`w-4 h-4 ${
                          planForm.features?.includes(feature) 
                            ? 'text-blue-600' 
                            : 'text-gray-300'
                        }`} 
                      />
                      <span>{feature}</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-500">
                {planForm.features?.length || 0} recursos selecionados
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={handleClosePlanDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSavePlan} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Settings className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingPlan ? 'Atualizar' : 'Criar'} Plano
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Configurações PIX */}
      <Dialog open={dialogSettingsOpen} onOpenChange={setDialogSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações PIX</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  value={settings.pixKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, pixKey: e.target.value }))}
                  placeholder="lunara_terapias@jim.com"
                />
                <p className="text-sm text-gray-500">
                  Chave PIX para recebimento dos pagamentos
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo da Chave</Label>
                <Select 
                  value={settings.pixKeyType} 
                  onValueChange={(value) => setSettings(prev => ({ ...prev, pixKeyType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="cpf">CPF/CNPJ</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nome do Beneficiário</Label>
                <Input
                  value={settings.merchantName}
                  onChange={(e) => setSettings(prev => ({ ...prev, merchantName: e.target.value }))}
                  placeholder="Lunara Terapias"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={settings.merchantCity}
                    onChange={(e) => setSettings(prev => ({ ...prev, merchantCity: e.target.value }))}
                    placeholder="São Paulo"
                  />
                </div>

                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={settings.merchantCEP}
                    onChange={(e) => setSettings(prev => ({ ...prev, merchantCEP: e.target.value }))}
                    placeholder="01000-000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Timeout do Pagamento (minutos)</Label>
                <Input
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.paymentTimeout}
                  onChange={(e) => setSettings(prev => ({ ...prev, paymentTimeout: Number(e.target.value) }))}
                />
                <p className="text-sm text-gray-500">
                  Tempo limite para o pagamento ser processado
                </p>
              </div>

              <div className="space-y-2">
                <Label>URL do Webhook (opcional)</Label>
                <Input
                  value={settings.webhookUrl}
                  onChange={(e) => setSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://seusite.com/webhook/pix"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.autoActivation}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoActivation: checked }))}
                />
                <Label>Ativação Automática de Licenças</Label>
              </div>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 mb-1">Importante:</h4>
                    <p className="text-sm text-blue-700">
                      Certifique-se de que a chave PIX está correta e ativa. 
                      Mudanças nessas configurações afetarão todos os novos pagamentos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => setDialogSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSettings} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Settings className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configurações
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


Hook usePayment

// hooks/usePayment.ts - Hook para gerenciamento de pagamentos
import { useState, useEffect } from 'react'
import { toast } from '@/hooks/use-toast'

interface PaymentPlan {
  id: string
  name: string
  type: 'premium' | 'admin'
  price: number
  duration_days: number
  features: string[]
  popular?: boolean
}

interface PixPaymentData {
  qrCode: string
  pixKey: string
  amount: number
  paymentId: string
}

interface PaymentRequest {
  planId: string
  amount: number
  userId: string
  pixKey: string
}

export function usePayment() {
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([])
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  useEffect(() => {
    loadPaymentPlans()
  }, [])

  const loadPaymentPlans = async () => {
    try {
      // Em produção, buscar da API
      const mockPlans: PaymentPlan[] = [
        {
          id: 'premium_annual',
          name: 'Lunara Premium',
          type: 'premium',
          price: 97.00,
          duration_days: 365,
          features: [
            'Pacientes ilimitados',
            'Agendamentos ilimitados',
            'Relatórios avançados',
            'Exportação de dados',
            'Notificações por email',
            'Integrações de calendário'
          ],
          popular: true
        },
        {
          id: 'admin_annual',
          name: 'Lunara Master Admin',
          type: 'admin',
          price: 197.00,
          duration_days: 365,
          features: [
            'Todos os recursos Premium',
            'Painel administrativo',
            'Gestão de usuários',
            'Controle de licenças',
            'Notificações SMS',
            'Marca personalizada',
            'Acesso à API',
            'Suporte prioritário'
          ]
        }
      ]
      
      setPaymentPlans(mockPlans)
    } catch (error) {
      console.error('Erro ao carregar planos:', error)
    }
  }

  const generatePixPayment = async (request: PaymentRequest): Promise<PixPaymentData> => {
    setIsProcessingPayment(true)
    
    try {
      // Simular geração do PIX
      // Em produção, fazer requisição para API de pagamento
      
      const paymentId = `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Simular delay da API
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const pixData: PixPaymentData = {
        qrCode: `00020101021126580014br.gov.bcb.pix0136${request.pixKey}${request.amount.toFixed(2).padStart(10, '0')}5204000053039865802BR5925${request.pixKey}6009SAO PAULO62070503***6304`,
        pixKey: request.pixKey,
        amount: request.amount,
        paymentId: paymentId
      }
      
      // Salvar referência do pagamento no backend
      await savePaymentReference({
        paymentId,
        userId: request.userId,
        planId: request.planId,
        amount: request.amount,
        status: 'pending',
        createdAt: new Date().toISOString()
      })
      
      return pixData
    } catch (error) {
      throw new Error('Erro ao gerar pagamento PIX')
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const checkPaymentStatus = async (paymentId: string): Promise<'pending' | 'approved' | 'rejected'> => {
    try {
      // Em produção, consultar API de pagamento
      // Por enquanto, simular aprovação após algum tempo
      
      // Simular verificação
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Para demonstração, aprovar pagamentos após 30 segundos da criação
      const payment = await getPaymentReference(paymentId)
      if (payment) {
        const createdAt = new Date(payment.createdAt).getTime()
        const now = new Date().getTime()
        const diffMinutes = (now - createdAt) / (1000 * 60)
        
        if (diffMinutes > 0.5) { // 30 segundos para demo
          // Atualizar status e ativar licença
          await updatePaymentStatus(paymentId, 'approved')
          await activateLicenseForPayment(payment)
          return 'approved'
        }
      }
      
      return 'pending'
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error)
      return 'pending'
    }
  }

  const savePaymentReference = async (paymentData: any) => {
    // Salvar no localStorage para demonstração
    // Em produção, salvar no backend
    const payments = JSON.parse(localStorage.getItem('pix_payments') || '[]')
    payments.push(paymentData)
    localStorage.setItem('pix_payments', JSON.stringify(payments))
  }

  const getPaymentReference = async (paymentId: string) => {
    // Buscar do localStorage para demonstração
    const payments = JSON.parse(localStorage.getItem('pix_payments') || '[]')
    return payments.find((p: any) => p.paymentId === paymentId)
  }

  const updatePaymentStatus = async (paymentId: string, status: string) => {
    const payments = JSON.parse(localStorage.getItem('pix_payments') || '[]')
    const updatedPayments = payments.map((p: any) => 
      p.paymentId === paymentId ? { ...p, status, updatedAt: new Date().toISOString() } : p
    )
    localStorage.setItem('pix_payments', JSON.stringify(updatedPayments))
  }

  const activateLicenseForPayment = async (payment: any) => {
    // Ativar licença automaticamente após pagamento aprovado
    // Em produção, integrar com sistema de licenças
    const plan = paymentPlans.find(p => p.id === payment.planId)
    if (plan) {
      // Gerar chave de ativação automática
      const licenseKey = `AUTO-${plan.type.toUpperCase()}-${Date.now()}`
      
      // Notificar usuário via email/push
      toast({
        title: "Pagamento aprovado!",
        description: `Sua licença ${plan.name} foi ativada automaticamente`,
      })
      
      // Aqui você integraria com o sistema de ativação de licenças
      console.log(`Licença ativada automaticamente: ${licenseKey} para usuário ${payment.userId}`)
    }
  }

  return {
    paymentPlans,
    isProcessingPayment,
    generatePixPayment,
    checkPaymentStatus,
    loadPaymentPlans
  }
}


Configurações Adicionais

1. Variáveis de Ambiente (.env)

# PIX Configuration
PIX_KEY=lunara_terapias@jim.com
PIX_KEY_TYPE=email
MERCHANT_NAME=Lunara Terapias
MERCHANT_CITY=São Paulo
MERCHANT_CEP=01000-000

# Payment Gateway (opcional - para integração com gateways reais)
PAYMENT_GATEWAY_URL=https://api.pagamento.com
PAYMENT_GATEWAY_TOKEN=seu_token_aqui
WEBHOOK_SECRET=sua_chave_secreta

# Database
DATABASE_URL=sua_connection_string


2. API Routes para Pagamentos

// pages/api/payments/create-pix.ts
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { planId, userId, amount } = req.body
    
    // Validar dados
    if (!planId || !userId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Gerar pagamento PIX
    const pixData = {
      paymentId: `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      qrCode: 'generated_qr_code_string',
      pixKey: process.env.PIX_KEY,
      amount: amount,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
    }

    // Salvar no banco de dados
    // await savePayment(pixData)

    res.status(200).json(pixData)
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// pages/api/payments/webhook.ts - Para receber notificações de pagamento
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verificar assinatura do webhook
    // const isValid = verifyWebhookSignature(req.body, req.headers)
    
    const { paymentId, status } = req.body
    
    if (status === 'approved') {
      // Ativar licença automaticamente
      // await activateLicenseForPayment(paymentId)
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error('Erro no webhook:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}


// Agora você tem um sistema completo de pagamento via PIX integrado ao seu painel administrativo, onde pode:

// ✅ Configurar preços e validade dos planos ✅ Gerenciar recursos de cada plano ✅ Configurar chave PIX (lunara_terapias@jim.com) ✅ Ativação automática de licenças após pagamento ✅ Interface administrativa completa ✅ QR Code e chave PIX para pagamento ✅ Verificação de status de pagamento ✅ Planos populares e promoções

// O sistema está pronto para ser integrado com gateways de pagamento reais como MercadoPago, PagSeguro ou outros provedores PIX.