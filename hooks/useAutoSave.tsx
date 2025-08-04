```typescript
// hooks/useAutoSave.tsx - Hook para Auto-save Inteligente
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAgenda } from '@/hooks/useAgenda'
import { toast } from '@/hooks/use-toast'
import { debounce } from 'lodash'

interface AutoSaveConfig {
  enabled: boolean
  interval: number // ms
  debounceDelay: number // ms
  maxRetries: number
  backupOnSave: boolean
}

interface AutoSaveState {
  isEnabled: boolean
  lastSaved: Date | null
  isSaving: boolean
  hasUnsavedChanges: boolean
  saveCount: number
  errorCount: number
}

const DEFAULT_CONFIG: AutoSaveConfig = {
  enabled: true,
  interval: 30000, // 30 segundos
  debounceDelay: 2000, // 2 segundos após última mudança
  maxRetries: 3,
  backupOnSave: true
}

export function useAutoSave(config: Partial<AutoSaveConfig> = {}) {
  const { state, actions } = useAgenda()
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    isEnabled: finalConfig.enabled,
    lastSaved: null,
    isSaving: false,
    hasUnsavedChanges: false,
    saveCount: 0,
    errorCount: 0
  })

  const intervalRef = useRef<NodeJS.Timeout>()
  const retryCountRef = useRef(0)
  const previousStateRef = useRef<string>('')
  const saveInProgressRef = useRef(false)

  // Detectar mudanças no estado
  const detectChanges = useCallback(() => {
    const currentState = JSON.stringify({
      pacientes: state.pacientes,
      terapias: state.terapias,
      agendamentos: state.agendamentos
    })

    const hasChanges = currentState !== previousStateRef.current && 
                      previousStateRef.current !== '' // Ignora primeira execução

    if (hasChanges && !saveInProgressRef.current) {
      setAutoSaveState(prev => ({ ...prev, hasUnsavedChanges: true }))
    }

    return hasChanges
  }, [state.pacientes, state.terapias, state.agendamentos])

  // Executar save
  const performSave = useCallback(async () => {
    if (saveInProgressRef.current || !autoSaveState.hasUnsavedChanges) {
      return false
    }

    saveInProgressRef.current = true
    setAutoSaveState(prev => ({ ...prev, isSaving: true }))

    try {
      // Criar backup se configurado
      if (finalConfig.backupOnSave) {
        await createBackup()
      }

      // Salvar dados (aqui você implementaria a lógica específica de save)
      await saveToStorage()

      // Atualizar estado de sucesso
      previousStateRef.current = JSON.stringify({
        pacientes: state.pacientes,
        terapias: state.terapias,
        agendamentos: state.agendamentos
      })

      setAutoSaveState(prev => ({
        ...prev,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
        isSaving: false,
        saveCount: prev.saveCount + 1,
        errorCount: 0
      }))

      retryCountRef.current = 0
      return true

    } catch (error) {
      console.error('Erro no auto-save:', error)
      
      retryCountRef.current++
      setAutoSaveState(prev => ({
        ...prev,
        isSaving: false,
        errorCount: prev.errorCount + 1
      }))

      // Tentar novamente se não excedeu limite
      if (retryCountRef.current < finalConfig.maxRetries) {
        setTimeout(() => performSave(), 5000) // Retry em 5s
        
        toast({
          title: "Erro no auto-save",
          description: `Tentativa ${retryCountRef.current}/${finalConfig.maxRetries} falhou. Tentando novamente...`,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Auto-save desabilitado",
          description: "Muitas falhas consecutivas. Salve manualmente.",
          variant: "destructive"
        })
        
        setAutoSaveState(prev => ({ ...prev, isEnabled: false }))
      }

      return false
    } finally {
      saveInProgressRef.current = false
    }
  }, [state.pacientes, state.terapias, state.agendamentos, autoSaveState.hasUnsavedChanges, finalConfig.backupOnSave, finalConfig.maxRetries])

  // Salvar para localStorage/IndexedDB
  const saveToStorage = useCallback(async () => {
    const data = {
      pacientes: state.pacientes,
      terapias: state.terapias,
      agendamentos: state.agendamentos,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }

    // Usar IndexedDB para dados maiores
    if (JSON.stringify(data).length > 1000000) { // > 1MB
      return saveToIndexedDB(data)
    } else {
      localStorage.setItem('agenda_autosave', JSON.stringify(data))
    }
  }, [state.pacientes, state.terapias, state.agendamentos])

  // Salvar no IndexedDB
  const saveToIndexedDB = useCallback(async (data: any) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AgendaDB', 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['autosave'], 'readwrite')
        const store = transaction.objectStore('autosave')
        
        store.put({ id: 'current', data, timestamp: new Date() })
        
        transaction.oncomplete = () => resolve(true)
        transaction.onerror = () => reject(transaction.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('autosave')) {
          db.createObjectStore('autosave', { keyPath: 'id' })
        }
      }
    })
  }, [])

  // Criar backup
  const createBackup = useCallback(async () => {
    const backupData = {
      pacientes: state.pacientes,
      terapias: state.terapias,
      agendamentos: state.agendamentos,
      timestamp: new Date().toISOString(),
      type: 'auto-backup'
    }

    const backups = JSON.parse(localStorage.getItem('agenda_backups') || '[]')
    backups.push(backupData)
    
    // Manter apenas últimos 10 backups
    if (backups.length > 10) {
      backups.splice(0, backups.length - 10)
    }
    
    localStorage.setItem('agenda_backups', JSON.stringify(backups))
  }, [state.pacientes, state.terapias, state.agendamentos])

  // Save com debounce
  const debouncedSave = useCallback(
    debounce(performSave, finalConfig.debounceDelay),
    [performSave, finalConfig.debounceDelay]
  )

  // Salvar manualmente
  const forceSave = useCallback(async () => {
    debouncedSave.cancel() // Cancelar debounce pendente
    return await performSave()
  }, [performSave, debouncedSave])

  // Toggle auto-save
  const toggleAutoSave = useCallback((enabled: boolean) => {
    setAutoSaveState(prev => ({ ...prev, isEnabled: enabled }))
    
    if (enabled) {
      retryCountRef.current = 0
    }
  }, [])

  // Carregar dados salvos
  const loadSavedData = useCallback(async () => {
    try {
      // Tentar localStorage primeiro
      const localData = localStorage.getItem('agenda_autosave')
      if (localData) {
        const parsed = JSON.parse(localData)
        return parsed
      }

      // Tentar IndexedDB
      return await loadFromIndexedDB()
    } catch (error) {
      console.error('Erro ao carregar dados salvos:', error)
      return null
    }
  }, [])

  // Carregar do IndexedDB
  const loadFromIndexedDB = useCallback(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AgendaDB', 1)
      
      request.onerror = () => resolve(null)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['autosave'], 'readonly')
        const store = transaction.objectStore('autosave')
        const getRequest = store.get('current')
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result?.data || null)
        }
        
        getRequest.onerror = () => resolve(null)
      }
    })
  }, [])

  // Verificar integridade dos dados
  const validateData = useCallback((data: any) => {
    try {
      return (
        data &&
        Array.isArray(data.pacientes) &&
        Array.isArray(data.terapias) &&
        Array.isArray(data.agendamentos) &&
        data.timestamp &&
        data.version
      )
    } catch {
      return false
    }
  }, [])

  // Effect para detectar mudanças
  useEffect(() => {
    if (autoSaveState.isEnabled) {
      const hasChanges = detectChanges()
      if (hasChanges) {
        debouncedSave()
      }
    }
  }, [state.pacientes, state.terapias, state.agendamentos, autoSaveState.isEnabled, detectChanges, debouncedSave])

  // Effect para auto-save por intervalo
  useEffect(() => {
    if (autoSaveState.isEnabled && finalConfig.interval > 0) {
      intervalRef.current = setInterval(() => {
        if (autoSaveState.hasUnsavedChanges) {
          performSave()
        }
      }, finalConfig.interval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [autoSaveState.isEnabled, autoSaveState.hasUnsavedChanges, finalConfig.interval, performSave])

  // Cleanup
  useEffect(() => {
    return () => {
      debouncedSave.cancel()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [debouncedSave])

  // Inicialização - carregar dados salvos
  useEffect(() => {
    const initializeAutoSave = async () => {
      const savedData = await loadSavedData()
      if (savedData && validateData(savedData)) {
        // Opcionalmente restaurar dados automaticamente
        // ou perguntar ao usuário se quer restaurar
        toast({
          title: "Dados salvos encontrados",
          description: "Dados de sessão anterior disponíveis para restauração.",
        })
      }
      
      // Definir estado inicial
      previousStateRef.current = JSON.stringify({
        pacientes: state.pacientes,
        terapias: state.terapias,
        agendamentos: state.agendamentos
      })
    }

    initializeAutoSave()
  }, []) // Executar apenas uma vez

  return {
    autoSaveState,
    forceSave,
    toggleAutoSave,
    loadSavedData,
    validateData,
    config: finalConfig
  }
}
```
