import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const AdminMasterPage = () => {
  const [activeTab, setActiveTab] = useState('terapeutas');
  const [periodo, setPeriodo] = useState('30');
  const [afiliado, setAfiliado] = useState('');
  const [produto, setProduto] = useState('');

  const vendasChartRef = useRef<HTMLCanvasElement>(null);
  const comissoesChartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Carregar Chart.js dinamicamente para evitar erro no SSR
    import('chart.js').then(Chart => {
      const { default: ChartJS } = Chart;

      if (vendasChartRef.current) {
        const ctx = vendasChartRef.current.getContext('2d');
        new ChartJS(ctx!, {
          type: 'bar',
          data: {
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
    });
  }, []);

  return (
    <>
      <Head>
        <title>Painel Master - Lunara</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div style={{ backgroundColor: '#e6f7f0', minHeight: '100vh' }}>
        {/* Header */}
        <header style={{
          backgroundColor: 'white',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          padding: '1rem 0'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="logo">
              <Link href="/pages/AdminMasterPage">
                <img src="/imagens/logo.webp" alt="Logo Lunara Master" style={{ height: '36px' }} />
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
                <li><Link href="/pages/AdminMasterPage" style={{ color: '#004a6c', fontWeight: 'bold', padding: '0.5rem 0.8rem', borderRadius: '8px', background: '#e6f7f0' }}>Painel</Link></li>
                <li><a href="#usuarios" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Usuários</a></li>
                <li><a href="#relatorios" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Relatórios</a></li>
                <li><a href="#configuracoes" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Configurações</a></li>
                <li><a href="/index.html" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Sair</a></li>
              </ul>
            </nav>
          </div>
        </header>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
          {/* Dashboard Header */}
          <section style={{
            background: 'linear-gradient(135deg, #004a6c 0%, #003d5b 100%)',
            color: 'white',
            padding: '3rem 0 2rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ margin: 0 }}>Painel Master</h1>
                <p style={{ opacity: 0.9 }}>Gerenciamento completo do sistema</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  color: '#004a6c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.5rem'
                }}>AM</div>
                <div>
                  <h3 style={{ margin: 0 }}>Admin Master</h3>
                  <p style={{ margin: 0, opacity: 0.8 }}>Administrador do Sistema</p>
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.5rem',
              marginBottom: '3rem'
            }}>
              {[
                { icon: 'users', label: 'Total Usuários', value: '1,250' },
                { icon: 'user-md', label: 'Terapeutas', value: '45' },
                { icon: 'handshake', label: 'Afiliados', value: '320' },
                { icon: 'chart-line', label: 'Faturamento', value: 'R$ 125K' }
              ].map((stat, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <i className={`fas fa-${stat.icon}`} style={{
                    fontSize: '2.5rem',
                    color: '#d4af37',
                    marginBottom: '0.8rem'
                  }}></i>
                  <h3 style={{
                    fontSize: '2rem',
                    margin: '0.5rem 0',
                    color: 'white'
                  }}>{stat.value}</h3>
                  <p style={{ opacity: 0.9 }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

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
            {[
              { label: 'Período', value: periodo, setter: setPeriodo, options: ['7', '30', '90', '365', 'Ano'] },
              { label: 'Afiliado', value: afiliado, setter: setAfiliado, options: ['Todos', 'João', 'Maria'] },
              { label: 'Produto', value: produto, setter: setProduto, options: ['Todos', 'Kit Terapia', 'Curso'] }
            ].map((filter, i) => (
              <div key={i} style={{ flex: 1, minWidth: '200px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#004a6c',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}>{filter.label}</label>
                <select
                  value={filter.value}
                  onChange={e => filter.setter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(0,74,108,0.1)',
                    borderRadius: '6px',
                    fontSize: '0.95rem'
                  }}
                >
                  {filter.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <section style={{
            background: 'white',
            borderRadius: '15px',
            padding: '2rem',
            margin: '2rem 0',
            boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
            <h2 style={{
              color: '#004a6c',
              marginBottom: '1.5rem',
              fontSize: '1.5rem'
            }}>Desempenho das Afiliações</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem'
            }}>
              <div style={{
                position: 'relative',
                height: '300px',
                background: '#f0f9f8',
                borderRadius: '10px'
              }}>
                <canvas ref={vendasChartRef}></canvas>
              </div>
              <div style={{
                position: 'relative',
                height: '300px',
                background: '#f0f9f8',
                borderRadius: '10px'
              }}>
                <canvas ref={comissoesChartRef}></canvas>
              </div>
            </div>
          </section>

          {/* Demonstrativos Consolidados */}
          <section style={{
            background: 'white',
            borderRadius: '15px',
            padding: '2rem',
            margin: '2rem 0',
            boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
            <h2 style={{
              color: '#004a6c',
              marginBottom: '1.5rem',
              fontSize: '1.5rem'
            }}>Demonstrativos Consolidados</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem'
            }}>
              {[
                { title: 'Faturamento Total', value: 'R$ 125.000', subtitle: '+12% vs mês anterior' },
                { title: 'Comissões Pagas', value: 'R$ 37.500', subtitle: '30% do faturamento' },
                { title: 'Taxa de Conversão', value: '3.8%', subtitle: '+0.5% vs mês anterior' },
                { title: 'Novos Afiliados', value: '24', subtitle: '+18% de crescimento' }
              ].map((item, i) => (
                <div key={i} style={{
                  background: '#f0f9f8',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  border: '1px solid rgba(0,74,108,0.1)'
                }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    margin: '0.5rem 0',
                    color: '#004a6c'
                  }}>{item.title}</h3>
                  <div style={{
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    color: '#004a6c'
                  }}>{item.value}</div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#555'
                  }}>{item.subtitle}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Gerenciamento de Usuários */}
          <section style={{
            background: 'white',
            borderRadius: '15px',
            padding: '2rem',
            margin: '2rem 0',
            boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
            <h2 style={{
              color: '#004a6c',
              marginBottom: '1.5rem',
              fontSize: '1.5rem'
            }}>Gerenciamento de Usuários</h2>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid rgba(0,74,108,0.1)',
              overflowX: 'auto'
            }}>
              {['terapeutas', 'afiliados', 'pacientes'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.75rem 1.2rem',
                    cursor: 'pointer',
                    color: activeTab === tab ? '#004a6c' : '#666',
                    fontWeight: activeTab === tab ? 'bold' : 'normal',
                    borderBottom: activeTab === tab ? '3px solid #004a6c' : 'none'
                  }}
                >
                  {tab === 'terapeutas' && 'Terapeutas'}
                  {tab === 'afiliados' && 'Afiliados'}
                  {tab === 'pacientes' && 'Pacientes'}
                </button>
              ))}
            </div>

            <div style={{ display: activeTab === 'terapeutas' ? 'block' : 'none' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: '1rem'
              }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      borderBottom: '1px solid rgba(0,74,108,0.1)',
                      background: '#f0f9f8',
                      color: '#004a6c',
                      fontWeight: '600'
                    }}>Nome</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>E-mail</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Especialidade</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Status</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Dra. Sofia Mendes</td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>sofia@lunara.com</td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Psicologia Clínica</td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: 'rgba(33,150,83,0.15)',
                        color: '#2e7d32',
                        border: '1px solid rgba(33,150,83,0.3)'
                      }}>Ativo</span>
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><i className="fas fa-edit"></i></button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><i className="fas fa-trash"></i></button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><i className="fas fa-eye"></i></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer style={{
          marginTop: '4rem',
          padding: '2rem 0',
          textAlign: 'center',
          color: '#004a6c',
          fontSize: '0.9rem',
          opacity: 0.8
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <p>&copy; 2023 Lunara Master. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default AdminMasterPage;