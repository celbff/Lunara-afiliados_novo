// hooks/useExportImport.tsx - Hook para Export/Import de Dados
'use client'

import { useCallback, useState } from 'react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Paciente, Terapia, Agendamento } from '@/types/agenda'

export type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf' | 'ical'
export type ImportFormat = 'json' | 'csv'

interface ExportOptions {
  format: ExportFormat
  includePatients: boolean
  includeTherapies: boolean
  includeAppointments: boolean
  dateRange?: {
    start: string
    end: string
  }
  compress?: boolean
}

interface ImportOptions {
  format: ImportFormat
  overwrite: boolean
  mergeStrategy: 'skip' | 'update' | 'replace'
  validateData: boolean
}

interface ExportImportState {
  isExporting: boolean
  isImporting: boolean
  lastExport: Date | null
  lastImport: Date | null
  progress: number
}

export function useExportImport() {
  const { state, actions } = useAgenda()
  const [exportImportState, setExportImportState] = useState<ExportImportState>({
    isExporting: false,
    isImporting: false,
    lastExport: null,
    lastImport: null,
    progress: 0
  })

  // ==================== EXPORT ====================

  // Exportar dados
  const exportData = useCallback(async (options: ExportOptions) => {
    setExportImportState(prev => ({ ...prev, isExporting: true, progress: 0 }))

    try {
      let data: any = {}

      // Selecionar dados para exportação
      if (options.includePatients) {
        data.pacientes = state.pacientes
        setExportImportState(prev => ({ ...prev, progress: 20 }))
      }

      if (options.includeTherapies) {
        data.terapias = state.terapias
        setExportImportState(prev => ({ ...prev, progress: 40 }))
      }

      if (options.includeAppointments) {
        let agendamentos = state.agendamentos

        // Filtrar por data se especificado
        if (options.dateRange) {
          agendamentos = agendamentos.filter(a => 
            a.data >= options.dateRange!.start && 
            a.data <= options.dateRange!.end
          )
        }

        data.agendamentos = agendamentos
        setExportImportState(prev => ({ ...prev, progress: 60 }))
      }

      // Adicionar metadados
      data.metadata = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        format: options.format,
        source: 'Agenda Terapeutica'
      }

      setExportImportState(prev => ({ ...prev, progress: 80 }))

      // Gerar arquivo baseado no formato
      let blob: Blob
      let filename: string

      switch (options.format) {
        case 'json':
          blob = await generateJSONExport(data, options)
          filename = `agenda-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
          break

        case 'csv':
          blob = await generateCSVExport(data, options)
          filename = `agenda-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`
          break

        case 'excel':
          blob = await generateExcelExport(data, options)
          filename = `agenda-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`
          break

        case 'pdf':
          blob = await generatePDFExport(data, options)
          filename = `agenda-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`
          break

        case 'ical':
          blob = await generateICalExport(data, options)
          filename = `agenda-calendar-${format(new Date(), 'yyyy-MM-dd-HHmm')}.ics`
          break

        default:
          throw new Error(`Formato ${options.format} não suportado`)
      }

      setExportImportState(prev => ({ ...prev, progress: 100 }))

      // Fazer download
      downloadFile(blob, filename)

      setExportImportState(prev => ({ 
        ...prev, 
        isExporting: false, 
        lastExport: new Date(),
        progress: 0
      }))

      toast({
        title: "Exportação concluída",
        description: `Dados exportados com sucesso para ${filename}`,
      })

    } catch (error) {
      console.error('Erro na exportação:', error)
      setExportImportState(prev => ({ ...prev, isExporting: false, progress: 0 }))
      
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      })
    }
  }, [state.pacientes, state.terapias, state.agendamentos])

  // Gerar JSON
  const generateJSONExport = useCallback(async (data: any, options: ExportOptions): Promise<Blob> => {
    const jsonString = JSON.stringify(data, null, 2)
    
    if (options.compress) {
      // Implementar compressão se necessário
      // const compressed = await compress(jsonString)
      // return new Blob([compressed], { type: 'application/zip' })
    }
    
    return new Blob([jsonString], { type: 'application/json' })
  }, [])

  // Gerar CSV
  const generateCSVExport = useCallback(async (data: any, options: ExportOptions): Promise<Blob> => {
    let csvContent = ''

    // Exportar pacientes
    if (data.pacientes && data.pacientes.length > 0) {
      csvContent += 'PACIENTES\n'
      csvContent += 'ID,Nome,Telefone,Email,Data Nascimento,Endereco,Observacoes\n'
      
      data.pacientes.forEach((p: Paciente) => {
        csvContent += `${p.id},"${p.nome}","${p.telefone}","${p.email || ''}","${p.data_nascimento || ''}","${p.endereco || ''}","${p.observacoes || '"}"\n`
      })
      csvContent += '\n'
    }

    // Exportar terapias
    if (data.terapias && data.terapias.length > 0) {
      csvContent += 'TERAPIAS\n'
      csvContent += 'ID,Nome,Descricao,Duracao,Preco,Cor,Ativa\n'
      
      data.terapias.forEach((t: Terapia) => {
        csvContent += `${t.id},"${t.nome}","${t.descricao || ''}",${t.duracao},${t.preco},"${t.cor}",${t.ativa}\n`
      })
      csvContent += '\n'
    }

    // Exportar agendamentos
    if (data.agendamentos && data.agendamentos.length > 0) {
      csvContent += 'AGENDAMENTOS\n'
      csvContent += 'ID,Paciente ID,Terapia ID,Data,Hora,Status,Valor,Observacoes\n'
      
      data.agendamentos.forEach((a: Agendamento) => {
        csvContent += `${a.id},${a.paciente_id},${a.terapia_id},"${a.data}","${a.hora}","${a.status}",${a.valor || ''},"${a.observacoes || '"}"\n`
      })
    }

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  }, [])

  // Gerar Excel (simulado com CSV)
  const generateExcelExport = useCallback(async (data: any, options: ExportOptions): Promise<Blob> => {
    // Para uma implementação real, usar bibliotecas como xlsx
    return generateCSVExport(data, options)
  }, [generateCSVExport])

  // Gerar PDF
  const generatePDFExport = useCallback(async (data: any, options: ExportOptions): Promise<Blob> => {
    // Implementação simplificada - em produção usar jsPDF ou similar
    const htmlContent = `
      <html>
        <head>
          <title>Relatório de Agenda</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Relatório de Agenda Terapêutica</h1>
          <p>Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
          
          ${data.pacientes ? `
            <h2>Pacientes (${data.pacientes.length})</h2>
            <table>
              <tr><th>Nome</th><th>Telefone</th><th>Email</th></tr>
              ${data.pacientes.map((p: Paciente) => `
                <tr><td>${p.nome}</td><td>${p.telefone}</td><td>${p.email || '-'}</td></tr>
              `).join('')}
            </table>
          ` : ''}
          
          ${data.terapias ? `
            <h2>Terapias (${data.terapias.length})</h2>
            <table>
              <tr><th>Nome</th><th>Duração</th><th>Preço</th><th>Status</th></tr>
              ${data.terapias.map((t: Terapia) => `
                <tr><td>${t.nome}</td><td>${t.duracao}min</td><td>R$ ${t.preco.toFixed(2)}</td><td>${t.ativa ? 'Ativa' : 'Inativa'}</td></tr>
              `).join('')}
            </table>
          ` : ''}
          
          ${data.agendamentos ? `
            <h2>Agendamentos (${data.agendamentos.length})</h2>
            <table>
              <tr><th>Data</th><th>Hora</th><th>Paciente</th><th>Terapia</th><th>Status</th></tr>
              ${data.agendamentos.map((a: Agendamento) => `
                <tr>
                  <td>${format(new Date(a.data), 'dd/MM/yyyy')}</td>
                  <td>${a.hora}</td>
                  <td>${a.paciente?.nome || 'N/A'}</td>
                  <td>${a.terapia?.nome || 'N/A'}</td>
                  <td>${a.status}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}
        </body>
      </html>
    `

    return new Blob([htmlContent], { type: 'text/html' })
  }, [])

  // Gerar iCal
  const generateICalExport = useCallback(async (data: any, options: ExportOptions): Promise<Blob> => {
    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Agenda Terapeutica//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
`

    if (data.agendamentos) {
      data.agendamentos.forEach((a: Agendamento) => {
        const startDate = new Date(`${a.data}T${a.hora}`)
        const endDate = new Date(startDate.getTime() + (a.terapia?.duracao || 60) * 60000)
        
        icalContent += `BEGIN:VEVENT
UID:${a.id}@agenda-terapeutica.com
DTSTART:${formatICalDateTime(startDate)}
DTEND:${formatICalDateTime(endDate)}
SUMMARY:${a.terapia?.nome || 'Terapia'} - ${a.paciente?.nome || 'Paciente'}
DESCRIPTION:Status: ${a.status}${a.observacoes ? '\\nObservações: ' + a.observacoes : ''}
STATUS:${a.status === 'confirmado' ? 'CONFIRMED' : 'TENTATIVE'}
END:VEVENT
`
      })
    }

    icalContent += 'END:VCALENDAR'

    return new Blob([icalContent], { type: 'text/calendar' })
  }, [])

  // Formatar data para iCal
  const formatICalDateTime = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  // ==================== IMPORT ====================

  // Importar dados
  const importData = useCallback(async (file: File, options: ImportOptions) => {
    setExportImportState(prev => ({ ...prev, isImporting: true, progress: 0 }))

    try {
      const fileContent = await readFile(file)
      setExportImportState(prev => ({ ...prev, progress: 20 }))

      let data: any

      // Processar baseado no formato
      switch (options.format) {
        case 'json':
          data = JSON.parse(fileContent)
          break

        case 'csv':
          data = parseCSV(fileContent)
          break

        default:
          throw new Error(`Formato ${options.format} não suportado para importação`)
      }

      setExportImportState(prev => ({ ...prev, progress: 40 }))

      // Validar dados se solicitado
      if (options.validateData) {
        validateImportData(data)
      }

      setExportImportState(prev => ({ ...prev, progress: 60 }))

      // Processar importação baseado na estratégia
      await processImport(data, options)

      setExportImportState(prev => ({ 
        ...prev, 
        isImporting: false, 
        lastImport: new Date(),
        progress: 0
      }))

      toast({
        title: "Importação concluída",
        description: "Dados importados com sucesso",
      })

    } catch (error) {
      console.error('Erro na importação:', error)
      setExportImportState(prev => ({ ...prev, isImporting: false, progress: 0 }))
      
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      })
    }
  }, [actions])

  // Ler arquivo
  const readFile = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (e) => reject(e)
      reader.readAsText(file)
    })
  }, [])

  // Parse CSV simplificado
  const parseCSV = useCallback((content: string) => {
    // Implementação básica - em produção usar bibliotecas como papaparse
    const lines = content.split('\n')
    const result: any = {}
    
    // Esta é uma implementação simplificada
    // Em produção, implementar parser robusto
    
    return result
  }, [])

  // Validar dados de importação
  const validateImportData = useCallback((data: any) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Dados inválidos: formato incorreto')
    }

    // Validar estrutura
    if (data.pacientes && !Array.isArray(data.pacientes)) {
      throw new Error('Dados inválidos: pacientes deve ser um array')
    }

    if (data.terapias && !Array.isArray(data.terapias)) {
      throw new Error('Dados inválidos: terapias deve ser um array')
    }

    if (data.agendamentos && !Array.isArray(data.agendamentos)) {
      throw new Error('Dados inválidos: agendamentos deve ser um array')
    }

    // Validações mais específicas podem ser adicionadas aqui
  }, [])

  // Processar importação
  const processImport = useCallback(async (data: any, options: ImportOptions) => {
    const stats = { created: 0, updated: 0, skipped: 0 }

    // Importar pacientes
    if (data.pacientes) {
      for (const paciente of data.pacientes) {
        const existing = state.pacientes.find(p => p.id === paciente.id)
        
        if (existing) {
          switch (options.mergeStrategy) {
            case 'skip':
              stats.skipped++
              break
            case 'update':
              await actions.updatePaciente(paciente.id, paciente)
              stats.updated++
              break
            case 'replace':
              await actions.updatePaciente(paciente.id, paciente)
              stats.updated++
              break
          }
        } else {
          await actions.createPaciente(paciente)
          stats.created++
        }
      }
    }

    // Importar terapias
    if (data.terapias) {
      for (const terapia of data.terapias) {
        const existing = state.terapias.find(t => t.id === terapia.id)
        
        if (existing) {
          switch (options.mergeStrategy) {
            case 'skip':
              stats.skipped++
              break
            case 'update':
              await actions.updateTerapia(terapia.id, terapia)
              stats.updated++
              break
            case 'replace':
              await actions.updateTerapia(terapia.id, terapia)
              stats.updated++
              break
          }
        } else {
          await actions.createTerapia(terapia)
          stats.created++
        }
      }
    }

    // Importar agendamentos
    if (data.agendamentos) {
      for (const agendamento of data.agendamentos) {
        const existing = state.agendamentos.find(a => a.id === agendamento.id)
        
        if (existing) {
          switch (options.mergeStrategy) {
            case 'skip':
              stats.skipped++
              break
            case 'update':
              await actions.updateAgendamento(agendamento.id, agendamento)
              stats.updated++
              break
            case 'replace':
              await actions.updateAgendamento(agendamento.id, agendamento)
              stats.updated++
              break
          }
        } else {
          await actions.createAgendamento(agendamento)
          stats.created++
        }
      }
    }

    setExportImportState(prev => ({ ...prev, progress: 100 }))

    toast({
      title: "Importação processada",
      description: `Criados: ${stats.created}, Atualizados: ${stats.updated}, Ignorados: ${stats.skipped}`,
    })
  }, [state.pacientes, state.terapias, state.agendamentos, actions])

  // Fazer download do arquivo
  const downloadFile = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  // Exportações rápidas
  const quickExportJSON = useCallback(() => {
    return exportData({
      format: 'json',
      includePatients: true,
      includeTherapies: true,
      includeAppointments: true,
      compress: false
    })
  }, [exportData])

  const quickExportCSV = useCallback(() => {
    return exportData({
      format: 'csv',
      includePatients: true,
      includeTherapies: true,
      includeAppointments: true
    })
  }, [exportData])

  return {
    exportImportState,
    exportData,
    importData,
    quickExportJSON,
    quickExportCSV
  }
}