// lib/monitoring.ts - Sistema de Monitoramento
import { NextRequest } from 'next/server'

interface MetricData {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp?: number
}

class MonitoringService {
  private static instance: MonitoringService
  private metrics: MetricData[] = []

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  // Registrar métrica
  track(metric: MetricData) {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || Date.now()
    })
    
    // Manter apenas últimas 1000 métricas
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Log crítico
    if (metric.name.includes('error') || metric.value > 1000) {
      console.error('Critical metric:', metric)
    }
  }

  // Rastrear performance de API
  trackApiCall(endpoint: string, duration: number, status: number) {
    this.track({
      name: 'api_call_duration',
      value: duration,
      tags: {
        endpoint,
        status: status.toString(),
        success: status < 400 ? 'true' : 'false'
      }
    })
  }

  // Rastrear erros
  trackError(error: Error, context?: Record<string, any>) {
    this.track({
      name: 'application_error',
      value: 1,
      tags: {
        error_type: error.constructor.name,
        message: error.message,
        stack: error.stack?.substring(0, 500),
        ...context
      }
    })
  }

  // Rastrear uso de recursos
  trackResourceUsage(resource: string, usage: number) {
    this.track({
      name: 'resource_usage',
      value: usage,
      tags: { resource }
    })
  }

  // Obter métricas
  getMetrics(filter?: string): MetricData[] {
    if (!filter) return this.metrics
    return this.metrics.filter(m => m.name.includes(filter))
  }

  // Resumo de performance
  getPerformanceSummary() {
    const apiCalls = this.metrics.filter(m => m.name === 'api_call_duration')
    const errors = this.metrics.filter(m => m.name === 'application_error')
    
    return {
      totalApiCalls: apiCalls.length,
      averageResponseTime: apiCalls.reduce((acc, m) => acc + m.value, 0) / apiCalls.length || 0,
      errorRate: errors.length / apiCalls.length || 0,
      totalErrors: errors.length,
      uptime: process.uptime()
    }
  }
}

export const monitoring = MonitoringService.getInstance()

// Middleware de monitoramento
export function withMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  name: string
) {
  return async (...args: T): Promise<R> => {
    const start = Date.now()
    try {
      const result = await fn(...args)
      monitoring.track({
        name: `${name}_success`,
        value: Date.now() - start
      })
      return result
    } catch (error) {
      monitoring.trackError(error as Error, { function: name })
      monitoring.track({
        name: `${name}_error`,
        value: Date.now() - start
      })
      throw error
    }
  }
}