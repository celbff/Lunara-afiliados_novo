// lib/cache.ts - Sistema de Cache
import { unstable_cache } from 'next/cache'
import { Redis } from '@upstash/redis'

// Redis para cache distribuído (opcional)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export class CacheManager {
  // Cache em memória local
  private static memoryCache = new Map<string, { data: any; expiry: number }>()

  // Limpar cache expirado
  private static cleanExpired() {
    const now = Date.now()
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiry < now) {
        this.memoryCache.delete(key)
      }
    }
  }

  // Get com fallback
  static async get<T>(key: string, fallback?: () => Promise<T>): Promise<T | null> {
    this.cleanExpired()
    
    // Tentar cache local primeiro
    const cached = this.memoryCache.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.data
    }

    try {
      // Tentar Redis
      const redisData = await redis.get(key)
      if (redisData) {
        return redisData as T
      }
    } catch (error) {
      console.warn('Redis cache miss:', error)
    }

    // Usar fallback
    if (fallback) {
      const data = await fallback()
      await this.set(key, data, 5 * 60 * 1000) // 5 minutos
      return data
    }

    return null
  }

  // Set em ambos os caches
  static async set(key: string, value: any, ttlMs: number = 10 * 60 * 1000) {
    const expiry = Date.now() + ttlMs
    
    // Cache local
    this.memoryCache.set(key, { data: value, expiry })

    try {
      // Cache distribuído
      await redis.setex(key, Math.floor(ttlMs / 1000), JSON.stringify(value))
    } catch (error) {
      console.warn('Redis cache set failed:', error)
    }
  }

  // Invalidar cache
  static async invalidate(pattern: string) {
    // Limpar cache local
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key)
      }
    }

    try {
      // Limpar Redis
      const keys = await redis.keys(`*${pattern}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.warn('Redis cache invalidation failed:', error)
    }
  }
}

// Hook para cache com React Query
export function useCachedQuery<T>(
  key: string | string[],
  fetcher: () => Promise<T>,
  options?: {
    staleTime?: number
    cacheTime?: number
    retry?: number
  }
) {
  const cacheKey = Array.isArray(key) ? key.join(':') : key
  
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => CacheManager.get(cacheKey, fetcher),
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    cacheTime: options?.cacheTime ?? 10 * 60 * 1000,
    retry: options?.retry ?? 3,
  })
}