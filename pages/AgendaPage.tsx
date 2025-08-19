import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gzyrbtrinccwqyeocymh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXJidHJpbmNjd3F5ZW9jeW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjgyOTIsImV4cCI6MjA3MTIwNDI5Mn0.rJ_C6t3lE3efsD_kQUoGvViCJodHc9NNGQukX-SPEMM';
const supabase = createClient(supabaseUrl, supabaseKey);

const AgendaPage = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Pacientes e terapias fixos (pode vir do Supabase depois)
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
          className={`calendar-day ${date.getMonth() !== month ? 'inactive' : ''}`}
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
        <title>Agenda - Lunara</title>
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
              <Link href="/pages/AgendaPage">
                <img src="/imagens/logo.webp" alt="Logo Lunara" style={{ height: '36px' }} />
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
                <li><Link href="/pages/AgendaPage" style={{
                  color: '#004a6c',
                  fontWeight: 'bold',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '8px',
                  background: '#e6f7f0'
                }}>Agenda</Link></li>
                <li><a href="#historico" style={{ color: '#004a6c', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>Histórico</a></li>
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
          <h1 style={{
            color: '#004a6c',
            marginBottom: '1rem',
            fontSize: '1.8rem'
          }}>Agendamento de Sessões</h1>
          <p style={{ color: '#555', marginBottom: '2rem' }}>
            Selecione um dia para agendar uma nova sessão.
          </p>

          {/* Calendário */}
          <div style={{
            background: 'white',
            borderRadius: '15px',
            padding: '1.5rem',
            boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
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
          </div>

          {/* Lista de Agendamentos */}
          <div style={{
            marginTop: '2rem',
            background: 'white',
            borderRadius: '15px',
            padding: '1.5rem',
            boxShadow: '0 4px 15px rgba(0,74,108,0.1)',
            border: '1px solid rgba(0,74,108,0.1)'
          }}>
            <h2 style={{
              color: '#004a6c',
              marginBottom: '1rem',
              fontSize: '1.3rem'
            }}>Próximas Sessões</h2>
            {loading ? (
              <p>Carregando...</p>
            ) : appointments.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Nenhuma sessão agendada.</p>
            ) : (
              <ul style={{ listStyle: 'none', marginTop: '1rem' }}>
                {appointments.map((app, i) => (
                  <li key={i} style={{
                    padding: '1rem',
                    borderBottom: '1px solid rgba(0,74,108,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{new Date(app.datetime).toLocaleString('pt-BR')}</strong>
                      <div style={{ color: '#555', fontSize: '0.9rem' }}>
                        {app.patient} - {app.therapy}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: '#004a6c',
                    fontSize: '0.95rem'
                  }}>Terapia</label>
                  <select
                    value={form.therapy}
                    onChange={e => setForm({ ...form, therapy: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0,74,108,0.1)',
                      borderRadius: '6px'
                    }}
                  >
                    {terapias.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: '#004a6c',
                    fontSize: '0.95rem'
                  }}>Data e Hora</label>
                  <input
                    type="datetime-local"
                    value={form.datetime}
                    onChange={e => setForm({ ...form, datetime: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0,74,108,0.1)',
                      borderRadius: '6px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      background: '#004a6c',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      flex: 1,
                      background: '#e6f7f0',
                      color: '#004a6c',
                      border: '1px solid rgba(0,74,108,0.1)',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

export default AgendaPage;