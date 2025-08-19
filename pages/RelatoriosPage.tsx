// pages/RelatoriosPage.tsx
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = 'https://gzyrbtrinccwqyeocymh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXJidHJpbmNjd3F5ZW9jeW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjgyOTIsImV4cCI6MjA3MTIwNDI5Mn0.rJ_C6t3lE3efsD_kQUoGvViCJodHc9NNGQukX-SPEMM';
const supabase = createClient(supabaseUrl, supabaseKey);

const RelatoriosPage = () => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Referências para os gráficos
  const vendasChartRef = useRef<HTMLCanvasElement>(null);
  const comissoesChartRef = useRef<HTMLCanvasElement>(null);
  const conversaoChartRef = useRef<HTMLCanvasElement>(null);

  // Filtros
  const [periodo, setPeriodo] = useState('30');
  const [afiliado, setAfiliado] = useState('');
  const [produto, setProduto] = useState('');

  // Dados mockados (em produção, viriam do Supabase)
  const relatorios = [
    { id: 1, nome: 'Relatório de Vendas',  'Outubro 2023', tipo: 'Vendas', tamanho: '2.4 MB' },
    { id: 2, nome: 'Comissões Pagas',  'Setembro 2023', tipo: 'Financeiro', tamanho: '1.8 MB' },
    { id: 3, nome: 'Análise de Conversão', data: 'Q3 2023', tipo: 'Marketing', tamanho: '3.1 MB' }
  ];

  // Verifica sessão ao carregar
  useEffect(() => {
    supabase.auth.getSession().then(({  { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        initCharts();
        setLoading(false);
      }
    });

    const {  authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          initCharts();
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

  // Inicializa gráficos
  const initCharts = () => {
    import('chart.js').then(Chart => {
      const { default: ChartJS } = Chart;

      // Gráfico de Vendas
      if (vendasChartRef.current) {
        const ctx = vendasChartRef.current.getContext('2d');
        new ChartJS(ctx!, {
          type: 'bar',
           {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
              label: 'Vendas (unidades)',
              data: [85, 92, 105, 110, 125, 140],
              backgroundColor: '#004a6c',
              borderColor: '#004a6c',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: 'Evolução de Vendas' }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { grid: { display: false } }
            }
          }
        });
      }

      // Gráfico de Comissões
      if (comissoesChartRef.current) {
        const ctx = comissoesChartRef.current.getContext('2d');
        new ChartJS(ctx!, {
          type: 'line',
          data: {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
              label: 'Comissões (R$)',
              data: [25000, 27500, 30000, 31500, 34000, 37500],
              backgroundColor: 'rgba(0, 74, 108, 0.1)',
              borderColor: '#004a6c',
              borderWidth: 3,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: 'Comissões Pagas aos Afiliados' }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { grid: { display: false } }
            }
          }
        });
      }

      // Gráfico de Conversão
      if (conversaoChartRef.current) {
        const ctx = conversaoChartRef.current.getContext('2d');
        new ChartJS(ctx!, {
          type: 'doughnut',
          data: {
            labels: ['Convertidos', 'Não Convertidos'],
            datasets: [{
              data: [3.8, 96.2],
              backgroundColor: ['#004a6c', '#e6f7f0'],
              borderColor: ['#004a6c', '#004a6c'],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              title: { display: true, text: 'Taxa de Conversão: 3.8%' }
            }
          }
        });
      }
    });
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const handleExport = (tipo: string) => {
    showToast(`Exportando relatório de ${tipo}...`);
    // Em produção: chamar API ou gerar PDF
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
              onClick={() => alert('Cadastro em produção com verificação de e-mail')}
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
        <title>Relatórios - Lunara Afiliados</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#004a6c" />
        <link rel="icon" href="/imagens/logo.webp" type="image/webp" />
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
              <Link href="/pages/RelatoriosPage">
                <img src="/imagens/logo.webp" alt="Logo Lunara Relatórios" style={{ height: '36px' }} />
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
                <li><Link href="/pages/RelatoriosPage" style={{
                  color: '#004a6c',
                  fontWeight: 'bold',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '8px',
                  background: '#e6f7f0'
                }}>Relatórios</Link></li>
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
          }}>Relatórios de Desempenho</h1>
          <p style={{ color: '#555', marginBottom: '2rem' }}>
            Acompanhe o desempenho das suas campanhas e comissões.
          </p>

          {/* Filtros */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            margin: '2rem 0',
            padding: '1.2rem',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#004a6c',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}>Período</label>
              <select
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(0,74,108,0.1)',
                  borderRadius: '6px',
                  fontSize: '0.95rem'
                }}
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Este trimestre</option>
                <option value="365">Este ano</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#004a6c',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}>Produto</label>
              <select
                value={produto}
                onChange={e => setProduto(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid rgba(0,74,108,0.1)',
                  borderRadius: '6px',
                  fontSize: '0.95rem'
                }}
              >
                <option value="">Todos os produtos</option>
                <option value="kit">Kit Terapia Completo</option>
                <option value="curso">Curso de Meditação</option>
                <option value="consultoria">Consultoria Online</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => showToast('Atualizando relatórios...')}
                style={{
                  width: '100%',
                  background: '#004a6c',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Aplicar Filtros
              </button>
            </div>
          </div>

          {/* Gráficos */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            margin: '2rem 0'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
              border: '1px solid rgba(0,74,108,0.1)'
            }}>
              <h3 style={{
                color: '#004a6c',
                marginBottom: '1rem',
                fontSize: '1.3rem'
              }}>Vendas por Mês</h3>
              <div style={{
                position: 'relative',
                height: '300px'
              }}>
                <canvas ref={vendasChartRef}></canvas>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
              border: '1px solid rgba(0,74,108,0.1)'
            }}>
              <h3 style={{
                color: '#004a6c',
                marginBottom: '1rem',
                fontSize: '1.3rem'
              }}>Comissões Pagas</h3>
              <div style={{
                position: 'relative',
                height: '300px'
              }}>
                <canvas ref={comissoesChartRef}></canvas>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
              border: '1px solid rgba(0,74,108,0.1)'
            }}>
              <h3 style={{
                color: '#004a6c',
                marginBottom: '1rem',
                fontSize: '1.3rem'
              }}>Taxa de Conversão</h3>
              <div style={{
                position: 'relative',
                height: '300px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <canvas ref={conversaoChartRef} style={{ maxHeight: '250px' }}></canvas>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
              border: '1px solid rgba(0,74,108,0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <h3 style={{
                color: '#004a6c',
                marginBottom: '1rem',
                fontSize: '1.3rem'
              }}>KPIs Consolidados</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem'
              }}>
                {[
                  { label: 'Total de Vendas', value: '48', color: '#004a6c' },
                  { label: 'Comissões Totais', value: 'R$ 2.450', color: '#004a6c' },
                  { label: 'Taxa de Conversão', value: '3.8%', color: '#d4af37' },
                  { label: 'Visitantes', value: '1.250', color: '#004a6c' }
                ].map((kpi, i) => (
                  <div key={i} style={{
                    textAlign: 'center',
                    padding: '1rem',
                    background: '#f0f9f8',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,74,108,0.1)'
                  }}>
                    <div style={{
                      fontSize: '1.8rem',
                      fontWeight: 'bold',
                      color: kpi.color
                    }}>{kpi.value}</div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#555'
                    }}>{kpi.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Relatórios Exportados */}
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
            }}>Relatórios Exportados</h2>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95rem'
            }}>
              <thead>
                <tr style={{
                  background: '#f0f9f8',
                  color: '#004a6c',
     