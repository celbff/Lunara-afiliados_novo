// components/Auth.tsx
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gzyrbtrinccwqyeocymh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXJidHJpbmNjd3F5ZW9jeW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjgyOTIsImV4cCI6MjA3MTIwNDI5Mn0.rJ_C6t3lE3efsD_kQUoGvViCJodHc9NNGQukX-SPEMM'
);

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Cadastro realizado! Verifique seu e-mail para confirmar.');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '400px',
      margin: '4rem auto',
      padding: '2rem',
      background: 'white',
      borderRadius: '15px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>
      <h2 style={{ color: '#004a6c', marginBottom: '1.5rem' }}>
        {isLogin ? 'Entrar' : 'Criar Conta'}
      </h2>
      
      {error && (
        <div style={{
          color: '#c62828',
          background: '#ffebee',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleAuth}>
        <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: '#004a6c',
            fontSize: '0.9rem'
          }}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid rgba(0,74,108,0.3)',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            color: '#004a6c',
            fontSize: '0.9rem'
          }}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid rgba(0,74,108,0.3)',
              borderRadius: '6px',
              fontSize: '1rem'
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: '#004a6c',
            color: 'white',
            border: 'none',
            padding: '0.75rem',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
        </button>
      </form>

      <div style={{ marginTop: '1rem' }}>
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            background: 'none',
            border: 'none',
            color: '#004a6c',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  );
}