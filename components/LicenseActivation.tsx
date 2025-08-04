// components/LicenseActivation.tsx - Componente para Ativação de Licenças
'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Progress } from '@/components/ui/Progress'
import { 
  Key,
  Star,
  Crown,
  CheckCircle,
  AlertCircle,
  Copy,
  RefreshCw,
  Shield,
  Zap,
  Users,
  FileText,
  Download,
  Calendar,
  Clock
} from 'lucide-react'
import { useLicensing } from '@/hooks/useLicensing'
import { usePayment } from '@/hooks/usePayment'
import { toast } from '@/hooks/use-toast'
import { format, parseISO, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface LicenseActivationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PaymentPlan {
  id: string
  name: string
  type: 'premium' | 'admin'
  price: number
  duration_days: number
  features: string[]
  popular?: boolean
}

export default function LicenseActivation({ open, onOpenChange }: LicenseActivationProps) {
  const {
    currentUser,
    currentLicense,
    isLoading,
    activateLicense,
    checkLicenseValidity,
    hasFeature,
    calculateDaysUntilExpiry
  } = useLicensing()

  const {
    generatePixPayment,
    checkPaymentStatus,
    paymentPlans,
    isProcessingPayment
  } = usePayment()

  const [licenseKey, setLicenseKey] = useState('')
  const [step, setStep] = useState<'input' | 'success' | 'info' | 'payment' | 'plans'>('input')
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null)
  const [pixPaymentData, setPixPaymentData] = useState<{
    qrCode: string
    pixKey: string
    amount: number
    paymentId: string
  } | null>(null)

  // Exemplos de chaves para demonstração
  const exemploChaves = [
    { tipo: 'Master Admin', chave: 'MASTER-CELSO-2024-ADMIN-001', descricao: 'Acesso completo de administrador' },
    { tipo: 'Premium', chave: 'PREM-2024-001-ABCD-EFGH', descricao: 'Recursos premium por 1 ano' },
    { tipo: 'Premium', chave: 'PREM-2024-002-IJKL-MNOP', descricao: 'Recursos premium por 1 ano' }
  ]

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      toast({
        title: "Chave necessária",
        description: "Digite uma chave de licença válida",
        variant: "destructive"
      })
      return
    }

    try {
      await activateLicense(licenseKey)
      setStep('success')
      toast({
        title: "Licença ativada!",
        description: "Sua licença foi ativada com sucesso",
      })
    } catch (error: any) {
      toast({
        title: "Erro na ativação",
        description: error.message || "Chave de licença inválida",
        variant: "destructive"
      })
    }
  }

  const handleClose = () => {
    setLicenseKey('')
    setSelectedPlan(null)
    setPixPaymentData(null)
    setStep('input')
    onOpenChange(false)
  }

  const handlePurchasePlan = async (plan: PaymentPlan) => {
    try {
      setSelectedPlan(plan)
      
      const paymentData = await generatePixPayment({
        planId: plan.id,
        amount: plan.price,
        userId: currentUser.id,
        pixKey: 'lunara_terapias@jim.com'
      })
      
      setPixPaymentData(paymentData)
      setStep('payment')
      
      toast({
        title: "PIX gerado",
        description: "Escaneie o QR Code ou use a chave PIX para efetuar o pagamento",
      })
    } catch (error: any) {
      toast({
        title: "Erro ao gerar PIX",
        description: error.message || "Erro ao processar pagamento",
        variant: "destructive"
      })
    }
  }

  const checkPayment = async () => {
    if (!pixPaymentData) return
    
    try {
      const status = await checkPaymentStatus(pixPaymentData.paymentId)
      
      if (status === 'approved') {
        setStep('success')
        toast({
          title: "Pagamento aprovado!",
          description: "Sua licença foi ativada automaticamente",
        })
        // Recarregar dados do usuário para atualizar a licença
        window.location.reload()
      } else if (status === 'rejected') {
        toast({
          title: "Pagamento rejeitado",
          description: "Verifique os dados e tente novamente",
          variant: "destructive"
        })
        setStep('plans')
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao verificar status do pagamento",
        variant: "destructive"
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copiado",
      description: "Chave copiada para a área de transferência",
    })
  }

  const formatLicenseKey = (key: string) => {
    return key.replace(/(.{4})/g, '$1-').slice(0, -1)
  }

  const getLicenseTypeInfo = (type: string) => {
    switch (type) {
      case 'premium':
        return {
          icon: Star,
          color: 'text-purple-600',
          bg: 'bg-purple-100',
          name: 'Premium',
          features: [
            'Pacientes ilimitados',
            'Agendamentos ilimitados',
            'Relatórios avançados',
            'Exportação de dados',
            'Importação em lote',
            'Notificações por email',
            'Integrações de calendário'
          ]
        }
      case 'admin':
        return {
          icon: Crown,
          color: 'text-yellow-600',
          bg: 'bg-yellow-100',
          name: 'Master Admin',
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
      default:
        return {
          icon: Users,
          color: 'text-blue-600',
          bg: 'bg-blue-100',
          name: 'Gratuito',
          features: [
            'Até 50 pacientes',
            'Até 100 agendamentos/mês',
            'Até 5 terapias',
            'Relatórios básicos'
          ]
        }
    }
  }

  const licenseInfo = currentLicense ? getLicenseTypeInfo(currentLicense.type) : null
  const isValid = checkLicenseValidity()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            {step === 'input' ? 'Ativar Licença' : 
             step === 'success' ? 'Licença Ativada!' : 
             step === 'payment' ? 'Pagamento PIX' :
             step === 'plans' ? 'Escolher Plano' :
             'Informações da Licença'}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-6">
            {/* Status Atual */}
            {currentLicense && (
              <Card className={isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {licenseInfo && (
                        <div className={`w-10 h-10 ${licenseInfo.bg} rounded-full flex items-center justify-center`}>
                          <licenseInfo.icon className={`w-5 h-5 ${licenseInfo.color}`} />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">Licença Atual: {licenseInfo?.name}</div>
                        <div className="text-sm text-gray-600">
                          Status: <Badge variant={isValid ? 'success' : 'destructive'}>
                            {isValid ? 'Ativa' : 'Inválida/Expirada'}
                          </Badge>
                        </div>
                        {currentLicense.expires_at && (
                          <div className="text-sm text-gray-500">
                            {isValid ? 
                              `Expira em ${calculateDaysUntilExpiry(currentLicense.expires_at)} dias` :
                              `Expirou em ${format(parseISO(currentLicense.expires_at), 'dd/MM/yyyy')}`
                            }
                          </div>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setStep('info')}
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Formulário de Ativação */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Chave de Licença</Label>
                <Input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="Digite sua chave de licença..."
                  className="font-mono text-center tracking-wider"
                />
                <p className="text-sm text-gray-500">
                  Digite a chave de licença fornecida para ativar recursos premium
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Button 
                  onClick={handleActivate} 
                  disabled={isLoading || !licenseKey.trim()}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Ativando...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Ativar Licença
                    </>
                  )}
                </Button>

                <div className="flex items-center my-4">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="px-3 text-sm text-gray-500 bg-white">ou</span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>

                <Button 
                  variant="outline" 
                  onClick={() => setStep('plans')}
                  className="w-full"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Comprar Licença via PIX
                </Button>
              </div>
            </div>

            {/* Exemplos de Chaves (Para demonstração) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Chaves de Demonstração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {exemploChaves.map((exemplo, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={exemplo.tipo === 'Master Admin' ? 'destructive' : 'default'}>
                          {exemplo.tipo}
                        </Badge>
                        <span className="text-sm font-mono">{formatLicenseKey(exemplo.chave)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{exemplo.descricao}</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => copyToClipboard(exemplo.chave)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'success' && currentLicense && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-green-800 mb-2">
                Licença {getLicenseTypeInfo(currentLicense.type).name} Ativada!
              </h3>
              <p className="text-gray-600">
                Você agora tem acesso a todos os recursos {currentLicense.type === 'admin' ? 'administrativos' : 'premium'}
              </p>
            </div>

            {/* Recursos Desbloqueados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recursos Desbloqueados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {getLicenseTypeInfo(currentLicense.type).features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {currentLicense.expires_at && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-800">
                    Válida até {format(parseISO(currentLicense.expires_at), 'dd/MM/yyyy')}
                  </span>
                </div>
              </div>
            )}

            <Button onClick={handleClose} className="w-full">
              Começar a Usar
            </Button>
          </div>
        )}

        {step === 'plans' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Escolha seu Plano</h3>
              <p className="text-gray-600">Selecione o plano ideal para suas necessidades</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {paymentPlans.map((plan) => (
                <Card key={plan.id} className={`cursor-pointer transition-all ${
                  plan.popular ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">{plan.name}</h3>
                          {plan.popular && (
                            <Badge variant="default">Mais Popular</Badge>
                          )}
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                          R$ {plan.price.toFixed(2)}
                          <span className="text-sm text-gray-500 font-normal">
                            /{plan.duration_days} dias
                          </span>
                        </p>
                      </div>
                      {plan.type === 'premium' ? (
                        <Star className="w-8 h-8 text-purple-600" />
                      ) : (
                        <Crown className="w-8 h-8 text-yellow-600" />
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button 
                      onClick={() => handlePurchasePlan(plan)} 
                      className="w-full"
                      disabled={isProcessingPayment}
                    >
                      {isProcessingPayment ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 mr-2" />
                          Pagar via PIX
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button variant="outline" onClick={() => setStep('input')} className="w-full">
              Voltar para Ativação Manual
            </Button>
          </div>
        )}

        {step === 'payment' && pixPaymentData && selectedPlan && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Pagamento PIX</h3>
              <p className="text-gray-600">
                Escaneie o QR Code ou use a chave PIX para efetuar o pagamento
              </p>
            </div>

            {/* Informações do Plano */}
            <Card className="bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{selectedPlan.name}</h4>
                    <p className="text-sm text-gray-600">
                      Válido por {selectedPlan.duration_days} dias
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">
                      R$ {selectedPlan.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QR Code (Simulado) */}
            <div className="text-center">
              <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-black opacity-10 rounded mb-2"></div>
                  <p className="text-xs text-gray-500">QR Code PIX</p>
                </div>
              </div>
            </div>

            {/* Chave PIX */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-500">Chave PIX</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="flex-1 bg-gray-100 p-2 rounded text-sm">
                        lunara_terapias@jim.com
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => copyToClipboard('lunara_terapias@jim.com')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-500">Valor</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="flex-1 bg-gray-100 p-2 rounded text-sm">
                        R$ {selectedPlan.price.toFixed(2)}
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => copyToClipboard(selectedPlan.price.toFixed(2))}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-500">Identificador</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="flex-1 bg-gray-100 p-2 rounded text-sm">
                        {pixPaymentData.paymentId}
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => copyToClipboard(pixPaymentData.paymentId)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instruções */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800 mb-1">Como pagar:</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>1. Abra o app do seu banco</li>
                      <li>2. Escaneie o QR Code ou use a chave PIX</li>
                      <li>3. Confirme o valor de R$ {selectedPlan.price.toFixed(2)}</li>
                      <li>4. Finalize o pagamento</li>
                      <li>5. Sua licença será ativada automaticamente</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setStep('plans')} className="flex-1">
                Voltar
              </Button>
              <Button onClick={checkPayment} className="flex-1" disabled={isProcessingPayment}>
                {isProcessingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verificar Pagamento
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'info' && currentLicense && (
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-3">
              {licenseInfo && (
                <div className={`w-12 h-12 ${licenseInfo.bg} rounded-full flex items-center justify-center`}>
                  <licenseInfo.icon className={`w-6 h-6 ${licenseInfo.color}`} />
                </div>
              )}
              <div className="text-center">
                <h3 className="text-xl font-semibold">{licenseInfo?.name}</h3>
                <Badge variant={isValid ? 'success' : 'destructive'}>
                  {isValid ? 'Ativa' : 'Inválida/Expirada'}
                </Badge>
              </div>
            </div>

            {/* Informações da Licença */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">ID da Licença</Label>
                  <p className="font-mono text-sm">{currentLicense.id}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Tipo</Label>
                  <p className="font-medium">{currentLicense.type}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Ativada em</Label>
                  <p>{format(parseISO(currentLicense.activated_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Expira em</Label>
                  <p>{currentLicense.expires_at ? 
                      format(parseISO(currentLicense.expires_at), 'dd/MM/yyyy') : 
                      'Nunca'}</p>
                </div>
              </div>

              {/* Uso Atual */}
              <div>
                <Label className="text-sm text-gray-500 mb-3 block">Uso Atual</Label>
                <div className="space-y-3">
                  {currentLicense.limits.max_patients !== -1 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Pacientes</span>
                        <span>{currentLicense.usage.current_patients} / {currentLicense.limits.max_patients}</span>
                      </div>
                      <Progress 
                        value={(currentLicense.usage.current_patients / currentLicense.limits.max_patients) * 100} 
                      />
                    </div>
                  )}

                  {currentLicense.limits.max_appointments_per_month !== -1 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Agendamentos/Mês</span>
                        <span>{currentLicense.usage.appointments_this_month} / {currentLicense.limits.max_appointments_per_month}</span>
                      </div>
                      <Progress 
                        value={(currentLicense.usage.appointments_this_month / currentLicense.limits.max_appointments_per_month) * 100} 
                      />
                    </div>
                  )}

                  {currentLicense.limits.max_storage_mb !== -1 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Armazenamento</span>
                        <span>{currentLicense.usage.storage_used_mb} MB / {currentLicense.limits.max_storage_mb} MB</span>
                      </div>
                      <Progress 
                        value={(currentLicense.usage.storage_used_mb / currentLicense.limits.max_storage_mb) * 100} 
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Recursos Disponíveis */}
              <div>
                <Label className="text-sm text-gray-500 mb-3 block">Recursos Disponíveis</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {currentLicense.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>{feature.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertas */}
              {currentLicense.expires_at && calculateDaysUntilExpiry(currentLicense.expires_at) <= 30 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 text-amber-600 mr-3" />
                      <div>
                        <div className="font-medium text-amber-800">Licença Expirando</div>
                        <div className="text-sm text-amber-700">
                          Sua licença expira em {calculateDaysUntilExpiry(currentLicense.expires_at)} dias. 
                          Renove para continuar usando os recursos premium.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setStep('input')} className="flex-1">
                Nova Licença
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}