'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: any }>
  signUp: (email: string, password: string, userData?: any) => Promise<{ error?: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: any }>
}

interface AuthProviderProps {
  children: React.ReactNode
}

// Criar o contexto
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Verificar sessão inicial
    const getInitialSession = async () => {
      try {
        // Primeiro verifica localStorage para teste
        const localUser = localStorage.getItem('user')
        if (localUser) {
          const userData = JSON.parse(localUser)
          // Converter para formato User do Supabase
          const mockUser = {
            id: userData.id,
            email: userData.email,
            user_metadata: { name: userData.name, role: userData.role }
          } as User
          setUser(mockUser)
          setLoading(false)
          return
        }

        // Se não há usuário local, tenta Supabase
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Erro ao obter sessão:', error)
        } else {
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Erro ao verificar sessão inicial:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escutar mudanças de autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        setUser(session?.user ?? null)
        setLoading(false)

        if (event === 'SIGNED_IN') {
          router.push('/dashboard')
        } else if (event === 'SIGNED_OUT') {
          router.push('/auth/login')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  // Função de login com fallback para teste
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)

      // Credenciais de teste
      const testCredentials = [
        { email: 'admin@lunara.com', password: 'admin123', name: 'Admin', role: 'admin' },
        { email: 'joao@email.com', password: '123456', name: 'João Silva', role: 'affiliate' }
      ]

      const testCredential = testCredentials.find(
        cred => cred.email === email && cred.password === password
      )

      // Se é credencial de teste, usa localStorage
      if (testCredential) {
        const userData = {
          id: Math.random().toString(36).substr(2, 9),
          email: testCredential.email,
          name: testCredential.name,
          role: testCredential.role
        }

        localStorage.setItem('user', JSON.stringify(userData))
        
        // Converter para formato User do Supabase
        const mockUser = {
          id: userData.id,
          email: userData.email,
          user_metadata: { name: userData.name, role: userData.role }
        } as User

        setUser(mockUser)
        setLoading(false)
        
        // Redirecionar manualmente para teste
        setTimeout(() => {
          router.push('/dashboard')
        }, 100)
        
        return { error: null }
      }

      // Se não é credencial de teste, tenta Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Erro no login:', error)
        return { error }
      }

      console.log('Login realizado com sucesso:', data.user?.email)
      return { error: null }
      
    } catch (error) {
      console.error('Erro inesperado no login:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // Função de registro
  const signUp = async (email: string, password: string, userData?: any) => {
    try {
      setLoading(true)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      })

      if (error) {
        console.error('Erro no registro:', error)
        return { error }
      }

      console.log('Registro realizado com sucesso:', data.user?.email)
      return { error: null }
      
    } catch (error) {
      console.error('Erro inesperado no registro:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // Função de logout
  const signOut = async () => {
    try {
      setLoading(true)

      // Limpar localStorage primeiro
      localStorage.removeItem('user')
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Erro no logout:', error)
        // Mesmo com erro do Supabase, limpa o state local
      }

      setUser(null)
      console.log('Logout realizado com sucesso')
      router.push('/auth/login')
      
    } catch (error) {
      console.error('Erro inesperado no logout:', error)
      // Limpa mesmo com erro
      setUser(null)
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  // Função de reset de senha
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        console.error('Erro ao enviar reset de senha:', error)
        return { error }
      }

      console.log('Email de reset enviado para:', email)
      return { error: null }
      
    } catch (error) {
      console.error('Erro inesperado no reset de senha:', error)
      return { error }
    }
  }

  const value: AuthContextType = {
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

// Hook useAuth
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}