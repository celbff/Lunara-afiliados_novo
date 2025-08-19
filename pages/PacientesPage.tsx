// pages/PacientesPage.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = 'https://gzyrbtrinccwqyeocymh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXJidHJpbmNjd3F5ZW9jeW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjgyOTIsImV4cCI6MjA3MTIwNDI5Mn0.rJ_C6t3lE3efsD_kQUoGvViCJodHc9NNGQukX-SPEMM';
const supabase = createClient(supabaseUrl, supabaseKey);

const PacientesPage = () => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Pacientes mockados (em produção, viriam do Supabase)
  const pacientesMock = [
    { id: 1, nome: 'Ana Silva', email: 'ana@paciente.com', ultimaSessao: '23/10/2023', status: 'Ativo' },
    { id: 2, nome: 'Carlos Souza', email: 'carlos@paciente.com', ultimaSessao: '22/10/2023', status: 'Ativo' },
    { id: 3, nome: 'Joana Almeida', email: 'joana@paciente.com', ultimaSessao: '20/10/2023', status: 'Inativo' }
  ];

  // Verifica sessão ao carregar
  useEffect(() => {
    supabase.auth.getSession().then(({  { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        loadPacientes(session.user);
      }
    });

    const {  authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          loadPacientes(newSession.user);
        } else {
          setSession(null);
          setUser(null);
          setPacientes([]);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Carregar pacientes do afiliado
  const loadPacientes = async (user: any) => {
    try {
      // Em produção: substitua por consulta ao Supabase
      // const { data, error } = await supabase
      //   .from('pacientes')
      //   .select('*')
      //   .eq('afiliado_id', user.id);
      // if (error) throw error;
      // setPacientes(data);

      // Por enquanto, usa dados mockados
      setPacientes(pacientesMock);
    } catch (error: any) {
      showToast('Erro ao carregar pacientes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  // Tela de login (se não estiver logado)
  if (!session) {
    return (
      <div style={{ backgroundColor: '#e6f7f0', minHeight: '100vh', padding: '2rem' }}>
        <Head>
          <title>Login - Lunara Afiliados</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#004a6c" />
        </Head>

        <div style={{
          maxWidth: '400px',
          margin: '4rem auto',
          padding: '2rem',
          background: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <img src="/imagens/logo.webp" alt="Logo Lunara" style={{ height: '50px' }} />
          </div>
          <h2 style={{ color: '#004a6c', marginBottom: '1.5rem' }}>Acesso ao Painel</h2>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const email = (e.target as any).email.value;
            const password = (e.target as any).password.value;
            
            try {
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw error;
            } catch (error: any) {
              alert('Erro: ' + error.message);
            }
          }}>
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#004a6c',
                fontSize: '0.9rem'
              }}>E-mail</label>
              <input
                name="email"
                type="email"
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
                name="password"
                type="password"
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
              style={{
                width: '100%',
                background: '#004a6c',
                color: 'white',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Entrar
            </button>
          </form>

          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => alert('Em produção: cadastro com verificação de e-mail')}
              style={{
                background: 'none',
                border: 'none',
                color: '#004a6c',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Não tem conta? Cadastre-se
            </button>
          </div>

          <Link href="/index.html" style={{
            display: 'block',
            marginTop: '1rem',
            color: '#004a6c',
            fontSize: '0.9rem'
          }}>
            ← Voltar para o site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Meus Pacientes - Lunara</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#004a6c" />
        <link rel="icon" href="/imagens/logo.webp" type="image/webp" />
      </Head>

      <div style={{ backgroundColor: '#e6f7f0', minHeight: '100vh' }}>
        {/* Header */}
        <header style={{
          backgroundColor: 'white',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          padding: '1rem 0'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div className="logo">
              <Link href="/pages/PacientesPage">
                <img src="/imagens/logo.webp" alt="Logo Lunara Afiliados" style={{ height: '36px' }} />
              </Link>
            </div>
            <nav>
              <ul style={{
                display: 'flex',
                gap: '1rem',
                listStyle: 'none',
                overflowX: 'auto',
                padding: '0.5rem 0',
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none'
              }}>
                <li><Link href="/pages/DashboardPage" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Painel</Link></li>
                <li><Link href="/pages/PacientesPage" style={{
                  color: '#004a6c',
                  fontWeight: 'bold',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '8px',
                  background: '#e6f7f0'
                }}>Pacientes</Link></li>
                <li><a href="#relatorios" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Relatórios</a></li>
                <li><a href="#configuracoes" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Configurações</a></li>
                <li><button
                  onClick={() => supabase.auth.signOut()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#004a6c',
                    padding: '0.5rem 0.8rem',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Sair
                </button></li>
              </ul>
            </nav>
          </div>
        </header>

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem 1rem'
        }}>
          <h1 style={{
            color: '#004a6c',
            marginBottom: '0.5rem',
            fontSize: '1.8rem'
          }}>Meus Pacientes</h1>
          <p style={{ color: '#555', marginBottom: '2rem' }}>
            Gerencie seus pacientes e acompanhe o histórico de sessões.
          </p>

          {/* Lista de Pacientes */}
          <section style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            margin: '2rem 0',
            boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
            {loading ? (
              <p>Carregando...</p>
            ) : pacientes.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                Nenhum paciente cadastrado.
              </p>
            ) : (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.95rem'
              }}>
                <thead>
                  <tr style={{
                    background: '#f0f9f8',
                    color: '#004a6c',
                    fontWeight: '600',
                    borderBottom: '1px solid rgba(0,74,108,0.1)'
                  }}>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Nome</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>E-mail</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Última Sessão</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.map((p) => (
                    <tr key={p.id} style={{
                      borderBottom: '1px solid rgba(0,74,108,0.1)'
                    }}>
                      <td style={{ padding: '1rem' }}>{p.nome}</td>
                      <td style={{ padding: '1rem' }}>{p.email}</td>
                      <td style={{ padding: '1rem' }}>{p.ultimaSessao}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.3rem 0.8rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          background: p.status === 'Ativo' 
                            ? 'rgba(33,150,83,0.15)' 
                            : 'rgba(220,53,69,0.1)',
                          color: p.status === 'Ativo' ? '#2e7d32' : '#c62828',
                          border: p.status === 'Ativo'
                            ? '1px solid rgba(33,150,83,0.3)'
                            : '1px solid rgba(220,53,69,0.3)'
                        }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={{
                            background: 'none',
                            border: 'none',
                            color: '#004a6c',
                            cursor: 'pointer',
                            padding: '0.5rem'
                          }}>
                            <i className="fas fa-eye"></i>
                          </button>
                          <button style={{
                            background: 'none',
                            border: 'none',
                            color: '#004a6c',
                            cursor: 'pointer',
                            padding: '0.5rem'
                          }}>
                            <i className="fas fa-edit"></i>
                          </button>
                          <button style={{
                            background: 'none',
                            border: 'none',
                            color: '#c62828',
                            cursor: 'pointer',
                            padding: '0.5rem'
                          }}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Ações Rápidas */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <button style={{
              background: '#004a6c',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '50px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <i className="fas fa-plus"></i> Novo Paciente
            </button>
            <button style={{
              background: '#e6f7f0',
              color: '#004a6c',
              border: '1px solid rgba(0,74,108,0.3)',
              padding: '0.75rem 1.5rem',
              borderRadius: '50px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <i className="fas fa-download"></i> Exportar Lista
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#004a6c',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 2000,
            opacity: 1,
            transition: 'opacity 0.3s'
          }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
};

export default PacientesPage;