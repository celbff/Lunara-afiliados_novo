import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { jwtVerify } from 'jose';

// Tipos de usuário
export type UserRole = 'admin' | 'therapist' | 'affiliate' | 'client';

interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
}

// Configurações de rotas
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/auth/callback',
  '/api/health',
  '/api/webhooks',
  '/',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
];

const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/appointments',
  '/commissions',
];

const ADMIN_ROUTES = [
  '/admin',
  '/dashboard/admin',
  '/users',
  '/api/admin',
];

const API_ROUTES = [
  '/api/users',
  '/api/appointments',
  '/api/therapists',
  '/api/affiliates',
  '/api/services',
  '/api/commissions',
];

// Rate limiting - mapa simples para demonstração
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Função para verificar rate limiting
function checkRateLimit(ip: string, limit: number = 100, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

// Função para verificar se é rota pública
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/') return pathname === '/';
    return pathname.startsWith(route);
  });
}

// Função para verificar se é rota de admin
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route));
}

// Função para verificar se é rota de API
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

// Função para extrair token JWT
function extractToken(request: NextRequest): string | null {
  // Primeiro tenta do header Authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Depois tenta do cookie
  const tokenCookie = request.cookies.get('access-token');
  if (tokenCookie?.value) {
    return tokenCookie.value;
  }
  
  return null;
}

// Função para verificar JWT
async function verifyJWT(token: string): Promise<User | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    const { payload } = await jwtVerify(token, secret);
    
    return {
      id: payload.userId as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      is_active: payload.is_active as boolean,
      email_verified: payload.email_verified as boolean,
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// Função para criar resposta de erro
function createErrorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    { success: false, message, timestamp: new Date().toISOString() },
    { status }
  );
}

// Função para aplicar headers de segurança
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Remover headers que expõem informações
  response.headers.delete('x-powered-by');
  response.headers.delete('server');
  
  // Headers de segurança
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Apenas em produção
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  return response;
}

// Middleware principal
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  console.log(`[Middleware] ${request.method} ${pathname} from ${ip}`);
  
  // Rate limiting para APIs
  if (isApiRoute(pathname)) {
    const limit = pathname.includes('/auth/') ? 5 : 100; // Limite menor para auth
    if (!checkRateLimit(ip, limit)) {
      console.warn(`[Rate Limit] IP ${ip} exceeded limit for ${pathname}`);
      return createErrorResponse('Too many requests', 429);
    }
  }
  
  // Permitir rotas públicas sem autenticação
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }
  
  try {
    // Verificar autenticação com Supabase
    const supabase = createMiddlewareClient({ req: request, res: NextResponse.next() });
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    let user: User | null = null;
    
    if (session?.user) {
      // Usuário autenticado via Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, role, is_active, email_verified')
        .eq('id', session.user.id)
        .single();
      
      if (!userError && userData) {
        user = userData as User;
      }
    } else {
      // Fallback: tentar JWT token
      const token = extractToken(request);
      if (token) {
        user = await verifyJWT(token);
      }
    }
    
    // Se não há usuário autenticado, redirecionar para login
    if (!user) {
      console.log(`[Auth] No user found for ${pathname}, redirecting to login`);
      
      if (isApiRoute(pathname)) {
        return createErrorResponse('Authentication required', 401);
      }
      
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Verificar se o usuário está ativo
    if (!user.is_active) {
      console.warn(`[Auth] Inactive user ${user.email} attempted to access ${pathname}`);
      
      if (isApiRoute(pathname)) {
        return createErrorResponse('Account is inactive', 403);
      }
      
      return NextResponse.redirect(new URL('/auth/inactive', request.url));
    }
    
    // Verificar se o email foi verificado para rotas sensíveis
    if (!user.email_verified && (isAdminRoute(pathname) || pathname.includes('/settings'))) {
      console.warn(`[Auth] Unverified user ${user.email} attempted to access ${pathname}`);
      
      if (isApiRoute(pathname)) {
        return createErrorResponse('Email verification required', 403);
      }
      
      return NextResponse.redirect(new URL('/auth/verify-email', request.url));
    }
    
    // Verificar permissões de admin
    if (isAdminRoute(pathname) && user.role !== 'admin') {
      console.warn(`[Auth] Non-admin user ${user.email} attempted to access ${pathname}`);
      
      if (isApiRoute(pathname)) {
        return createErrorResponse('Insufficient permissions', 403);
      }
      
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Verificar permissões específicas para APIs
    if (isApiRoute(pathname)) {
      const isAuthorized = await checkApiPermissions(pathname, user);
      if (!isAuthorized) {
        console.warn(`[Auth] User ${user.email} unauthorized for API ${pathname}`);
        return createErrorResponse('Insufficient permissions for this resource', 403);
      }
    }
    
    // Adicionar informações do usuário aos headers para as páginas
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-email', user.email);
    response.headers.set('x-user-role', user.role);
    
    console.log(`[Auth] User ${user.email} (${user.role}) authorized for ${pathname}`);
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('[Middleware] Unexpected error:', error);
    
    if (isApiRoute(pathname)) {
      return createErrorResponse('Authentication service unavailable', 503);
    }
    
    // Em caso de erro, redirecionar para login
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

// Função para verificar permissões específicas da API
async function checkApiPermissions