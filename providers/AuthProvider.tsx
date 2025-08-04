// providers/AuthProvider.tsx - Contexto de Autenticação Completo
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Verificar sessão inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Erro ao obter sessão:', error)
          toast({
            title: "Erro de Autenticação",
            description: "Não foi possível verificar sua sessão.",
            variant: "destructive",
          })
        } else {
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Erro inesperado:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        setUser(session?.user ?? null)
        setLoading(false)

        // Handle auth events
        switch (event) {
          case 'SIGNED_IN':
            toast({
              title: "Login realizado com sucesso!",
              description: `Bem-vindo, ${session?.user?.user_metadata?.full_name || session?.user?.email}!`,
            })
            break
          case 'SIGNED_OUT':
            router.push('/auth/login')
            toast({
              title: "Logout realizado",
              description: "Você foi desconectado com sucesso.",
            })
            break
          case 'PASSWORD_RECOVERY':
            toast({
              title: "Email de recuperação enviado",
              description: "Verifique sua caixa de entrada.",
            })
            break
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.user) {
        // Redirecionar após login bem-sucedido será feito pelo middleware
        return
      }
    } catch (error: any) {
      console.error('Erro no login:', error)
      
      let errorMessage = "Erro inesperado ao fazer login."
      
      switch (error.message) {
        case 'Invalid login credentials':
          errorMessage = "Email ou senha incorretos."
          break
        case 'Email not confirmed':
          errorMessage = "Email não confirmado. Verifique sua caixa de entrada."
          break
        case 'Too many requests':
          errorMessage = "Muitas tentativas. Tente novamente em alguns minutos."
          break
        default:
          errorMessage = error.message || errorMessage
      }

      toast({
        title: "Erro no Login",
        description: errorMessage,
        variant: "destructive",
      })
      
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      })

      if (error) {
        throw error
      }

      if (data.user) {
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email para confirmar a conta.",
        })
        
        // Redirecionar para login após cadastro
        router.push('/auth/login?message=verify-email')
      }
    } catch (error: any) {
      console.error('Erro no cadastro:', error)
      
      let errorMessage = "Erro inesperado ao criar conta."
      
      switch (error.message) {
        case 'User already registered':
          errorMessage = "Este email já está cadastrado."
          break
        case 'Password should be at least 6 characters':
          errorMessage = "A senha deve ter pelo menos 6 caracteres."
          break
        case 'Unable to validate email address: invalid format':
          errorMessage = "Formato de email inválido."
          break
        default:
          errorMessage = error.message || errorMessage
      }

      toast({
        title: "Erro no Cadastro",
        description: errorMessage,
        variant: "destructive",
      })
      
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }
      
      setUser(null)
      // O redirecionamento será feito pelo onAuthStateChange
    } catch (error: any) {
      console.error('Erro no logout:', error)
      
      toast({
        title: "Erro no Logout",
        description: "Não foi possível fazer logout.",
        variant: "destructive",
      })
      
      throw error
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setLoading(true)
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        throw error
      }

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      })
    } catch (error: any) {
      console.error('Erro ao enviar email de recuperação:', error)
      
      let errorMessage = "Erro ao enviar email de recuperação."
      
      if (error.message.includes('Unable to validate email address')) {
        errorMessage = "Email inválido."
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      })
      
      throw error
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}