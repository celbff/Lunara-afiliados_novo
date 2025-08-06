// frontend-lunara/src/App.js
// App principal - Lunara Afiliados + Agenda 2.0
// Integração completa entre sistemas

import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';

// Context para autenticação
const AuthContext = createContext();

// Configuração do Axios
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Interceptor para adicionar token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Variável para controlar o refresh do token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Interceptor para tratamento de respostas
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axios(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post('/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);
          
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          processQueue(null, accessToken);
          
          // Repetir requisição original
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // Refresh falhou, fazer logout
          processQueue(refreshError, null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // Sem refresh token, redirecionar para login
        processQueue(new Error('No refresh token'), null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Provider de autenticação
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const initAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const response = await axios.get('/auth/me');
        setUser(response.data.data.user);
      }
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback(async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Erro no login'
      };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const value = useMemo(() => ({
    user,
    login,
    logout,
    isAuthenticated: !!user
  }), [user, login, logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

// Componente de rota protegida
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

// Componente de navegação
const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  const getNavItems = useCallback(() => {
    const baseItems = [
      { path: '/dashboard', label: 'Dashboard', icon: '📊' }
    ];
    
    switch (user.role) {
      case 'admin':
        return [
          ...baseItems,
          { path: '/bookings', label: 'Agendamentos', icon: '📅' },
          { path: '/therapists', label: 'Terapeutas', icon: '👨‍⚕️' },
          { path: '/affiliates', label: 'Afiliados', icon: '🤝' },
          { path: '/users', label: 'Usuários', icon: '👥' },
          { path: '/reports', label: 'Relatórios', icon: '📈' },
          { path: '/settings', label: 'Configurações', icon: '⚙️' }
        ];
      
      case 'therapist':
        return [
          ...baseItems,
          { path: '/my-schedule', label: 'Minha Agenda', icon: '📅' },
          { path: '/my-bookings', label: 'Meus Agendamentos', icon: '📋' },
          { path: '/my-services', label: 'Meus Serviços', icon: '🔧' },
          { path: '/profile', label: 'Perfil', icon: '👤' }
        ];
      
      case 'affiliate':
        return [
          ...baseItems,
          { path: '/my-referrals', label: 'Meus Referrals', icon: '👥' },
          { path: '/commissions', label: 'Comissões', icon: '💰' },
          { path: '/marketing', label: 'Material de Marketing', icon: '📢' },
          { path: '/profile', label: 'Perfil', icon: '👤' }
        ];
      
      case 'client':
        return [
          ...baseItems,
          { path: '/book-session', label: 'Agendar Sessão', icon: '📅' },
          { path: '/my-sessions', label: 'Minhas Sessões', icon: '📋' },
          { path: '/therapists', label: 'Terapeutas', icon: '👨‍⚕️' },
          { path: '/profile', label: 'Perfil', icon: '👤' }
        ];
      
      default:
        return baseItems;
    }
  }, [user.role]);

  const isActive = useCallback((path) => {
    return location.pathname === path;
  }, [location.pathname]);

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-gray-900">
              🌙 Lunara Afiliados
            </Link>
          </div>
          
          {/* Menu de navegação */}
          <div className="hidden md:flex space-x-1">
            {getNavItems().map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
          
          {/* Menu do usuário */}
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-700">
              Olá, <span className="font-medium">{user.name}</span>
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Componente de dashboard integrado
const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/dashboard');
      setDashboardData(response.data.data);
      setError(null);
    } catch (error) {
      setError(error.response?.data?.message || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
        <button 
          onClick={fetchDashboard}
          className="ml-4 text-red-700 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const renderDashboardByRole = () => {
    switch (user.role) {
      case 'admin':
        return <AdminDashboard data={dashboardData} />;
      case 'therapist':
        return <TherapistDashboard data={dashboardData} />;
      case 'affiliate':
        return <AffiliateDashboard data={dashboardData} />;
      case 'client':
        return <ClientDashboard data={dashboardData} />;
      default:
        return <div>Dashboard não disponível para este tipo de usuário</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard - {user.role === 'admin' ? 'Administrador' : 
                     user.role === 'therapist' ? 'Terapeuta' :
                     user.role === 'affiliate' ? 'Afiliado' : 'Cliente'}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Bem-vindo de volta, {user.name}!
        </p>
      </div>
      
      {renderDashboardByRole()}
    </div>
  );
};

// Dashboard específico para Admin
const AdminDashboard = ({ data }) => {
  const { overview, timeSeries, topTherapists, topAffiliates } = data;
  
  return (
    <div className="space-y-6">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total de Clientes"
          value={overview.totalClients}
          icon="👥"
          color="blue"
        />
        <MetricCard
          title="Total de Afiliados"
          value={overview.totalAffiliates}
          icon="🤝"
          color="green"
        />
        <MetricCard
          title="Total de Terapeutas"
          value={overview.totalTherapists}
          icon="👨‍⚕️"
          color="purple"
        />
        <MetricCard
          title="Receita Total"
          value={`R$ ${overview.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon="💰"
          color="yellow"
        />
      </div>
      
      {/* Gráfico de agendamentos */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Evolução de Agendamentos
        </h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          {/* Aqui seria implementado um gráfico real com Chart.js ou similar */}
          📈 Gráfico de evolução temporal dos agendamentos
          <br />
          Dados: {timeSeries.length} pontos de dados
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top terapeutas */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Top Terapeutas
          </h3>
          <div className="space-y-3">
            {topTherapists.map((therapist, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{therapist.name}</div>
                  <div className="text-sm text-gray-600">{therapist.specialty}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">R$ {therapist.revenue.toLocaleString('pt-BR')}</div>
                  <div className="text-sm text-gray-600">{therapist.totalBookings} agendamentos</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top afiliados */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Top Afiliados
          </h3>
          <div className="space-y-3">
            {topAffiliates.map((affiliate, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{affiliate.name}</div>
                  <div className="text-sm text-gray-600">{affiliate.affiliateCode}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">R$ {affiliate.commissionEarned.toLocaleString('pt-BR')}</div>
                  <div className="text-sm text-gray-600">{affiliate.totalReferrals} referrals</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard para Terapeuta
const TherapistDashboard = ({ data }) => {
  const { metrics, todayBookings, upcomingBookings } = data;
  
  return (
    <div className="space-y-6">
      {/* Métricas do terapeuta */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Agendamentos Hoje"
          value={todayBookings.length}
          icon="📅"
          color="blue"
        />
        <MetricCard
          title="Sessões Concluídas"
          value={metrics.completedBookings}
          icon="✅"
          color="green"
        />
        <MetricCard
          title="Receita Total"
          value={`R$ ${metrics.totalRevenue.toLocaleString('pt-BR')}`}
          icon="💰"
          color="yellow"
        />
        <MetricCard
          title="Clientes Únicos"
          value={metrics.uniqueClients}
          icon="👥"
          color="purple"
        />
      </div>
      
      {/* Agendamentos de hoje */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Agendamentos de Hoje
        </h3>
        {todayBookings.length > 0 ? (
          <div className="space-y-3">
            {todayBookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">{booking.client_name}</div>
                  <div className="text-sm text-gray-600">{booking.service_name}</div>
                  {booking.notes && (
                    <div className="text-sm text-gray-500 mt-1">{booking.notes}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium">{booking.scheduled_time}</div>
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            Nenhum agendamento para hoje
          </div>
        )}
      </div>
    </div>
  );
};

// Dashboard para Afiliado
const AffiliateDashboard = ({ data }) => {
  const { affiliate, metrics, recentReferrals, topServices } = data;
  
  return (
    <div className="space-y-6">
      {/* Informações do afiliado */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-blue-900">
              Seu Código de Afiliado
            </h3>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {affiliate.code}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-700">Taxa de Comissão</div>
            <div className="text-xl font-bold text-blue-600">
              {affiliate.commissionRate}%
            </div>
          </div>
        </div>
      </div>
      
      {/* Métricas do afiliado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total de Referrals"
          value={metrics.totalReferrals}
          icon="👥"
          color="blue"
        />
        <MetricCard
          title="Comissão Ganha"
          value={`R$ ${metrics.commissionEarned.toLocaleString('pt-BR')}`}
          icon="💰"
          color="green"
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${metrics.conversionRate}%`}
          icon="📈"
          color="purple"
        />
        <MetricCard
          title="Comissão Pendente"
          value={`R$ ${metrics.pendingCommissionAmount.toLocaleString('pt-BR')}`}
          icon="⏳"
          color="yellow"
        />
      </div>
      
      {/* Referrals recentes */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Referrals Recentes
        </h3>
        {recentReferrals.length > 0 ? (
          <div className="space-y-3">
            {recentReferrals.slice(0, 5).map((referral) => (
              <div key={referral.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{referral.client_name}</div>
                  <div className="text-sm text-gray-600">{referral.service_name}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">R$ {referral.affiliate_commission.toLocaleString('pt-BR')}</div>
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    referral.status === 'completed' ? 'bg-green-100 text-green-800' :
                    referral.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {referral.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            Nenhum referral ainda
          </div>
        )}
      </div>
    </div>
  );
};

// Dashboard para Cliente
const ClientDashboard = ({ data }) => {
  const { metrics, upcomingSessions, recentSessions } = data;
  
  return (
    <div className="space-y-6">
      {/* Métricas do cliente */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Próximas Sessões"
          value={metrics.upcomingSessions}
          icon="📅"
          color="blue"
        />
        <MetricCard
          title="Sessões Concluídas"
          value={metrics.completedSessions}
          icon="✅"
          color="green"
        />
        <MetricCard
          title="Total Investido"
          value={`R$ ${metrics.totalSpent.toLocaleString('pt-BR')}`}
          icon="💰"
          color="purple"
        />
        <MetricCard
          title="Terapeutas Visitados"
          value={metrics.therapistsVisited}
          icon="👨‍⚕️"
          color="yellow"
        />
      </div>
      
      {/* Próximas sessões */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Próximas Sessões
        </h3>
        {upcomingSessions.length > 0 ? (
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">{session.service_name}</div>
                  <div className="text-sm text-gray-600">
                    com {session.therapist_name} - {session.specialty}
                  </div>
                  {session.meeting_link && session.is_online && (
                    <a
                      href={session.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      🔗 Link da sessão online
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {new Date(session.scheduled_date).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-sm text-gray-600">{session.scheduled_time}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <div className="mb-4">Nenhuma sessão agendada</div>
            <Link
              to="/book-session"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Agendar Nova Sessão
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente de card de métrica
const MetricCard = ({ title, value, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red: 'bg-red-50 text-red-600 border-red-200'
  };
  
  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center">
        <div className="text-2xl mr-3">{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm font-medium">{title}</div>
        </div>
      </div>
    </div>
  );
};

// Página de login
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await login(email, password);
    
    if (result.success) {
      window.location.href = '/dashboard';
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            🌙 Lunara Afiliados
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sistema de Afiliados + Agenda 2.0
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Componente de Layout
const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Dashboard />
    </div>
  );
};

// App principal
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900">404</h1>
                <p className="text-gray-600">Página não encontrada</p>
                <Link to="/dashboard" className="text-blue-600 hover:underline">
                  Voltar ao Dashboard
                </Link>
              </div>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;