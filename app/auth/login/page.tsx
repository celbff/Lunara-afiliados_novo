'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Eye, EyeOff, Mail, Lock, Calendar } from 'lucide-react'
import lunaraLogo from '@/public/images/logo_contorno.png'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn, signOut, user } = useAuth()

  useEffect(() => {
    if (user) {
      // Usuário já está logado, redirecionar para dashboard
      console.log('Usuário logado:', user)
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn(email, password)
      if (!result.success) {
        setError(result.error || 'Erro inesperado. Tente novamente.')
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const containerStyle = { 
    minHeight: '100vh', 
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 25%, #1e40af 50%, #1e3a8a 75%, #1e3a8a 100%)', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '32px 16px', 
    fontFamily: 'system-ui, -apple-system, sans-serif' 
  }

  const headerStyle = { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    color: 'white', 
    marginBottom: '32px', 
    textAlign: 'center' 
  }

  const iconStyle = { marginBottom: '16px' }

  const titleStyle = { 
    fontSize: '36px', 
    fontWeight: 'bold', 
    marginBottom: '8px', 
    color: 'white', 
    margin: '0 0 8px 0' 
  }

  const subtitleStyle = { 
    fontSize: '18px', 
    color: 'rgba(255, 255, 255, 0.8)', 
    margin: '0' 
  }

  const cardStyle = { 
    backgroundColor: 'white', 
    borderRadius: '24px', 
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
    padding: '32px', 
    width: '100%', 
    maxWidth: '400px', 
    margin: '0 auto' 
  }

  const cardHeaderStyle = { textAlign: 'center', marginBottom: '32px' }

  const cardTitleStyle = { 
    fontSize: '24px', 
    fontWeight: 'bold', 
    color: '#1f2937', 
    marginBottom: '8px', 
    margin: '0 0 8px 0' 
  }

  const cardSubtitleStyle = { color: '#6b7280', margin: '0' }

  const formStyle = { display: 'flex', flexDirection: 'column', gap: '24px' }

  const fieldStyle = { display: 'flex', flexDirection: 'column' }

  const labelStyle = { 
    fontSize: '14px', 
    fontWeight: '600', 
    color: '#374151', 
    marginBottom: '12px' 
  }

  const inputContainerStyle = { position: 'relative' }

  const inputStyle = { 
    width: '100%', 
    paddingLeft: '48px', 
    paddingRight: '16px', 
    paddingTop: '16px', 
    paddingBottom: '16px', 
    border: '1px solid #d1d5db', 
    borderRadius: '12px', 
    fontSize: '16px', 
    color: '#1f2937', 
    outline: 'none', 
    transition: 'all 0.2s', 
    boxSizing: 'border-box' 
  }

  const inputIconStyle = { 
    position: 'absolute', 
    left: '16px', 
    top: '50%', 
    transform: 'translateY(-50%)', 
    color: '#9ca3af', 
    pointerEvents: 'none' 
  }

  const passwordToggleStyle = { 
    position: 'absolute', 
    right: '16px', 
    top: '50%', 
    transform: 'translateY(-50%)', 
    background: 'none', 
    border: 'none', 
    cursor: 'pointer', 
    color: '#9ca3af' 
  }

  const buttonStyle = { 
    width: '100%', 
    backgroundColor: '#2563eb', 
    color: 'white', 
    fontWeight: '600', 
    padding: '16px 24px', 
    borderRadius: '12px', 
    border: 'none', 
    cursor: 'pointer', 
    fontSize: '16px', 
    transition: 'all 0.2s', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center' 
  }

  const footerStyle = { 
    textAlign: 'center', 
    marginTop: '32px', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center' 
  }

  const logoContainerStyle = { marginBottom: '16px' }

  const copyrightStyle = { 
    color: 'rgba(255, 255, 255, 0.8)', 
    fontSize: '14px', 
    margin: '0' 
  }

  const errorStyle = { 
    marginBottom: '24px', 
    padding: '16px', 
    backgroundColor: '#fef2f2', 
    border: '1px solid #fecaca', 
    borderRadius: '12px', 
    color: '#dc2626', 
    fontSize: '14px', 
    fontWeight: '500' 
  }

  const testCredentialsStyle = { 
    backgroundColor: '#f3f4f6', 
    borderRadius: '12px', 
    padding: '16px', 
    marginTop: '24px', 
    textAlign: 'left', 
    fontSize: '14px', 
    color: '#4b5563' 
  }

  const testCredentialItemStyle = { marginBottom: '8px' }

  if (user) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Bem-vindo, {user.name}!</h2>
            <p style={cardSubtitleStyle}>Você está logado como {user.role === 'admin' ? 'Administrador' : 'Afiliado'}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p>Login realizado com sucesso!</p>
            <p>Email: {user.email}</p>
            <button
              onClick={signOut}
              style={{
                ...buttonStyle,
                backgroundColor: '#dc2626',
                marginTop: '20px'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#b91c1c'
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#dc2626'
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Cabeçalho com ícone e títulos */}
      <div style={headerStyle}>
        <div style={iconStyle}>
          <Calendar size={64} color="white" />
        </div>
        <h1 style={titleStyle}>Lunara Afiliados</h1>
        <p style={subtitleStyle}>Agenda 2.0 - Sistema de Gestão</p>
      </div>

      {/* Card branco com formulário */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <h2 style={cardTitleStyle}>Bem-vindo de volta!</h2>
          <p style={cardSubtitleStyle}>Faça login para acessar sua agenda</p>
        </div>

        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <div style={inputContainerStyle}>
              <div style={inputIconStyle}>
                <Mail size={20} />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="seu@email.com"
                disabled={isLoading}
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label htmlFor="password" style={labelStyle}>Senha</label>
            <div style={inputContainerStyle}>
              <div style={inputIconStyle}>
                <Lock size={20} />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{...inputStyle, paddingRight: '56px'}}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={passwordToggleStyle}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...buttonStyle,
              backgroundColor: isLoading ? '#93c5fd' : '#2563eb',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
            onMouseOver={(e) => {
              if (!isLoading) e.target.style.backgroundColor = '#1d4ed8'
            }}
            onMouseOut={(e) => {
              if (!isLoading) e.target.style.backgroundColor = '#2563eb'
            }}
          >
            {isLoading ? (
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid white',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Credenciais de teste */}
        <div style={testCredentialsStyle}>
          <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Em fase de teste:</p>
          </div>
      </div>

      {/* Rodapé com logo e copyright */}
      <div style={footerStyle}>
        <div style={logoContainerStyle}>
          <img
            src={lunaraLogo}
            alt="Logo Lunara"
            width={60}
            height={60}
            style={{opacity: 0.8}}
          />
        </div>
        <p style={copyrightStyle}>© 2024 Lunara Afiliados. Todos os direitos reservados.</p>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
