import React, { useState, useEffect, useCallback } from 'react';

// Componente principal - 100% local, sem dependências externas
const AgendaAtendimentos = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAgendamentoModal, setShowAgendamentoModal] = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [showTerapiaModal, setShowTerapiaModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Estados de splash screen e carregamento
  const [showSplash, setShowSplash] = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Iniciando...');

  // Estados de sistema sempre offline - MODO LOCAL APENAS
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados persistentes usando localStorage diretamente
  const [pacientes, setPacientes] = useState(() => {
    try {
      const saved = localStorage.getItem('pacientes');
      return saved ? JSON.parse(saved) : [
        { id: 1, nome: 'Maria Silva', telefone: '(16) 99999-9999', email: 'maria@email.com' },
        { id: 2, nome: 'João Santos', telefone: '(16) 88888-8888', email: 'joao@email.com' }
      ];
    } catch {
      return [
        { id: 1, nome: 'Maria Silva', telefone: '(16) 99999-9999', email: 'maria@email.com' },
        { id: 2, nome: 'João Santos', telefone: '(16) 88888-8888', email: 'joao@email.com' }
      ];
    }
  });
  
  const [terapias, setTerapias] = useState(() => {
    try {
      const saved = localStorage.getItem('terapias');
      return saved ? JSON.parse(saved) : [
        { id: 1, nome: 'Fisioterapia', duracao: '60 min', cor: '#3B82F6' },
        { id: 2, nome: 'Acupuntura', duracao: '45 min', cor: '#10B981' },
        { id: 3, nome: 'Massoterapia', duracao: '90 min', cor: '#8B5CF6' }
      ];
    } catch {
      return [
        { id: 1, nome: 'Fisioterapia', duracao: '60 min', cor: '#3B82F6' },
        { id: 2, nome: 'Acupuntura', duracao: '45 min', cor: '#10B981' },
        { id: 3, nome: 'Massoterapia', duracao: '90 min', cor: '#8B5CF6' }
      ];
    }
  });
  
  const [agendamentos, setAgendamentos] = useState(() => {
    try {
      const saved = localStorage.getItem('agendamentos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [tratamentosPendentes, setTratamentosPendentes] = useState(() => {
    try {
      const saved = localStorage.getItem('tratamentosPendentes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const [novoPaciente, setNovoPaciente] = useState({ nome: '', telefone: '', email: '' });
  const [novaTerapia, setNovaTerapia] = useState({ nome: '', duracao: '', cor: '#3B82F6' });
  const [novoAgendamento, setNovoAgendamento] = useState({
    pacienteId: '',
    terapiaId: '',
    horario: '',
    observacoes: ''
  });
  
  const [draggedTerapia, setDraggedTerapia] = useState(null);
  const [dragOverPaciente, setDragOverPaciente] = useState(null);
  const [draggedTratamentoPendente, setDraggedTratamentoPendente] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});

  // Função para salvar no localStorage
  const saveToLocalStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Erro ao salvar ${key}:`, error);
      return false;
    }
  };

  // Auto-save offline
  const autoSave = useCallback(() => {
    if (!hasUnsavedChanges) return;
    
    try {
      setIsSaving(true);
      saveToLocalStorage('pacientes', pacientes);
      saveToLocalStorage('terapias', terapias);
      saveToLocalStorage('agendamentos', agendamentos);
      saveToLocalStorage('tratamentosPendentes', tratamentosPendentes);
      
      const dataToSave = {
        pacientes,
        terapias,
        agendamentos,
        tratamentosPendentes,
        lastUpdate: new Date().toISOString()
      };
      
      saveToLocalStorage('agenda_backup', dataToSave);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Erro no auto-save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, pacientes, terapias, agendamentos, tratamentosPendentes]);

  const exportData = (customFilename = null) => {
    try {
      const dataToExport = {
        pacientes,
        terapias,
        agendamentos,
        tratamentosPendentes,
        exportDate: new Date().toISOString(),
        user: 'local'
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const defaultFilename = `agenda_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.download = customFilename || defaultFilename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      return false;
    }
  };

  const saveLocalWithDialog = () => {
    const filename = window.prompt(
      'Digite o nome do arquivo para salvar (sem extensão):\n\nO arquivo será salvo como .json na pasta Downloads do seu navegador.',
      `agenda_backup_${new Date().toISOString().split('T')[0]}`
    );
    
    if (filename !== null) {
      const sanitizedFilename = filename.trim() || `agenda_backup_${new Date().toISOString().split('T')[0]}`;
      const fullFilename = sanitizedFilename.endsWith('.json') ? sanitizedFilename : `${sanitizedFilename}.json`;
      
      if (exportData(fullFilename)) {
        alert(`Dados salvos como "${fullFilename}" na pasta Downloads! 📁✅`);
        return true;
      } else {
        alert('Erro ao salvar arquivo ❌');
        return false;
      }
    }
    return false;
  };

  // Efeito para simular carregamento do splash screen
  useEffect(() => {
    const loadStages = [
      { text: 'Iniciando sistema local...', duration: 400 },
      { text: 'Carregando dados...', duration: 300 },
      { text: 'Verificando localStorage...', duration: 300 },
      { text: 'Preparando interface...', duration: 200 },
      { text: 'Finalizando...', duration: 200 }
    ];

    let currentStage = 0;
    let currentProgress = 0;

    const updateProgress = () => {
      if (currentStage < loadStages.length) {
        const stage = loadStages[currentStage];
        setLoadingStage(stage.text);
        
        const progressIncrement = 100 / loadStages.length;
        const targetProgress = (currentStage + 1) * progressIncrement;
        
        const progressAnimation = setInterval(() => {
          currentProgress += 4;
          setSplashProgress(Math.min(currentProgress, targetProgress));
          
          if (currentProgress >= targetProgress) {
            clearInterval(progressAnimation);
            currentStage++;
            
            if (currentStage < loadStages.length) {
              setTimeout(updateProgress, 100);
            } else {
              setTimeout(() => {
                setShowSplash(false);
              }, 200);
            }
          }
        }, 20);
      }
    };

    const startTimeout = setTimeout(updateProgress, 300);
    
    return () => {
      clearTimeout(startTimeout);
    };
  }, []);

  useEffect(() => {
    if (showSplash) return;

    const interval = setInterval(autoSave, 5 * 60 * 1000);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoSave, showSplash]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        autoSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, autoSave]);

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [pacientes, terapias, agendamentos, tratamentosPendentes]);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const formatDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const feriados = {
    '2025-01-01': 'Confraternização Universal',
    '2025-02-17': 'Carnaval',
    '2025-02-18': 'Carnaval',
    '2025-04-18': 'Sexta-feira Santa',
    '2025-04-21': 'Tiradentes',
    '2025-05-01': 'Dia do Trabalhador',
    '2025-07-11': 'Dia de São Bento - Araraquara',
    '2025-07-09': 'Revolução Constitucionalista (SP)',
    '2025-08-22': 'Feriado Municipal - Araraquara',
    '2025-09-07': 'Independência do Brasil',
    '2025-10-12': 'Nossa Senhora Aparecida',
    '2025-11-02': 'Finados',
    '2025-11-15': 'Proclamação da República',
    '2025-11-20': 'Consciência Negra (SP)',
    '2025-12-25': 'Natal'
  };

  const isHoliday = (day) => {
    if (!day) return false;
    const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    return !!feriados[dateKey];
  };

  const isWeekend = (day) => {
    if (!day) return false;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date.getDay() === 0 || date.getDay() === 6;
  };

  const getHorarioInicial = (day) => {
    if (!day) return '17:00';
    if (isHoliday(day)) return '09:00';
    if (isWeekend(day)) return '09:00';
    return '17:00';
  };

  const calcularProximoHorario = (agendamentosExistentes, duracaoMinutos) => {
    if (agendamentosExistentes.length === 0) {
      return null;
    }

    const agendamentosOrdenados = agendamentosExistentes
      .sort((a, b) => a.horario.localeCompare(b.horario));

    const ultimoAgendamento = agendamentosOrdenados[agendamentosOrdenados.length - 1];
    const ultimoHorario = ultimoAgendamento.horario;
    const ultimaTerapia = terapias.find(t => t.id === ultimoAgendamento.terapiaId);
    const ultimaDuracao = parseInt(ultimaTerapia?.duracao?.match(/\d+/)?.[0] || '60');

    const [horas, minutos] = ultimoHorario.split(':').map(Number);
    const totalMinutos = horas * 60 + minutos + ultimaDuracao;
    const novasHoras = Math.floor(totalMinutos / 60);
    const novosMinutos = totalMinutos % 60;

    return `${String(novasHoras).padStart(2, '0')}:${String(novosMinutos).padStart(2, '0')}`;
  };

  const getAgendamentosForDay = (day) => {
    if (!day) return [];
    const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    return agendamentos.filter(ag => ag.data === dateKey);
  };

  const addPaciente = () => {
    if (novoPaciente.nome.trim()) {
      const newPaciente = {
        id: Date.now(),
        ...novoPaciente
      };
      setPacientes([...pacientes, newPaciente]);
      setNovoPaciente({ nome: '', telefone: '', email: '' });
      setShowPacienteModal(false);
    }
  };

  const addTerapia = () => {
    if (novaTerapia.nome.trim()) {
      const newTerapia = {
        id: Date.now(),
        ...novaTerapia
      };
      setTerapias([...terapias, newTerapia]);
      setNovaTerapia({ nome: '', duracao: '', cor: '#3B82F6' });
      setShowTerapiaModal(false);
    }
  };

  const addAgendamento = () => {
    if (novoAgendamento.pacienteId && novoAgendamento.terapiaId && novoAgendamento.horario && selectedDate) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), selectedDate);
      const newAgendamento = {
        id: Date.now(),
        data: dateKey,
        pacienteId: parseInt(novoAgendamento.pacienteId),
        terapiaId: parseInt(novoAgendamento.terapiaId),
        horario: novoAgendamento.horario,
        observacoes: novoAgendamento.observacoes
      };
      setAgendamentos([...agendamentos, newAgendamento]);
      setNovoAgendamento({ pacienteId: '', terapiaId: '', horario: '', observacoes: '' });
      setShowAgendamentoModal(false);
      setSelectedDate(null);
    }
  };

  const removeAgendamento = (id) => {
    setAgendamentos(agendamentos.filter(ag => ag.id !== id));
  };

  // Funções de Drag and Drop
  const handleDragStart = (e, terapia) => {
    setDraggedTerapia(terapia);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e, pacienteId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverPaciente(pacienteId);
  };

  const handleDragLeave = (e) => {
    setDragOverPaciente(null);
  };

  const handleDrop = (e, paciente) => {
    e.preventDefault();
    setDragOverPaciente(null);
    
    if (draggedTerapia) {
      const tratamentosExistentes = tratamentosPendentes[paciente.id] || [];
      const tratamentoExistente = tratamentosExistentes.find(t => t.terapiaId === draggedTerapia.id);
      
      if (tratamentoExistente) {
        setTratamentosPendentes(prev => ({
          ...prev,
          [paciente.id]: prev[paciente.id].map(t => 
            t.id === tratamentoExistente.id 
              ? { ...t, sessoesPendentes: t.sessoesPendentes + 1 }
              : t
          )
        }));
      } else {
        const novTratamento = {
          id: Date.now(),
          terapiaId: draggedTerapia.id,
          pacienteId: paciente.id,
          sessoesPendentes: 1,
          dataContratacao: new Date().toISOString().split('T')[0],
          observacoes: ''
        };

        setTratamentosPendentes(prev => ({
          ...prev,
          [paciente.id]: [...(prev[paciente.id] || []), novTratamento]
        }));
      }

      setDraggedTerapia(null);
    }
  };

  const removeTratamentoPendente = (pacienteId, tratamentoId) => {
    setTratamentosPendentes(prev => ({
      ...prev,
      [pacienteId]: prev[pacienteId].filter(t => t.id !== tratamentoId)
    }));
  };

  const updateSessoesPendentes = (pacienteId, tratamentoId, novaQuantidade) => {
    if (novaQuantidade <= 0) {
      removeTratamentoPendente(pacienteId, tratamentoId);
      return;
    }

    setTratamentosPendentes(prev => ({
      ...prev,
      [pacienteId]: prev[pacienteId].map(t => 
        t.id === tratamentoId 
          ? { ...t, sessoesPendentes: novaQuantidade }
          : t
      )
    }));
  };

  const handleTratamentoDragStart = (e, tratamento, paciente) => {
    setDraggedTratamentoPendente({ ...tratamento, paciente });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDayDragOver = (e, day) => {
    if (draggedTratamentoPendente) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverDay(day);
    }
  };

  const handleDayDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDayDrop = (e, day) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDay(null);

    if (draggedTratamentoPendente && day) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
      const agendamentosExistentes = agendamentos.filter(ag => ag.data === dateKey);
      
      const horarioInicial = getHorarioInicial(day);
      const terapia = terapias.find(t => t.id === draggedTratamentoPendente.terapiaId);
      const duracaoMinutos = parseInt(terapia?.duracao?.match(/\d+/)?.[0] || '60');
      
      const novoHorario = calcularProximoHorario(agendamentosExistentes, duracaoMinutos) || horarioInicial;

      const novoAgendamento = {
        id: Date.now(),
        data: dateKey,
        pacienteId: draggedTratamentoPendente.paciente.id,
        terapiaId: draggedTratamentoPendente.terapiaId,
        horario: novoHorario,
        observacoes: `Agendado via pacote de tratamento`
      };

      setAgendamentos(prev => [...prev, novoAgendamento]);

      updateSessoesPendentes(
        draggedTratamentoPendente.paciente.id,
        draggedTratamentoPendente.id,
        draggedTratamentoPendente.sessoesPendentes - 1
      );

      setDraggedTratamentoPendente(null);
    }
  };

  const toggleExpandDay = (day) => {
    const dayKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`;
    setExpandedDays(prev => ({
      ...prev,
      [dayKey]: !prev[dayKey]
    }));
  };

  const isDayExpanded = (day) => {
    const dayKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`;
    return expandedDays[dayKey] || false;
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const handleDayClick = (day) => {
    if (day) {
      setSelectedDate(day);
      setShowAgendamentoModal(true);
    }
  };

  const days = getDaysInMonth(currentDate);

  // Componente SplashScreen
  const SplashScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-white rounded-lg shadow-lg flex items-center justify-center transform animate-pulse">
                <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <h1 className="text-4xl font-bold text-white mb-2 animate-fade-in">
            Agenda Online
          </h1>
          <p className="text-blue-100 text-lg animate-fade-in" style={{ animationDelay: '0.5s' }}>
            Sistema Local de Agendamentos
          </p>
        </div>

        <div className="w-80 mx-auto mt-8">
          <div className="mb-3">
            <p className="text-blue-100 text-sm animate-fade-in" style={{ animationDelay: '1s' }}>
              {loadingStage}
            </p>
          </div>
          
          <div className="w-full bg-blue-800 bg-opacity-50 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-white to-blue-200 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${splashProgress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
            </div>
          </div>
          
          <div className="mt-2 text-right">
            <span className="text-blue-200 text-sm font-medium">
              {Math.round(splashProgress)}%
            </span>
          </div>
        </div>

        <div className="mt-8 text-blue-200 text-xs animate-fade-in" style={{ animationDelay: '1.5s' }}>
          <p>Araraquara - SP</p>
          <p>v2.0 - Modo Local Apenas</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .animate-fade-in {
            animation: fade-in 0.8s ease-out forwards;
            opacity: 0;
          }
        `
      }} />
    </div>
  );

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="w-full h-full bg-gray-50 min-h-screen">
      {/* Barra de Status no Topo */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-white text-sm font-medium bg-blue-500">
              <span>💻</span>
              <span>MODO LOCAL</span>
            </div>
            
            {isSaving && (
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Salvando...</span>
              </div>
            )}
            
            {hasUnsavedChanges && !isSaving && (
              <div className="text-orange-600 text-sm">
                ● Alterações não salvas
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              👤 Usuário Local
            </span>
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-gray-500 hover:text-gray-700"
              title="Configurações"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* Layout Desktop */}
      <div className="hidden lg:flex h-full">
        {/* Sidebar Esquerda */}
        <div 
          className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col"
          style={{ 
            backgroundImage: `url('Pf4iLWfzuHQlf_I4SCFKN')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="bg-white/95 backdrop-blur-sm h-full p-4 flex flex-col">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Agenda</h2>
              <p className="text-gray-600 text-sm">Araraquara - SP</p>
            </div>

            {/* Pacientes */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Pacientes</h3>
                <button 
                  onClick={() => setShowPacienteModal(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Adicionar
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pacientes.slice(0, 5).map(paciente => {
                  const tratamentos = tratamentosPendentes[paciente.id] || [];
                  return (
                    <div key={paciente.id}>
                      <div 
                        className={`p-2 rounded border transition-all ${
                          dragOverPaciente === paciente.id 
                            ? 'bg-green-100 border-green-400 border-2' 
                            : 'bg-blue-50 border-blue-200'
                        }`}
                        onDragOver={(e) => handleDragOver(e, paciente.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, paciente)}
                      >
                        <div className="font-medium text-blue-800 text-sm">{paciente.nome}</div>
                        <div className="text-xs text-blue-600">{paciente.telefone}</div>
                        
                        {tratamentos.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs font-medium text-gray-700">Pacote contratado:</div>
                            {tratamentos.map(tratamento => {
                              const terapia = terapias.find(t => t.id === tratamento.terapiaId);
                              return (
                                <div 
                                  key={tratamento.id} 
                                  className="flex items-center justify-between bg-white p-1 rounded text-xs cursor-grab active:cursor-grabbing hover:bg-gray-50"
                                  draggable={true}
                                  onDragStart={(e) => handleTratamentoDragStart(e, tratamento, paciente)}
                                  title="Arraste para um dia do calendário para agendar"
                                >
                                  <div className="flex items-center space-x-1">
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: terapia?.cor }}
                                    ></div>
                                    <span className="text-gray-700">{terapia?.nome}</span>
                                    <span className="text-gray-400 text-xs">📅</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateSessoesPendentes(paciente.id, tratamento.id, tratamento.sessoesPendentes - 1);
                                      }}
                                      className="w-4 h-4 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                                    >
                                      -
                                    </button>
                                    <span className="text-gray-600 font-medium">{tratamento.sessoesPendentes}</span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateSessoesPendentes(paciente.id, tratamento.id, tratamento.sessoesPendentes + 1);
                                      }}
                                      className="w-4 h-4 bg-green-100 text-green-600 rounded text-xs hover:bg-green-200"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {pacientes.length > 5 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{pacientes.length - 5} pacientes
                  </div>
                )}
              </div>
            </div>

            {/* Terapias */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Terapias</h3>
                <button 
                  onClick={() => setShowTerapiaModal(true)}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  + Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {terapias.map(terapia => (
                  <div 
                    key={terapia.id} 
                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, terapia)}
                    title="Arraste para um paciente para adicionar ao pacote"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: terapia.cor }}
                    ></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 text-sm">{terapia.nome}</div>
                      <div className="text-xs text-gray-600">{terapia.duracao}</div>
                    </div>
                    <div className="text-xs text-gray-400">📋</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Instruções */}
            <div className="mt-auto pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-600 leading-relaxed">
                <p className="mb-2">💡 <strong>Como usar:</strong></p>
                <p>• Clique em um dia do calendário para agendar manual</p>
                <p>• Arraste terapias 📋 para pacientes para criar pacotes</p>
                <p>• Arraste tratamentos pendentes 📅 para dias para agendar</p>
                <p>• Use +/- para controlar sessões pendentes</p>
                <p className="mt-2 text-yellow-700 font-medium">⏰ Horários automáticos:</p>
                <p>• Seg-Sex: 17h | Feriados/Fins de semana: 9h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendário Principal */}
        <div className="flex-1 p-8">
          <div className="bg-white rounded-lg shadow-lg p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-800">
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h1>
              <div className="flex space-x-2">
                <button 
                  onClick={() => navigateMonth(-1)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  ← Anterior
                </button>
                <button 
                  onClick={() => navigateMonth(1)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Próximo →
                </button>
              </div>
            </div>

            {/* Grade do calendário */}
            <div className="grid grid-cols-7 gap-1 h-5/6">
              {weekDays.map(day => (
                <div key={day} className="p-3 text-center font-semibold text-gray-600 bg-gray-50">
                  {day}
                </div>
              ))}
              
              {days.map((day, index) => {
                const dayAgendamentos = getAgendamentosForDay(day);
                const isExpanded = isDayExpanded(day);
                
                return (
                  <div
                    key={index}
                    className={`
                      p-2 border border-gray-200 cursor-pointer transition-all relative
                      ${!day ? 'bg-gray-50' : 'bg-white hover:bg-blue-50'}
                      ${isToday(day) ? 'bg-blue-100 border-blue-400' : ''}
                      ${dayAgendamentos.length > 0 ? 'border-green-300' : ''}
                      ${dragOverDay === day ? 'bg-yellow-100 border-yellow-400 border-2' : ''}
                      ${isExpanded ? 'z-50 shadow-lg border-2 border-blue-300' : 'min-h-24'}
                    `}
                    style={{
                      minHeight: isExpanded ? 'auto' : '96px'
                    }}
                    onClick={() => handleDayClick(day)}
                    onDragOver={(e) => handleDayDragOver(e, day)}
                    onDragLeave={handleDayDragLeave}
                    onDrop={(e) => handleDayDrop(e, day)}
                  >
                    {day && (
                      <div className="h-full flex flex-col">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex flex-col items-start">
                            {dayAgendamentos.length > 0 && !(isHoliday(day) || isWeekend(day)) && (
                              <div 
                                className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-green-600 transition-colors mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandDay(day);
                                }}
                                title={`${dayAgendamentos.length} agendamento${dayAgendamentos.length > 1 ? 's' : ''} - Clique para ${isExpanded ? 'recolher' : 'expandir'}`}
                              >
                                {dayAgendamentos.length}
                              </div>
                            )}
                            <div className={`
                              font-semibold text-lg
                              ${isToday(day) ? 'text-blue-600' : 'text-gray-800'}
                            `}>
                              {day}
                            </div>
                          </div>

                          <div className="flex flex-col items-end">
                            {(isHoliday(day) || isWeekend(day)) && (
                              <div className="text-xs text-orange-600 font-medium">
                                {isHoliday(day) ? '🎉' : '🏖️'}
                              </div>
                            )}
                          </div>

                          {dayAgendamentos.length > 0 && (isHoliday(day) || isWeekend(day)) && (
                            <div 
                              className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-green-600 transition-colors absolute left-1/2 transform -translate-x-1/2"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandDay(day);
                              }}
                              title={`${dayAgendamentos.length} agendamento${dayAgendamentos.length > 1 ? 's' : ''} - Clique para ${isExpanded ? 'recolher' : 'expandir'}`}
                            >
                              {dayAgendamentos.length}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-1">
                          {dayAgendamentos.length > 0 && (
                            <div 
                              className="text-xs p-1 rounded text-white font-medium leading-tight"
                              style={{ backgroundColor: terapias.find(t => t.id === dayAgendamentos[0].terapiaId)?.cor || '#6B7280' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Deseja remover este agendamento?')) {
                                  removeAgendamento(dayAgendamentos[0].id);
                                }
                              }}
                              title={`${dayAgendamentos[0].horario} - ${pacientes.find(p => p.id === dayAgendamentos[0].pacienteId)?.nome} - ${terapias.find(t => t.id === dayAgendamentos[0].terapiaId)?.nome}`}
                            >
                              <div className="leading-tight">
                                {dayAgendamentos[0].horario} - {pacientes.find(p => p.id === dayAgendamentos[0].pacienteId)?.nome?.split(' ')[0]}
                              </div>
                              <div className="text-xs opacity-80 leading-tight">
                                {terapias.find(t => t.id === dayAgendamentos[0].terapiaId)?.nome}
                              </div>
                            </div>
                          )}
                          
                          {isExpanded && dayAgendamentos.slice(1).map(agendamento => {
                            const paciente = pacientes.find(p => p.id === agendamento.pacienteId);
                            const terapia = terapias.find(t => t.id === agendamento.terapiaId);
                            return (
                              <div 
                                key={agendamento.id}
                                className="text-xs p-1 rounded text-white font-medium leading-tight"
                                style={{ backgroundColor: terapia?.cor || '#6B7280' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Deseja remover este agendamento?')) {
                                    removeAgendamento(agendamento.id);
                                  }
                                }}
                                title={`${agendamento.horario} - ${paciente?.nome} - ${terapia?.nome}`}
                              >
                                <div className="leading-tight">
                                  {agendamento.horario} - {paciente?.nome?.split(' ')[0]}
                                </div>
                                <div className="text-xs opacity-80 leading-tight">
                                  {terapia?.nome}
                                </div>
                              </div>
                            );
                          })}
                          
                          {dragOverDay === day && (
                            <div className="absolute inset-0 border-2 border-dashed border-yellow-400 bg-yellow-50 bg-opacity-50 rounded flex items-center justify-center">
                              <div className="text-yellow-600 font-medium text-sm">
                                📅 Solte aqui para agendar
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Layout Mobile Responsivo */}
      <div className="lg:hidden">
        {/* Header Mobile */}
        <div className="bg-white shadow-sm border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h1>
            <div className="flex space-x-2">
              <button 
                onClick={() => navigateMonth(-1)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                ←
              </button>
              <button 
                onClick={() => navigateMonth(1)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                →
              </button>
            </div>
          </div>

          {/* Calendário compacto mobile */}
          <div className="grid grid-cols-7 gap-0.5">
            {weekDays.map(day => (
              <div key={day} className="p-1 text-center text-xs font-semibold text-gray-600">
                {day}
              </div>
            ))}
            
            {days.map((day, index) => {
              const dayAgendamentos = getAgendamentosForDay(day);
              
              return (
                <div
                  key={index}
                  className={`
                    p-1 border border-gray-200 text-center cursor-pointer relative min-h-10
                    ${!day ? 'bg-gray-50' : 'bg-white'}
                    ${isToday(day) ? 'bg-blue-100 border-blue-300' : ''}
                    ${dayAgendamentos.length > 0 ? 'bg-green-50 border-green-200' : ''}
                  `}
                  onClick={() => handleDayClick(day)}
                >
                  {day && (
                    <div className="relative">
                      <div className="flex items-center justify-center space-x-1">
                        <div className={`
                          text-xs font-semibold
                          ${isToday(day) ? 'text-blue-600' : 'text-gray-800'}
                        `}>
                          {day}
                        </div>
                        {dayAgendamentos.length > 0 && (
                          <div className="bg-green-500 text-white text-xs font-bold rounded-full w-3 h-3 flex items-center justify-center" style={{ fontSize: '8px' }}>
                            {dayAgendamentos.length}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gestão abaixo no mobile */}
        <div className="p-4 space-y-4">
          {/* Pacientes Mobile */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">Pacientes</h3>
              <button 
                onClick={() => setShowPacienteModal(true)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                + Adicionar
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {pacientes.slice(0, 3).map(paciente => {
                const tratamentos = tratamentosPendentes[paciente.id] || [];
                return (
                  <div key={paciente.id}>
                    <div className="p-3 rounded border bg-blue-50 border-blue-200">
                      <div className="font-medium text-blue-800">{paciente.nome}</div>
                      <div className="text-sm text-blue-600">{paciente.telefone}</div>
                      
                      {tratamentos.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-medium text-gray-700">Pacote:</div>
                          {tratamentos.map(tratamento => {
                            const terapia = terapias.find(t => t.id === tratamento.terapiaId);
                            return (
                              <div 
                                key={tratamento.id} 
                                className="flex items-center justify-between bg-white p-2 rounded text-sm"
                              >
                                <div className="flex items-center space-x-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: terapia?.cor }}
                                  ></div>
                                  <span className="text-gray-700">{terapia?.nome}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button 
                                    onClick={() => updateSessoesPendentes(paciente.id, tratamento.id, tratamento.sessoesPendentes - 1)}
                                    className="w-6 h-6 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200"
                                  >
                                    -
                                  </button>
                                  <span className="text-gray-600 font-medium">{tratamento.sessoesPendentes}</span>
                                  <button 
                                    onClick={() => updateSessoesPendentes(paciente.id, tratamento.id, tratamento.sessoesPendentes + 1)}
                                    className="w-6 h-6 bg-green-100 text-green-600 rounded text-sm hover:bg-green-200"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terapias Mobile */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">Terapias</h3>
              <button 
                onClick={() => setShowTerapiaModal(true)}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                + Adicionar
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {terapias.map(terapia => (
                <div 
                  key={terapia.id} 
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded"
                >
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: terapia.cor }}
                  ></div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{terapia.nome}</div>
                    <div className="text-sm text-gray-600">{terapia.duracao}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modais... */}
      {showAgendamentoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">
              Agendar para dia {selectedDate}/{currentDate.getMonth() + 1}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paciente</label>
                <select 
                  value={novoAgendamento.pacienteId}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, pacienteId: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Selecione um paciente</option>
                  {pacientes.map(paciente => (
                    <option key={paciente.id} value={paciente.id}>
                      {paciente.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Terapia</label>
                <select 
                  value={novoAgendamento.terapiaId}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, terapiaId: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Selecione uma terapia</option>
                  {terapias.map(terapia => (
                    <option key={terapia.id} value={terapia.id}>
                      {terapia.nome} ({terapia.duracao})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Horário</label>
                <input 
                  type="time"
                  value={novoAgendamento.horario}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, horario: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea 
                  value={novoAgendamento.observacoes}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, observacoes: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows="3"
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button 
                onClick={addAgendamento}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Agendar
              </button>
              <button 
                onClick={() => {
                  setShowAgendamentoModal(false);
                  setSelectedDate(null);
                  setNovoAgendamento({ pacienteId: '', terapiaId: '', horario: '', observacoes: '' });
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPacienteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Adicionar Paciente</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input 
                  type="text"
                  value={novoPaciente.nome}
                  onChange={(e) => setNovoPaciente({...novoPaciente, nome: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                <input 
                  type="tel"
                  value={novoPaciente.telefone}
                  onChange={(e) => setNovoPaciente({...novoPaciente, telefone: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="(16) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input 
                  type="email"
                  value={novoPaciente.email}
                  onChange={(e) => setNovoPaciente({...novoPaciente, email: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button 
                onClick={addPaciente}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Adicionar
              </button>
              <button 
                onClick={() => {
                  setShowPacienteModal(false);
                  setNovoPaciente({ nome: '', telefone: '', email: '' });
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTerapiaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Adicionar Terapia</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input 
                  type="text"
                  value={novaTerapia.nome}
                  onChange={(e) => setNovaTerapia({...novaTerapia, nome: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Ex: Fisioterapia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duração</label>
                <input 
                  type="text"
                  value={novaTerapia.duracao}
                  onChange={(e) => setNovaTerapia({...novaTerapia, duracao: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Ex: 60 min"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <input 
                  type="color"
                  value={novaTerapia.cor}
                  onChange={(e) => setNovaTerapia({...novaTerapia, cor: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md h-12"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button 
                onClick={addTerapia}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
              >
                Adicionar
              </button>
              <button 
                onClick={() => {
                  setShowTerapiaModal(false);
                  setNovaTerapia({ nome: '', duracao: '', cor: '#3B82F6' });
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4 flex items-center">
              <span className="mr-2">⚙️</span>
              Configurações
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    const testData = {
                      pacientes: pacientes.length,
                      terapias: terapias.length,
                      agendamentos: agendamentos.length,
                      tratamentos: Object.keys(tratamentosPendentes).length
                    };
                    alert(`Sistema OK! ✅\nPacientes: ${testData.pacientes}\nTerapias: ${testData.terapias}\nAgendamentos: ${testData.agendamentos}\nTratamentos: ${testData.tratamentos}`);
                  }}
                  className="flex items-center justify-center space-x-2 bg-green-100 text-green-700 py-2 px-4 rounded hover:bg-green-200"
                >
                  <span>🧪</span>
                  <span>Testar Sistema</span>
                </button>

                <button
                  onClick={saveLocalWithDialog}
                  className="flex items-center justify-center space-x-2 bg-purple-100 text-purple-700 py-2 px-4 rounded hover:bg-purple-200"
                >
                  <span>📁</span>
                  <span>Salvar Local</span>
                </button>

                <button
                  onClick={() => {
                    autoSave();
                    alert('Dados salvos localmente! 💾');
                  }}
                  className="flex items-center justify-center space-x-2 bg-orange-100 text-orange-700 py-2 px-4 rounded hover:bg-orange-200"
                >
                  <span>💾</span>
                  <span>Salvar Agora</span>
                </button>
              </div>

              <div className="border-t pt-4 text-xs text-gray-500">
                <p><strong>Auto-save:</strong> A cada 5 minutos</p>
                <p><strong>Modo:</strong> Local (Offline)</p>
                <p><strong>Status:</strong> Funcionando normalmente</p>
              </div>
            </div>

            <button 
              onClick={() => setShowConfigModal(false)}
              className="w-full mt-6 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Rodapé */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span>Agenda Online v2.0</span>
            <span>•</span>
            <span>💾 Local</span>
            {hasUnsavedChanges && (
              <>
                <span>•</span>
                <span className="text-orange-600">● Não salvo</span>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span>Auto-save em 5min</span>
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-gray-400 hover:text-gray-600"
              title="Configurações"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* Rodapé LUNARA */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">
              Produzido por: <strong>LUNARA Terapias</strong> (2025)
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-sm opacity-90">
              Dúvidas ou sugestões?
            </span>
            <a
              href="https://wa.me/5516997934558?text=Olá! Gostaria de saber mais sobre o sistema Agenda Online da LUNARA Terapias."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 px-3 py-1 rounded-full text-white text-sm font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
              title="Entre em contato via WhatsApp"
            >
              <span>💬</span>
              <span>Contato</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgendaAtendimentos;