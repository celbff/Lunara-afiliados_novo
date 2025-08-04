// middleware.ts - Sistema de Proteção de Rotas
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { pathname } = req.nextUrl

    // Rotas protegidas que requerem autenticação
    const protectedRoutes = [
      '/dashboard',
      '/agenda',
      '/affiliates', 
      '/therapists',
      '/reports',
      '/settings',
      '/admin'
    ]

    // Rotas públicas (apenas auth e landing)
    const publicRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/'
    ]

    // Rotas de API que devem ser ignoradas pelo middleware
    const apiRoutes = [
      '/api/auth',
      '/api/webhook'
    ]

    // Verificar se é rota de API que deve ser ignorada
    const isApiRoute = apiRoutes.some(route => pathname.startsWith(route))
    if (isApiRoute) {
      return res
    }

    // Verificar se é rota protegida
    const isProtectedRoute = protectedRoutes.some(route => 
      pathname.startsWith(route)
    )

    // Verificar se é rota de auth
    const isAuthRoute = pathname.startsWith('/auth')

    // Verificar se é rota pública
    const isPublicRoute = publicRoutes.some(route => 
      route === pathname || (route === '/' && pathname === '/')
    )

    // 🔒 Redirecionar usuários não logados de rotas protegidas
    if (isProtectedRoute && !session) {
      const redirectUrl = new URL('/auth/login', req.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // 🏠 Redirecionar usuários logados da página inicial para dashboard
    if (pathname === '/' && session) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // 🚫 Redirecionar usuários logados das páginas de auth para dashboard
    if (isAuthRoute && session) {
      const redirectTo = req.nextUrl.searchParams.get('redirectTo')
      const targetUrl = redirectTo && redirectTo.startsWith('/') 
        ? redirectTo 
        : '/dashboard'
      return NextResponse.redirect(new URL(targetUrl, req.url))
    }

    // 🔐 Verificar permissões de admin para rotas administrativas
    if (pathname.startsWith('/admin') && session) {
      // Buscar dados do usuário para verificar role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    // ✅ Adicionar headers com informações do usuário autenticado
    if (session) {
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-user-id', session.user.id)
      requestHeaders.set('x-user-email', session.user.email || '')
      
      // Buscar role do usuário se for rota protegida
      if (isProtectedRoute) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (profile?.role) {
          requestHeaders.set('x-user-role', profile.role)
        }
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        }
      })
    }

    // ✅ Permitir acesso às rotas públicas
    return res

  } catch (error) {
    console.error('Middleware error:', error)
    
    // Em caso de erro, redirecionar para login se for rota protegida
    const isProtectedRoute = protectedRoutes.some(route => 
      req.nextUrl.pathname.startsWith(route)
    )
    
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
    
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}