// pages/TerapiasPage.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = 'https://gzyrbtrinccwqyeocymh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXJidHJpbmNjd3F5ZW9jeW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjgyOTIsImV4cCI6MjA3MTIwNDI5Mn0.rJ_C6t3lE3efsD_kQUoGvViCJodHc9NNGQukX-SPEMM';
const supabase = createClient(supabaseUrl, supabaseKey);

const TerapiasPage = () => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  // Dados das terapias (em produção, viriam do Supabase)
  const terapiasMock = [
    {
      id: 1,
      nome: 'Sessão de Fisioterapia',
      duracao: '60 min',
      valor: 'R$ 297,00',
      comissao: 'R$ 89,10',
      categoria: 'Física',
      status: 'Ativo'
    },
    {
      id: 2,
      nome: 'Terapia Ocupacional',
      duracao: '50 min',
      valor: 'R$ 197,00',
      comissao: 'R$ 59,10',
      categoria: 'Reabilitação',
      status: 'Ativo'
    },
    {
      id: 3,
      nome: 'Terapia de Casal',
      duracao: '90 min',
      valor: 'R$ 350,00',
      comissao: 'R$ 105,00',
      categoria: 'Psicologia',
      status: 'Inativo'
    },
    {
      id: 4,
      nome: 'Consultoria Online',
      duracao: '30 min',
      valor: 'R$ 150,00',
      comissao: 'R$ 45,00',
      categoria: 'Coaching',
      status: 'Ativo'
    }
  ];

  const [terapias, setTerapias] = useState(terapiasMock);

  // Verifica sessão ao carregar
  useEffect(() => {
    supabase.auth.getSession().then(({  { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setLoading(false);
      }
    });

    const {  authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
        } else {
          setSession(null);
          setUser(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Filtrar terapias por busca
  useEffect(() => {
    if (search.trim() === '') {
      setTerapias(terapiasMock);
    } else {
      setTerapias(
        terapiasMock.filter(t =>
          t.nome.toLowerCase().includes(search.toLowerCase()) ||
          t.categoria.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const handleExport = () => {
    showToast('Exportando lista de terapias...');
    // Em produção: gerar CSV ou PDF
  };

  const handleEdit = (id: number) => {
    showToast(`Editando terapia #${id}`);
  };

  const handleToggleStatus = (id: number, currentStatus: string) => {
    const nova = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';
    setTerapias(terapias.map(t => t.id === id ? { ...t, status: nova } : t));
    showToast(`Terapia #${id} ${nova.toLowerCase()} com sucesso!`);
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
              onClick={() => alert('Cadastro com verificação de e-mail')}
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
        <title>Terapias - Lunara Afiliados</title>
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
              <Link href="/pages/TerapiasPage">
                <img src="/imagens/logo.webp" alt="Logo Lunara Terapias" style={{ height: '36px' }} />
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
                <li><Link href="/pages/PacientesPage" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Pacientes</Link></li>
                <li><Link href="/pages/TerapiasPage" style={{
                  color: '#004a6c',
                  fontWeight: 'bold',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '8px',
                  background: '#e6f7f0'
                }}>Terapias</Link></li>
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
          }}>Catálogo de Terapias</h1>
          <p style={{ color: '#555', marginBottom: '2rem' }}>
            Gerencie as terapias disponíveis para seus pacientes.
          </p>

          {/* Busca e Ações */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2rem',
            alignItems: 'center'
          }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <input
                type="text"
                placeholder="Buscar terapia..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(0,74,108,0.3)',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  background: 'white'
                }}
              />
            </div>
            <button
              onClick={() => showToast('Nova terapia')}
              style={{
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
              }}
            >
              <i className="fas fa-plus"></i> Nova Terapia
            </button>
            <button
              onClick={handleExport}
              style={{
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
              }}
            >
              <i className="fas fa-download"></i> Exportar
            </button>
          </div>

          {/* Cards de Terapias */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem'
          }}>
            {terapias.map(t => (
              <div key={t.id} style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
                border: '1px solid rgba(0,74,108,0.1)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{
                    color: '#004a6c',
                    margin: 0,
                    fontSize: '1.2rem'
                  }}>{t.nome}</h3>
                  <span style={{
                    background: t.status === 'Ativo' ? 'rgba(33,150,83,0.15)' : 'rgba(220,53,69,0.1)',
                    color: t.status === 'Ativo' ? '#2e7d32' : '#c62828',
                    padding: '0.3rem 0.8rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {t.status}
                  </span>
                </div>
                <div style={{
                  color: '#555',
                  fontSize: '0.95rem',
                  marginBottom: '1rem'
                }}>
                  <div><strong>Duração:</strong> {t.duracao}</div>
                  <div><strong>Valor:</strong> {t.valor}</div>
                  <div><strong>Comissão:</strong> {t.comissao}</div>
                  <div><strong>Categoria:</strong> {t.categoria}</div>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '1rem'
                }}>
                  <button
                    onClick={() => handleEdit(t.id)}
                    style={{
                      flex: 1,
                      background: '#004a6c',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleToggleStatus(t.id, t.status)}
                    style={{
                      flex: 1,
                      background: t.status === 'Ativo' ? '#e6f7f0' : '#ffebee',
                      color: t.status === 'Ativo' ? '#004a6c' : '#c62828',
                      border: '1px solid rgba(0,74,108,0.3)',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    <i className={`fas fa-${t.status === 'Ativo' ? 'toggle-on' : 'toggle-off'}`}></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tabela de Terapias */}
          <section style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            margin: '2rem 0',
            boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
            <h2 style={{
              color: '#004a6c',
              marginBottom: '1.5rem',
              fontSize: '1.5rem'
            }}>Lista Completa</h2>
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
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Duração</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Valor</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Comissão</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Categoria</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {terapias.map(t => (
                  <tr key={t.id} style={{
                    borderBottom: '1px solid rgba(0,74,108,0.1)'
                  }}>
                    <td style={{ padding: '1rem' }}>{t.nome}</td>
                    <td style={{ padding: '1rem' }}>{t.duracao}</td>
                    <td style={{ padding: '1rem' }}>{t.valor}</td>
                    <td style={{ padding: '1rem' }}>{t.comissao}</td>
                    <td style={{ padding: '1rem' }}>{t.categoria}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        background: t.status === 'Ativo' ? 'rgba(33,150,83,0.15)' : 'rgba(220,53,69,0.1)',
                        color: t.status === 'Ativo' ? '#2e7d32' : '#c62828',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                      }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEdit(t.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#004a6c',
                            cursor: 'pointer',
                            padding: '0.5rem'
                          }}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(t.id, t.status)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: t.status === 'Ativo' ? '#856404' : '#155724',
                            cursor: 'pointer',
                            padding: '0.5rem'
                          }}
                        >
                          <i className={`fas fa-${t.status === 'Ativo' ? 'toggle-off' : 'toggle-on'}`}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
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
    