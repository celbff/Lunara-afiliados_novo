// components/settings/ConfiguracoesEspeciais.tsx - Painel de Configurações Especiais
'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Switch } from '@/components/ui/Switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Progress } from '@/components/ui/Progress'
import { 
  Save, 
  Download, 
  Upload, 
  Calendar,
  Clock,
  Database,
  Shield,
  Bell,
  FileText,
  Settings,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useExportImport } from '@/hooks/useExportImport'
import { useFeriados } from '@/hooks/useFeriados'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ConfiguracoesEspeciaisProps {
  onClose?: () => void
}

export default function ConfiguracoesEspeciais({ onClose }: ConfiguracoesEspeciaisProps) {
  const [activeTab, setActiveTab] = useState('autosave')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Hooks
  const { 
    autoSaveState, 
    forceSave, 
    toggleAutoSave, 
    config: autoSaveConfig 
  } = useAutoSave()

  const { 
    exportImportState, 
    exportData, 
    importData, 
    quickExportJSON, 
    quickExportCSV 
  } = useExportImport()

  const { 
    configuracao: feriadosConfig,
    feriados,
    loading: feriadosLoading,
    atualizarConfiguracao: atualizarFeriados,
    getProximosFeriados,
    adicionarFeriadoPersonalizado
  } = useFeriados()

  // Estados locais
  const [novoFeriado, setNovoFeriado] = useState({
    nome: '',
    data: '',
    recorrente: false,
    cor: '#FF6B6B'
  })

  // Handleres para Export/Import
  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    const options = {
      format,
      includePatients: true,
      includeTherapies: true,
      includeAppointments: true
    }

    if (format === 'pdf') {
      options.dateRange = {
        start: format(new Date(), 'yyyy-MM-01'),
        end: format(new Date(), 'yyyy-MM-dd')
      }
    }

    await exportData(options)
  }

  const handleImport = async () => {
    if (!uploadFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo para importar",
        variant: "destructive"
      })
      return
    }

    const fileExtension = uploadFile.name.split('.').pop()?.toLowerCase()
    const format = fileExtension === 'json' ? 'json' : 'csv'

    await importData(uploadFile, {
      format,
      overwrite: false,
      mergeStrategy: 'update',
      validateData: true
    })

    setUploadFile(null)
  }

  const handleAddFeriado = () => {
    if (!novoFeriado.nome || !novoFeriado.data) {
      toast({
        title: "Erro",
        description: "Preencha nome e data do feriado",
        variant: "destructive"
      })
      return
    }

    adicionarFeriadoPersonalizado({
      nome: novoFeriado.nome,
      data: novoFeriado.data,
      recorrente: novoFeriado.recorrente,
      cor: novoFeriado.cor,
      ativo: true
    })

    setNovoFeriado({
      nome: '',
      data: '',
      recorrente: false,
      cor: '#FF6B6B'
    })

    toast({
      title: "Feriado adicionado",
      description: "Feriado personalizado criado com sucesso",
    })
  }

  const proximosFeriados = getProximosFeriados(3)

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configurações Especiais</h2>
          <p className="text-gray-600">Configure funcionalidades avançadas do sistema</p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="autosave" className="flex items-center">
            <Save className="w-4 h-4 mr-2" />
            Auto-save
          </TabsTrigger>
          <TabsTrigger value="export-import" className="flex items-center">
            <Database className="w-4 h-4 mr-2" />
            Export/Import
          </TabsTrigger>
          <TabsTrigger value="feriados" className="flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Feriados
          </TabsTrigger>
          <TabsTrigger value="sistema" className="flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* ==================== AUTO-SAVE ==================== */}
        <TabsContent value="autosave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Save className="w-5 h-5 mr-2 text-blue-600" />
                Configurações de Auto-save
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status do Auto-save */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      autoSaveState.isEnabled ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium">
                      {autoSaveState.isEnabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {autoSaveState.lastSaved 
                      ? `Último save: ${format(autoSaveState.lastSaved, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
                      : 'Nenhum save realizado'
                    }
                  </p>
                </div>
                <Switch
                  checked={autoSaveState.isEnabled}
                  onCheckedChange={toggleAutoSave}
                />
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{autoSaveState.saveCount}</div>
                  <div className="text-sm text-gray-600">Saves realizados</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{autoSaveState.errorCount}</div>
                  <div className="text-sm text-gray-600">Erros</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {autoSaveConfig.interval / 1000}s
                  </div>
                  <div className="text-sm text-gray-600">Intervalo</div>
                </div>
              </div>

              {/* Estado atual */}
              {autoSaveState.isSaving && (
                <Alert>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <AlertDescription>
                    Salvando dados automaticamente...
                  </AlertDescription>
                </Alert>
              )}

              {autoSaveState.hasUnsavedChanges && (
                <Alert>
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    Existem alterações não salvas. 
                    <Button 
                      variant="link" 
                      className="p-0 ml-2 h-auto"
                      onClick={forceSave}
                    >
                      Salvar agora
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Ações */}
              <div className="flex space-x-3">
                <Button onClick={forceSave} disabled={autoSaveState.isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Agora
                </Button>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurar Intervalos
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== EXPORT/IMPORT ==================== */}
        <TabsContent value="export-import" className="space-y-6">
          {/* Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="w-5 h-5 mr-2 text-green-600" />
                Exportar Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {exportImportState.isExporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Exportando...</span>
                    <span>{exportImportState.progress}%</span>
                  </div>
                  <Progress value={exportImportState.progress} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={() => handleExport('json')}
                  disabled={exportImportState.isExporting}
                  className="flex items-center justify-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Exportar JSON
                </Button>
                <Button 
                  onClick={() => handleExport('csv')}
                  disabled={exportImportState.isExporting}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
                <Button 
                  onClick={() => handleExport('pdf')}
                  disabled={exportImportState.isExporting}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Relatório PDF
                </Button>
                <Button 
                  onClick={quickExportJSON}
                  disabled={exportImportState.isExporting}
                  variant="secondary"
                  className="flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Backup Completo
                </Button>
              </div>

              {exportImportState.lastExport && (
                <p className="text-sm text-gray-600">
                  Última exportação: {format(exportImportState.lastExport, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Import */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2 text-blue-600" />
                Importar Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {exportImportState.isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importando...</span>
                    <span>{exportImportState.progress}%</span>
                  </div>
                  <Progress value={exportImportState.progress} />
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {uploadFile ? (
                  <div className="space-y-2">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                    <p className="font-medium">{uploadFile.name}</p>
                    <p className="text-sm text-gray-600">
                      Tamanho: {(uploadFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadFile(null)}
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-gray-600">Selecione um arquivo JSON ou CSV</p>
                    <input
                      type="file"
                      accept=".json,.csv"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="upload-file"
                    />
                    <Label htmlFor="upload-file">
                      <Button variant="outline" asChild>
                        <span>Escolher Arquivo</span>
                      </Button>
                    </Label>
                  </div>
                )}
              </div>

              {uploadFile && (
                <div className="flex space-x-3">
                  <Button 
                    onClick={handleImport}
                    disabled={exportImportState.isImporting}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </Button>
                  <Button variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    Opções Avançadas
                  </Button>
                </div>
              )}

              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  A importação irá mesclar os dados com os existentes. 
                  Registros com mesmo ID serão atualizados.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== FERIADOS ==================== */}
        <TabsContent value="feriados" className="space-y-6">
          {/* Configurações de Feriados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                Configuração de Feriados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Feriados Nacionais</Label>
                    <Switch
                      checked={feriadosConfig.incluirFeriadosNacionais}
                      onCheckedChange={(checked) => 
                        atualizarFeriados({ incluirFeriadosNacionais: checked })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Feriados Estaduais</Label>
                    <Switch
                      checked={feriadosConfig.incluirFeriadosEstaduais}
                      onCheckedChange={(checked) => 
                        atualizarFeriados({ incluirFeriadosEstaduais: checked })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Feriados Municipais</Label>
                    <Switch
                      checked={feriadosConfig.incluirFeriadosMunicipais}
                      onCheckedChange={(checked) => 
                        atualizarFeriados({ incluirFeriadosMunicipais: checked })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Bloquear Fins de Semana</Label>
                    <Switch
                      checked={feriadosConfig.bloquearAgendamentosFinsDeSemana}
                      onCheckedChange={(checked) => 
                        atualizarFeriados({ bloquearAgendamentosFinsDeSemana: checked })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Bloquear Feriados</Label>
                    <Switch
                      checked={feriadosConfig.bloquearAgendamentosFeriados}
                      onCheckedChange={(checked) => 
                        atualizarFeriados({ bloquearAgendamentosFeriados: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select 
                      value={feriadosConfig.estado}
                      onValueChange={(value) => atualizarFeriados({ estado: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SP">São Paulo</SelectItem>
                        <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                        <SelectItem value="MG">Minas Gerais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Próximos Feriados */}
              <div>
                <h4 className="font-medium mb-3">Próximos Feriados</h4>
                <div className="space-y-2">
                  {proximosFeriados.map((feriado) => (
                    <div key={feriado.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: feriado.cor }}
                        />
                        <div>
                          <div className="font-medium">{feriado.nome}</div>
                          <div className="text-sm text-gray-600">
                            {format(new Date(feriado.data), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{feriado.tipo}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adicionar Feriado Personalizado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="w-5 h-5 mr-2 text-green-600" />
                Adicionar Feriado Personalizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Feriado</Label>
                  <Input
                    value={novoFeriado.nome}
                    onChange={(e) => setNovoFeriado(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Aniversário da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={novoFeriado.data}
                    onChange={(e) => setNovoFeriado(prev => ({ ...prev, data: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={novoFeriado.recorrente}
                    onCheckedChange={(checked) => setNovoFeriado(prev => ({ ...prev, recorrente: checked }))}
                  />
                  <Label>Feriado recorrente (anual)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Label>Cor:</Label>
                  <input
                    type="color"
                    value={novoFeriado.cor}
                    onChange={(e) => setNovoFeriado(prev => ({ ...prev, cor: e.target.value }))}
                    className="w-8 h-8 rounded border"
                  />
                </div>
              </div>

              <Button onClick={handleAddFeriado} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Feriado
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SISTEMA ==================== */}
        <TabsContent value="sistema" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2 text-gray-600" />
                Configurações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notificações */}
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <Bell className="w-4 h-4 mr-2" />
                  Notificações
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Notificações Push</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Email de Lembrete</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Som de Notificação</Label>
                    <Switch />
                  </div>
                </div>
              </div>

              {/* Segurança */}
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Segurança
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Backup Automático</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Criptografia Local</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Log de Atividades</Label>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              {/* Manutenção */}
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  Manutenção
                </h4>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Limpar Cache
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Database className="w-4 h-4 mr-2" />
                    Otimizar Banco de Dados
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="w-full justify-start"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Todos os Dados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}