import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = 'https://gzyrbtrinccwqyeocymh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXJidHJpbmNjd3F5ZW9jeW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjgyOTIsImV4cCI6MjA3MTIwNDI5Mn0.rJ_C6t3lE3efsD_kQUoGvViCJodHc9NNGQukX-SPEMM';
const supabase = createClient(supabaseUrl, supabaseKey);

const DashboardPage = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Dados do afiliado
  const [user] = useState({ name: 'João Silva', since: 'Jan/2023' });

  // Pacientes e terapias
  const pacientes = ['Ana Silva', 'Carlos Souza', 'Joana Almeida', 'Lucas Melo', 'Maria Costa'];
  const terapias = ['Sessão de Fisioterapia', 'Terapia Ocupacional'];
  
  const [form, setForm] = useState({
    patient: pacientes[0],
    therapy: terapias[0],
    datetime: ''
  });

  // Carregar agendamentos ao iniciar
  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('datetime', { ascending: true });

      if (error) throw error;
      setAppointments(data);
    } catch (error: any) {
      showToast('Erro ao carregar agendamentos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (date: Date) => {
    setSelectedDate(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setForm(prev => ({ ...prev, datetime: `${year}-${month}-${day}T09:00` }));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({ patient: pacientes[0], therapy: terapias[0], datetime: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;

    try {
      const { error } = await supabase.from('appointments').insert([{
        patient: form.patient,
        therapy: form.therapy,
        datetime: form.datetime
      }]);

      if (error) throw error;

      showToast('Agendamento salvo com sucesso!');
      closeModal();
      loadAppointments(); // Recarregar
    } catch (error: any) {
      showToast('Erro ao salvar agendamento');
      console.error(error);
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  // Gerar dias do mês
  const renderCalendar = () => {
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const rows = [];
    let row = [];
    let date = new Date(startDate);

    while (date <= lastDay || row.length > 0) {
      if (row.length === 7) {
        rows.push(<tr key={date.getTime()}>{row}</tr>);
        row = [];
      }

      const dateString = date.toISOString().split('T')[0];
      const hasAppointment = appointments.some(a => a.datetime.startsWith(dateString));

      const cell = (
        <td
          key={date.getTime()}
          style={{
            padding: '1rem 0.5rem',
            textAlign: 'center',
            border: '1px solid rgba(0,74,108,0.1)',
            cursor: date.getMonth() === month ? 'pointer' : 'default',
            opacity: date.getMonth() === month ? 1 : 0.3,
            position: 'relative',
            height: '50px'
          }}
          onClick={() => date.getMonth() === month && openModal(new Date(date))}
        >
          {date.getDate()}
          {hasAppointment && (
            <span
              style={{
                position: 'absolute',
                bottom: '0.3rem',
                right: '0.3rem',
                fontSize: '0.7rem',
                color: '#004a6c'
              }}
            >
              ✓
            </span>
          )}
        </td>
      );

      row.push(cell);
      date.setDate(date.getDate() + 1);
    }

    if (row.length > 0) {
      rows.push(<tr key="last">{row}</tr>);
    }

    return rows;
  };

  return (
    <>
      <Head>
        <title>Painel do Afiliado - Lunara</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
              <Link href="/pages/DashboardPage">
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
                <li><Link href="/pages/DashboardPage" style={{
                  color: '#004a6c',
                  fontWeight: 'bold',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '8px',
                  background: '#e6f7f0'
                }}>Painel</Link></li>
                <li><a href="#relatorios" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Relatórios</a></li>
                <li><a href="#materiais" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Materiais</a></li>
                <li><a href="#configuracoes" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Configurações</a></li>
                <li><a href="/index.html" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Sair</a></li>
              </ul>
            </nav>
          </div>
        </header>

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem 1rem'
        }}>
          {/* Dashboard Header */}
          <section style={{
            background: 'linear-gradient(135deg, #004a6c 0%, #003d5b 100%)',
            color: 'white',
            padding: '3rem 0 2rem',
            borderRadius: '15px 15px 0 0',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginBottom: '2rem',
              padding: '0 1.5rem'
            }}>
              <div>
                <h1 style={{ margin: 0 }}>Painel do Afiliado</h1>
                <p style={{ opacity: 0.9 }}>Gerencie suas comissões e agende sessões</p>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'white',
                  color: '#004a6c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.5rem'
                }}>
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{user.name}</h3>
                  <p style={{ margin: 0, opacity: 0.8 }}>Afiliado desde: {user.since}</p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.5rem',
              padding: '0 1.5rem 2rem'
            }}>
              {[
                { icon: 'dollar-sign', label: 'Total de Comissões', value: 'R$ 2.450' },
                { icon: 'shopping-cart', label: 'Vendas Realizadas', value: '48' },
                { icon: 'users', label: 'Visitantes Únicos', value: '1.250' },
                { icon: 'chart-line', label: 'Taxa de Conversão', value: '3.8%' }
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

          {/* Ações Rápidas */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            padding: '1.5rem',
            background: 'white',
            borderTop: '1px solid rgba(0,74,108,0.1)',
            borderBottom: '1px solid rgba(0,74,108,0.1)'
          }}>
            {[
              { icon: 'link', label: 'Meu Link de Afiliado' },
              { icon: 'share-alt', label: 'Compartilhar' },
              { icon: 'download', label: 'Baixar Relatório' }
            ].map((btn, i) => (
              <Link key={i} href="#" style={{
                flex: 1,
                minWidth: '180px',
                background: '#004a6c',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '50px',
                textAlign: 'center',
                textDecoration: 'none',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.3s ease'
              }}>
                <i className={`fas fa-${btn.icon}`}></i>
                {btn.label}
              </Link>
            ))}
          </div>

          {/* Calendário de Agendamento */}
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
            }}>Agendamento de Sessões</h2>
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
                  <th style={{ padding: '0.7rem' }}>Dom</th>
                  <th>Seg</th>
                  <th>Ter</th>
                  <th>Qua</th>
                  <th>Qui</th>
                  <th>Sex</th>
                  <th>Sáb</th>
                </tr>
              </thead>
              <tbody>
                {renderCalendar()}
              </tbody>
            </table>
          </section>

          {/* Comissões Recentes */}
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
            }}>Comissões Recentes</h2>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
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
                  }}>Data</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    borderBottom: '1px solid rgba(0,74,108,0.1)',
                    background: '#f0f9f8',
                    color: '#004a6c',
                    fontWeight: '600'
                  }}>Produto</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    borderBottom: '1px solid rgba(0,74,108,0.1)',
                    background: '#f0f9f8',
                    color: '#004a6c',
                    fontWeight: '600'
                  }}>Valor</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    borderBottom: '1px solid rgba(0,74,108,0.1)',
                    background: '#f0f9f8',
                    color: '#004a6c',
                    fontWeight: '600'
                  }}>Comissão</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    borderBottom: '1px solid rgba(0,74,108,0.1)',
                    background: '#f0f9f8',
                    color: '#004a6c',
                    fontWeight: '600'
                  }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>23/10/2023</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Kit Terapia Completo</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>R$ 297,00</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>R$ 89,10</td>
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
                    }}>Pago</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>22/10/2023</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Curso de Meditação</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>R$ 97,00</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>R$ 29,10</td>
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
                    }}>Pago</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>21/10/2023</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>Consultoria Online</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>R$ 150,00</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>R$ 45,00</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid rgba(0,74,108,0.1)' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.3rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      background: 'rgba(255,193,7,0.15)',
                      color: '#f57f17',
                      border: '1px solid rgba(255,193,7,0.3)'
                    }}>Pendente</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {/* Modal de Agendamento */}
        {showModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              padding: '1.5rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ color: '#004a6c', marginBottom: '1rem' }}>Agendar Nova Sessão</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: '#004a6c',
                    fontSize: '0.95rem'
                  }}>Paciente</label>
                  <select
                    value={form.patient}
                    onChange={e => setForm({ ...form, patient: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0,74,108,0.1)',
                      borderRadius: '6px'
                    }}
                  >
                    {pacientes.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
       