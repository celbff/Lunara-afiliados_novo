// lib/api.ts
class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    
    // Recuperar token do localStorage se existir
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('accessToken');
    }
  }

  // Método para definir o token de autenticação
  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
    }
  }

  // Método para remover o token (logout)
  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // Método genérico para requisições
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; message?: string; errors?: any[] }> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Configurar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Adicionar token de autenticação se existir
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    // Configurar opções da requisição
    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      // Verificar se a resposta é JSON antes de fazer o parse
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Se não for JSON, tratar como texto
        const text = await response.text();
        data = { success: response.ok, message: text };
      }

      // Se a resposta for 401 (Unauthorized), tentar renovar o token
      if (response.status === 401) {
        return this.handleTokenRefresh<T>(url, config);
      }
      
      return data;
    } catch (error) {
      console.error('API request error:', error);
      return { success: false, message: 'Erro na comunicação com o servidor' };
    }
  }

  // Método para lidar com a renovação de token
  private async handleTokenRefresh<T>(url: string, config: RequestInit): Promise<{ success: boolean; data?: T; message?: string; errors?: any[] }> {
    if (this.isRefreshing) {
      // Se já está renovando, aguardar a renovação
      return new Promise((resolve) => {
        this.refreshSubscribers.push((token) => {
          const headers = { ...config.headers } as Record<string, string>;
          headers['Authorization'] = `Bearer ${token}`;
          
          fetch(url, { ...config, headers })
            .then(response => response.json())
            .then(data => resolve(data))
            .catch(() => resolve({ success: false, message: 'Erro na comunicação com o servidor' }));
        });
      });
    }

    this.isRefreshing = true;
    const refreshed = await this.refreshToken();
    this.isRefreshing = false;

    if (refreshed) {
      // Notificar todos os assinantes sobre o novo token
      this.refreshSubscribers.forEach(callback => callback(this.token!));
      this.refreshSubscribers = [];
      
      // Tentar novamente com o novo token
      const headers = { ...config.headers } as Record<string, string>;
      headers['Authorization'] = `Bearer ${this.token}`;
      
      try {
        const retryResponse = await fetch(url, { ...config, headers });
        const contentType = retryResponse.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          return await retryResponse.json();
        } else {
          const text = await retryResponse.text();
          return { success: retryResponse.ok, message: text };
        }
      } catch (error) {
        console.error('Retry request error:', error);
        return { success: false, message: 'Erro na comunicação com o servidor' };
      }
    } else {
      // Se não conseguir renovar, redirecionar para login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return { success: false, message: 'Sessão expirada' };
    }
  }

  // Método para renovar o token
  private async refreshToken(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.setToken(data.data.accessToken);
        return true;
      } else {
        this.clearToken();
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearToken();
      return false;
    }
  }

  // Métodos de autenticação
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    name: string;
    email: string;
    password: string;
    userType: 'therapist' | 'affiliate' | 'patient';
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(refreshToken: string) {
    const result = await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    
    if (result.success) {
      this.clearToken();
    }
    
    return result;
  }

  async forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Métodos de usuários
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    userType?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getUser(id: number) {
    return this.request(`/users/${id}`);
  }

  async updateUser(id: number, userData: {
    name?: string;
    email?: string;
  }) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: number) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Métodos de agendamentos
  async getBookings(params?: {
    page?: number;
    limit?: number;
    therapistId?: number;
    clientId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/bookings${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  async getBooking(id: number) {
    return this.request(`/bookings/${id}`);
  }

  async createBooking(bookingData: {
    therapistId: number;
    clientId: number;
    serviceId: number;
    date: string;
    startTime: string;
    notes?: string;
  }) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  async updateBooking(id: number, bookingData: {
    therapistId?: number;
    clientId?: number;
    serviceId?: number;
    date?: string;
    startTime?: string;
    status?: string;
    notes?: string;
  }) {
    return this.request(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bookingData),
    });
  }

  async deleteBooking(id: number) {
    return this.request(`/bookings/${id}`, {
      method: 'DELETE',
    });
  }

  async updateBookingStatus(id: number, status: string) {
    return this.request(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getAvailability(params: {
    therapistId: number;
    date: string;
    serviceId?: number;
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
    return this.request(`/bookings/availability${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  // Método para mover agendamento (drag & drop)
  async moveBooking(id: number, newData: {
    therapistId?: number;
    date: string;
    startTime: string;
  }) {
    // Primeiro, obter o agendamento atual
    const currentBooking = await this.getBooking(id);
    
    if (!currentBooking.success) {
      return currentBooking;
    }
    
    // Atualizar com os novos dados
    return this.updateBooking(id, {
      therapistId: newData.therapistId,
      date: newData.date,
      startTime: newData.startTime,
    });
  }

  // Métodos de terapeutas
  async getTherapists(params?: {
    page?: number;
    limit?: number;
    search?: string;
    specialty?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/therapists${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  async getTherapist(id: number) {
    return this.request(`/therapists/${id}`);
  }

  async createTherapist(therapistData: {
    name: string;
    email: string;
    password: string;
    specialty?: string;
    bio?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    workingHours?: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
    services?: Array<{
      name: string;
      description: string;
      duration: number;
      price: number;
    }>;
  }) {
    return this.request('/therapists', {
      method: 'POST',
      body: JSON.stringify(therapistData),
    });
  }

  async updateTherapist(id: number, therapistData: {
    specialty?: string;
    bio?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    workingHours?: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
  }) {
    return this.request(`/therapists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(therapistData),
    });
  }

  async deleteTherapist(id: number) {
    return this.request(`/therapists/${id}`, {
      method: 'DELETE',
    });
  }

  async addServiceToTherapist(therapistId: number, serviceId: number) {
    return this.request(`/therapists/${therapistId}/services`, {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    });
  }

  async removeServiceFromTherapist(therapistId: number, serviceId: number) {
    return this.request(`/therapists/${therapistId}/services/${serviceId}`, {
      method: 'DELETE',
    });
  }

  // Métodos de afiliados
  async getAffiliates(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/affiliates${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  async getAffiliate(id: number) {
    return this.request(`/affiliates/${id}`);
  }

  async createAffiliate(affiliateData: {
    name: string;
    email: string;
    password: string;
    commissionRate?: number;
  }) {
    return this.request('/affiliates', {
      method: 'POST',
      body: JSON.stringify(affiliateData),
    });
  }

  async updateAffiliate(id: number, affiliateData: {
    commissionRate?: number;
  }) {
    return this.request(`/affiliates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(affiliateData),
    });
  }

  async deleteAffiliate(id: number) {
    return this.request(`/affiliates/${id}`, {
      method: 'DELETE',
    });
  }

  async getAffiliateCommissions(id: number, params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/affiliates/${id}/commissions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  // Métodos de comissões
  async getCommissions(params?: {
    page?: number;
    limit?: number;
    affiliateId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/commissions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  async getCommission(id: number) {
    return this.request(`/commissions/${id}`);
  }

  async updateCommission(id: number, commissionData: {
    status?: string;
    amount?: number;
    commissionRate?: number;
  }) {
    return this.request(`/commissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(commissionData),
    });
  }

  async payCommission(id: number) {
    return this.request(`/commissions/pay/${id}`, {
      method: 'POST',
    });
  }

  async cancelCommission(id: number) {
    return this.request(`/commissions/cancel/${id}`, {
      method: 'POST',
    });
  }

  async getCommissionsSummary(params?: {
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/commissions/summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  // Métodos de relatórios
  async getBookingsReport(params?: {
    startDate?: string;
    endDate?: string;
    therapistId?: number;
    status?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/reports/bookings${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  async getCommissionsReport(params?: {
    startDate?: string;
    endDate?: string;
    affiliateId?: number;
    status?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/reports/commissions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  async getTherapistsReport(params?: {
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/reports/therapists${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }

  async getFinancialReport(params?: {
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    return this.request(`/reports/financial${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  }
}

// Exportar uma instância única do cliente API
export const apiClient = new ApiClient();
export default ApiClient;