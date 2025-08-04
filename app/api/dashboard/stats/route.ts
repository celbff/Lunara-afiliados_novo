// app/api/dashboard/stats/route.ts - API com Cache
import { NextRequest, NextResponse } from 'next/server'
import { CacheManager } from '@/lib/cache'
import { getUserFromRequest } from '@/lib/auth'
import { getDashboardStats } from '@/lib/dashboard'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    // Autenticação
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Cache key baseado no usuário
    const cacheKey = `dashboard:stats:${user.id}`
    
    // Buscar dados com cache
    const stats = await CacheManager.get(cacheKey, async () => {
      return await getDashboardStats(user.id)
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}