// pages/AdminMasterPage.tsx - Painel de Controle Completo para Admin Master
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Switch } from '@/components/ui/Switch'
import { Progress } from '@/components/ui/Progress'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { 
  Users,
  Key,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Send,
  Ban,
  UserCheck,
  Settings,
  Shield,
  Crown,
  Star,
  Clock,
  Calendar,
  Mail,
  Phone,
  Globe,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  Filter,
  Search,
  Eye,
  Copy,
  Bell,
  Zap,
  Target,
  Award
} from 'lucide-react'
import { useLicensing } from '@/hooks/useLicensing'
import { toast } from '@/hooks/use-toast'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { User, LicenseKey, PaymentRecord } from '@/types/licensing'

interface LicenseGenerationForm {
  template: string
  quantity: number
  type: 'free' | 'premium' | 'admin'
  duration_days: number | null
  notes: string
}

interface NotificationForm {
  type: 'single' | 'bulk' | 'all'
  userIds: string[]
  title: string
  message: string
  send_email: boolean
  send_push: boolean
}

const FORM_INICIAL_LICENSE: LicenseGenerationForm = {
  template: 'PREM',
  quantity: 1,
  type: 'premium',
  duration_days: 365,
  notes: ''
}

const FORM_INICIAL_NOTIFICATION: NotificationForm = {
  type: 'single',
  userIds: [],
  title: '',
  message: '',
  send_email: true,
  send_push: false
}

const CORES_GRAFICOS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function AdminMasterPage() {
  const {
    currentUser,
    allUsers,
    allLicenses,
    adminStats,
    isLoading,
    loadAdminData,
    generateLicenseKeys,
    revokeLicense,
    suspendUser,
    activateUser,
    updateUserLicense,
    deleteUser,
    sendNotificationToUser,
    sendBulkNotification,
    exportUserData,
    getPaymentHistory,
    formatLicenseKey,
    getLicenseStatusColor,
    calculateDaysUntilExpiry
  } = useLicensing()

  const [activeTab, setActiveTab] = useState('dashboard')
  const [filtroUsuarios, setFiltroUsuarios] = useState('')
  const [filtroLicencas, setFiltroLicencas] = useState('')
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<User | null>(null)
  const [licenseForm, setLicenseForm] = useState<LicenseGenerationForm>(FORM_INICIAL_LICENSE)
  const [notificationForm, setNotificationForm] = useState<NotificationForm>(FORM_INICIAL_NOTIFICATION)
  const [dialogLicenseOpen, setDialogLicenseOpen] = useState(false)
  const [dialogNotificationOpen, setDialogNotificationOpen] = useState(false)
  const [dialogUserDetailsOpen, setDialogUserDetailsOpen] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([])
  const [licenseKeysGenerated, setLicenseKeysGenerated] = useState<LicenseKey[]>([])

  // Verificar se é admin master
  useEffect(() => {
    if (currentUser?.role !== 'master') {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta área",
        variant: "destructive"
      })
      return
    }

    loadAdminData()
  }, [currentUser, loadAdminData])

  // Carregar histórico de pagamentos
  useEffect(() => {
    if (currentUser?.role === 'master') {
      getPaymentHistory().then(setPaymentHistory)
    }
  }, [currentUser, getPaymentHistory])

  // Filtrar usuários
  const usuariosFiltrados = useMemo(() => {
    if (!filtroUsuarios) return allUsers
    
    return allUsers.filter(user => 
      user.name.toLowerCase().includes(filtroUsuarios.toLowerCase()) ||
      user.email.toLowerCase().includes(filtroUsuarios.toLowerCase()) ||
      user.clinic_name?.toLowerCase().includes(filtroUsuarios.toLowerCase())
    )
  }, [allUsers, filtroUsuarios])

  // Filtrar licenças
  const licencasFiltradas = useMemo(() => {
    if (!filtroLicencas) return allLicenses
    
    return allLicenses.filter(license => 
      license.key.toLowerCase().includes(filtroLicencas.toLowerCase()) ||
      license.type.toLowerCase().includes(filtroLicencas.toLowerCase()) ||
      license.status.toLowerCase().includes(filtroLicencas.toLowerCase())
    )
  }, [allLicenses, filtroLicencas])

  // Dados para gráficos
  const dadosUsuariosPorTipo = useMemo(() => {
    if (!adminStats) return []
    
    return [
      { name: 'Premium', value: adminStats.premium_users, color: '#10B981' },
      { name: 'Free', value: adminStats.free_users, color: '#3B82F6' },
      { name: 'Inativos', value: adminStats.total_users - adminStats.active_users, color: '#EF4444' }
    ]
  }, [adminStats])

  const dadosCrescimento = useMemo(() => {
    return adminStats?.user_growth || []
  }, [adminStats])

  // Handlers
  const handleGerarLicencas = async () => {
    try {
      const template = `${licenseForm.template}-${format(new Date(), 'yyyy-MM')}`
      const keys = await generateLicenseKeys(template, licenseForm.quantity)
      
      setLicenseKeysGenerated(keys)
      
      toast({
        title: "Licenças geradas",
        description: `${keys.length} licenças geradas com sucesso`,
      })
      
      setDialogLicenseOpen(false)
      setLicenseForm(FORM_INICIAL_LICENSE)
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao gerar licenças",
        variant: "destructive"
      })
    }
  }

  const handleEnviarNotificacao = async () => {
    try {
      if (notificationForm.type === 'single' && notificationForm.userIds.length > 0) {
        await sendNotificationToUser(notificationForm.userIds[0], notificationForm.message)
      } else if (notificationForm.type === 'bulk' && notificationForm.userIds.length > 0) {
        await sendBulkNotification(notificationForm.userIds, notificationForm.message)
      } else if (notificationForm.type === 'all') {
        await sendBulkNotification(allUsers.map(u => u.id), notificationForm.message)
      }
      
      toast({
        title: "Notificação enviada",
        description: "Notificação enviada com sucesso",
      })
      
      setDialogNotificationOpen(false)
      setNotificationForm(FORM_INICIAL_NOTIFICATION)
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar notificação",
        variant: "destructive"
      })
    }
  }

  const handleSuspenderUsuario = async (userId: string) => {
    try {
      await suspendUser(userId)
      toast({
        title: "Usuário suspenso",
        description: "Usuário suspenso com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao suspender usuário",
        variant: "destructive"
      })
    }
  }

  const handleAtivarUsuario = async (userId: string) => {
    try {
      await activateUser(userId)
      toast({
        title: "Usuário ativado",
        description: "Usuário ativado com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao ativar usuário",
        variant: "destructive"
      })
    }
  }

  const handleRevogarLicenca = async (licenseId: string) => {
    try {
      await revokeLicense(licenseId)
      toast({
        title: "Licença revogada",
        description: "Licença revogada com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao revogar licença",
        variant: "destructive"
      })
    }
  }

  const handleExportarDados = async (userId: string) => {
    try {
      const blob = await exportUserData(userId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user-${userId}-data.json`
      a.click()
      URL.revokeObjectURL(url)
      
      toast({
        title: "Dados exportados",
        description: "Dados do usuário exportados com sucesso",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar dados",
        variant: "destructive"
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência",
    })
  }

  // Verificar acesso
  if (currentUser?.role !== 'master') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-gray-600">Você não tem permissão para acessar esta área.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !adminStats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Carregando painel administrativo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Crown className="w-8 h-8 text-yellow-500 mr-3" />
            Painel Master Admin
          </h1>
          <p className="text-gray-600">Controle total do sistema - Celso Bif</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm" onClick={() => setDialogNotificationOpen(true)}>
            <Bell className="w-4 h-4 mr-2" />
            Notificar Usuários
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialogLicenseOpen(true)}>
            <Key className="w-4 h-4 mr-2" />
            Gerar Licenças
          </Button>
          <Button onClick={loadAdminData} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="licenses">Licenças</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* ==================== DASHBOARD ==================== */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Usuários</p>
                    <p className="text-3xl font-bold text-blue-600">{adminStats.total_users}</p>
                    <div className="flex items-center mt-2">
                      <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                      <span className="text-sm text-green-600">{adminStats.active_users} ativos</span>
                    </div>
                  </div>
                  <Users className="w-12 h-12 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Receita Mensal</p>
                    <p className="text-3xl font-bold text-green-600">R$ {adminStats.revenue_this_month.toFixed(0)}</p>
                    <div className="flex items-center mt-2">
                      <DollarSign className="w-4 h-4 text-green-600 mr-1" />
                      <span className="text-sm text-green-600">R$ {adminStats.revenue_total.toFixed(0)} total</span>
                    </div>
                  </div>
                  <DollarSign className="w-12 h-12 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Usuários Premium</p>
                    <p className="text-3xl font-bold text-purple-600">{adminStats.premium_users}</p>
                    <div className="flex items-center mt-2">
                      <Star className="w-4 h-4 text-purple-600 mr-1" />
                      <span className="text-sm text-purple-600">
                        {((adminStats.premium_users / adminStats.total_users) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Crown className="w-12 h-12 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Licenças Ativas</p>
                    <p className="text-3xl font-bold text-orange-600">{adminStats.active_licenses}</p>
                    <div className="flex items-center mt-2">
                      <Key className="w-4 h-4 text-orange-600 mr-1" />
                      <span className="text-sm text-orange-600">{adminStats.expired_licenses} expiradas</span>
                    </div>
                  </div>
                  <Key className="w-12 h-12 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dadosUsuariosPorTipo}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {dadosUsuariosPorTipo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Crescimento de Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dadosCrescimento}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total_users" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="new_users" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Atividade Recente */}
          <Card>
            <CardHeader>
              <CardTitle>Usuários Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={user.license?.type === 'premium' ? 'default' : 'secondary'}>
                        {user.license?.type || 'free'}
                      </Badge>
                      <Badge variant={user.status === 'active' ? 'success' : 'destructive'}>
                        {user.status}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => {
                        setUsuarioSelecionado(user)
                        setDialogUserDetailsOpen(true)
                      }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== USUÁRIOS ==================== */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar usuários..."
                  value={filtroUsuarios}
                  onChange={(e) => setFiltroUsuarios(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => setDialogNotificationOpen(true)}>
                <Send className="w-4 h-4 mr-2" />
                Notificar
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium">Usuário</th>
                      <th className="text-left p-4 font-medium">Licença</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Último Login</th>
                      <th className="text-left p-4 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((user) => (
                      <tr key={user.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                              <div className="text-xs text-gray-400">{user.clinic_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <Badge variant={user.license?.type === 'premium' ? 'default' : 'secondary'}>
                              {user.license?.type || 'free'}
                            </Badge>
                            {user.license?.expires_at && (
                              <div className="text-xs text-gray-500">
                                Expira em {calculateDaysUntilExpiry(user.license.expires_at)} dias
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              {user.license?.usage.current_patients || 0} pacientes
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.status === 'active' ? 'success' : 
                            user.status === 'suspended' ? 'destructive' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {user.last_login ? format(parseISO(user.last_login), 'dd/MM/yyyy HH:mm') : 'Nunca'}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex space-x-1">
                            <Button size="sm" variant="outline" onClick={() => {
                              setUsuarioSelecionado(user)
                              setDialogUserDetailsOpen(true)
                            }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {user.status === 'active' ? (
                              <Button size="sm" variant="outline" onClick={() => handleSuspenderUsuario(user.id)}>
                                <Ban className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleAtivarUsuario(user.id)}>
                                <UserCheck className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button size="sm" variant="outline" onClick={() => handleExportarDados(user.id)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== LICENÇAS ==================== */}
        <TabsContent value="licenses" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar licenças..."
                  value={filtroLicencas}
                  onChange={(e) => setFiltroLicencas(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Button onClick={() => setDialogLicenseOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Gerar Licenças
            </Button>
          </div>

          {/* Licenças Geradas Recentemente */}
          {licenseKeysGenerated.length > 0 && (
            <Card>
              <CardHeader>
                <CartTitle>Licenças Geradas Recentemente</CartTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {licenseKeysGenerated.map((license) => (
                    <div key={license.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Key className="w-5 h-5 text-green-600" />
                        <code className="bg-white px-2 py-1 rounded text-sm">{formatLicenseKey(license.key)}</code>
                        <Badge variant="default">{license.type}</Badge>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(license.key)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium">Chave</th>
                      <th className="text-left p-4 font-medium">Tipo</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Usado Por</th>
                      <th className="text-left p-4 font-medium">Expira</th>
                      <th className="text-left p-4 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licencasFiltradas.map((license) => (
                      <tr key={license.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {formatLicenseKey(license.key)}
                          </code>
                        </td>
                        <td className="p-4">
                          <Badge variant={license.type === 'premium' ? 'default' : 
                            license.type === 'admin' ? 'destructive' : 'secondary'}>
                            {license.type}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={license.status === 'active' ? 'success' : 
                            license.status === 'used' ? 'default' : 'destructive'}>
                            {license.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {license.used_by ? (
                            <div className="text-sm">
                              {allUsers.find(u => u.id === license.used_by)?.name || 'Usuário removido'}
                            </div>
                          ) : (
                            <span className="text-gray-400">Não usado</span>
                          )}
                        </td>
                        <td className="p-4">
                          {license.expires_at ? (
                            <div className="text-sm">
                              {format(parseISO(license.expires_at), 'dd/MM/yyyy')}
                              <div className="text-xs text-gray-500">
                                {calculateDaysUntilExpiry(license.expires_at)} dias
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">Nunca</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex space-x-1">
                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(license.key)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                            
                            {license.status === 'active' && (
                              <Button size="sm" variant="outline" onClick={() => handleRevogarLicenca(license.id)}>
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== PAGAMENTOS ==================== */}
        <TabsContent value="payments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Receita Total</p>
                    <p className="text-2xl font-bold text-green-600">R$ {adminStats.revenue_total.toFixed(2)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Este Mês</p>
                    <p className="text-2xl font-bold text-blue-600">R$ {adminStats.revenue_this_month.toFixed(2)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pagamentos</p>
                    <p className="text-2xl font-bold text-purple-600">{paymentHistory.length}</p>
                  </div>
                  <Activity className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium">Data</th>
                      <th className="text-left p-4 font-medium">Usuário</th>
                      <th className="text-left p-4 font-medium">Valor</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((payment) => (
                      <tr key={payment.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          {format(parseISO(payment.created_at), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="p-4">
                          {allUsers.find(u => u.id === payment.user_id)?.name || 'Usuário removido'}
                        </td>
                        <td className="p-4 font-medium">
                          R$ {payment.amount.toFixed(2)}
                        </td>
                        <td className="p-4">
                          <Badge variant={payment.status === 'completed' ? 'success' : 
                            payment.status === 'failed' ? 'destructive' : 'secondary'}>
                            {payment.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {payment.payment_method}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ANALYTICS ==================== */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Features Mais Usadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminStats.top_features.map((feature, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <span className="font-medium">{feature.feature}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Progress value={(feature.usage_count / adminStats.top_features[0].usage_count) * 100} className="w-24" />
                        <span className="text-sm text-gray-500">{feature.usage_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ativação de Licenças</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={adminStats.license_usage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="activations" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="expirations" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== CONFIGURAÇÕES ==================== */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Manutenção do Sistema</h3>
                    <p className="text-sm text-gray-500">Ativar modo de manutenção</p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Notificações Automáticas</h3>
                    <p className="text-sm text-gray-500">Enviar alertas de expiração</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Logs Detalhados</h3>
                    <p className="text-sm text-gray-500">Registrar todas as ações</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup e Segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Fazer Backup Completo
                </Button>
                
                <Button variant="outline" className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Restaurar Backup
                </Button>

                <Button variant="outline" className="w-full">
                  <Shield className="w-4 h-4 mr-2" />
                  Verificar Segurança
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOGS ==================== */}

      {/* Dialog Geração de Licenças */}
      <Dialog open={dialogLicenseOpen} onOpenChange={setDialogLicenseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Licenças</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select 
                value={licenseForm.template} 
                onValueChange={(value) => setLicenseForm(prev => ({ ...prev, template: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREM">PREM (Premium)</SelectItem>
                  <SelectItem value="FREE">FREE (Gratuito)</SelectItem>
                  <SelectItem value="ADMIN">ADMIN (Administrativo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Licença</Label>
              <Select 
                value={licenseForm.type} 
                onValueChange={(value) => setLicenseForm(prev => ({ ...prev, type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="admin">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={licenseForm.quantity}
                onChange={(e) => setLicenseForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Duração (dias)</Label>
              <Input
                type="number"
                min="1"
                max="3650"
                value={licenseForm.duration_days || ''}
                onChange={(e) => setLicenseForm(prev => ({ ...prev, duration_days: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Deixe vazio para permanente"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={licenseForm.notes}
                onChange={(e) => setLicenseForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações internas..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => setDialogLicenseOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGerarLicencas}>
                <Key className="w-4 h-4 mr-2" />
                Gerar Licenças
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Notificações */}
      <Dialog open={dialogNotificationOpen} onOpenChange={setDialogNotificationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Notificação</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Envio</Label>
              <Select 
                value={notificationForm.type} 
                onValueChange={(value) => setNotificationForm(prev => ({ ...prev, type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Usuário Específico</SelectItem>
                  <SelectItem value="bulk">Múltiplos Usuários</SelectItem>
                  <SelectItem value="all">Todos os Usuários</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {notificationForm.type !== 'all' && (
              <div className="space-y-2">
                <Label>Usuários</Label>
                <Select 
                  value={notificationForm.userIds[0] || ''} 
                  onValueChange={(value) => setNotificationForm(prev => ({ ...prev, userIds: [value] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={notificationForm.title}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título da notificação"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={notificationForm.message}
                onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Conteúdo da notificação..."
                rows={4}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={notificationForm.send_email}
                  onCheckedChange={(checked) => setNotificationForm(prev => ({ ...prev, send_email: checked }))}
                />
                <Label>Enviar por email</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={notificationForm.send_push}
                  onCheckedChange={(checked) => setNotificationForm(prev => ({ ...prev, send_push: checked }))}
                />
                <Label>Notificação push</Label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => setDialogNotificationOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEnviarNotificacao}>
                <Send className="w-4 h-4 mr-2" />
                Enviar Notificação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes do Usuário */}
      <Dialog open={dialogUserDetailsOpen} onOpenChange={setDialogUserDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          
          {usuarioSelecionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-500">Nome</Label>
                    <p className="font-medium">{usuarioSelecionado.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Email</Label>
                    <p>{usuarioSelecionado.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Clínica</Label>
                    <p>{usuarioSelecionado.clinic_name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-500">Status</Label>
                    <Badge variant={usuarioSelecionado.status === 'active' ? 'success' : 'destructive'}>
                      {usuarioSelecionado.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Último Login</Label>
                    <p>{usuarioSelecionado.last_login ? format(parseISO(usuarioSelecionado.last_login), 'dd/MM/yyyy HH:mm') : 'Nunca'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Criado em</Label>
                    <p>{format(parseISO(usuarioSelecionado.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              </div>

              {usuarioSelecionado.license && (
                <div>
                  <h3 className="font-medium mb-3">Informações da Licença</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-gray-500">Tipo</Label>
                        <Badge variant={usuarioSelecionado.license.type === 'premium' ? 'default' : 'secondary'}>
                          {usuarioSelecionado.license.type}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Status</Label>
                        <Badge variant={usuarioSelecionado.license.status === 'active' ? 'success' : 'destructive'}>
                          {usuarioSelecionado.license.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-500">Uso Atual</Label>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Pacientes: {usuarioSelecionado.license.usage.current_patients}</div>
                        <div>Agendamentos/mês: {usuarioSelecionado.license.usage.appointments_this_month}</div>
                        <div>Terapias: {usuarioSelecionado.license.usage.current_therapies}</div>
                        <div>Armazenamento: {usuarioSelecionado.license.usage.storage_used_mb} MB</div>
                      </div>
                    </div>

                    {usuarioSelecionado.license.expires_at && (
                      <div>
                        <Label className="text-sm text-gray-500">Expira em</Label>
                        <p>{format(parseISO(usuarioSelecionado.license.expires_at), 'dd/MM/yyyy')} 
                           ({calculateDaysUntilExpiry(usuarioSelecionado.license.expires_at)} dias)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 justify-end">
                <Button variant="outline" onClick={() => handleExportarDados(usuarioSelecionado.id)}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Dados
                </Button>
                
                {usuarioSelecionado.status === 'active' ? (
                  <Button variant="outline" onClick={() => handleSuspenderUsuario(usuarioSelecionado.id)}>
                    <Ban className="w-4 h-4 mr-2" />
                    Suspender
                  </Button>
                ) : (
                  <Button onClick={() => handleAtivarUsuario(usuarioSelecionado.id)}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Ativar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}