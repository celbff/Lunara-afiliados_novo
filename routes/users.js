// routes/users.js
// Rotas para usuários - Lunara Afiliados
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const { pool, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

// =============================================
// VALIDAÇÕES
// =============================================
const profileUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('phone')
    .optional()
    .matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/)
    .withMessage('Telefone deve estar no formato (XX) XXXXX-XXXX'),
  body('clinic_name')
    .optional()
    .isLength({ max: 150 })
    .withMessage('Nome da clínica não pode exceder 150 caracteres'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Tema deve ser light ou dark'),
  body('preferences.language')
    .optional()
    .isIn(['pt', 'en'])
    .withMessage('Idioma deve ser pt ou en'),
  body('preferences.timezone')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Timezone inválido'),
  body('preferences.notifications')
    .optional()
    .isObject()
    .withMessage('Preferências de notificações devem ser um objeto')
];

const changePasswordValidation = [
  body('current_password')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('Nova senha deve ter pelo menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Nova senha deve conter ao menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Confirmação de senha não confere');
      }
      return true;
    })
];

const accountDeletionValidation = [
  body('confirmation')
    .equals('DELETE')
    .withMessage('Confirmação deve ser exatamente "DELETE"'),
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Motivo deve ter no máximo 500 caracteres')
];

// =============================================
// FUNÇÕES AUXILIARES
// =============================================
// Buscar preferências padrão
const getDefaultPreferences = () => {
  return {
    theme: 'light',
    language: 'pt',
    timezone: 'America/Sao_Paulo',
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    calendar: {
      startOfWeek: 1, // 0 = Domingo, 1 = Segunda
      timeFormat: '24h'
    }
  };
};

// Formatar dados do usuário para resposta
const formatUserData = (user) => {
  const { password_hash, password_reset_token, password_reset_expires, ...safeUser } = user;
  
  // Garantir que preferences seja um objeto
  if (!safeUser.preferences || typeof safeUser.preferences === 'string') {
    try {
      safeUser.preferences = safeUser.preferences ? JSON.parse(safeUser.preferences) : getDefaultPreferences();
    } catch (e) {
      safeUser.preferences = getDefaultPreferences();
    }
  }
  
  return safeUser;
};

// =============================================
// ROTAS
// =============================================
// GET /api/users/profile - Obter perfil do usuário logado
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Buscar dados completos do usuário
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.clinic_name,
        u.role,
        u.status,
        u.preferences,
        u.created_at,
        u.updated_at,
        u.last_login,
        p.bio,
        p.specializations,
        p.experience_years,
        p.license_number,
        a.affiliate_code,
        a.commission_rate,
        a.total_earnings,
        a.total_referrals
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN affiliates a ON u.id = a.user_id
      WHERE u.id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const user = formatUserData(userResult.rows[0]);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/profile - Atualizar perfil do usuário logado
router.put('/profile', authenticate, profileUpdateValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const userId = req.user.id;
    const updateData = req.body;
    
    const result = await transaction(async (client) => {
      // Atualizar dados principais na tabela users
      const userFields = [];
      const userValues = [];
      let userParamIndex = 1;
      const allowedUserFields = ['name', 'phone', 'clinic_name', 'preferences'];
      
      Object.keys(updateData).forEach(key => {
        if (allowedUserFields.includes(key) && updateData[key] !== undefined) {
          userFields.push(`${key} = $${userParamIndex}`);
          
          // Para preferences, mesclar com existentes
          if (key === 'preferences') {
            // Buscar preferências atuais
            const currentPrefsResult = await client.query(
              'SELECT preferences FROM users WHERE id = $1',
              [userId]
            );
            
            const currentPrefs = currentPrefsResult.rows[0]?.preferences || {};
            const currentPrefsObj = typeof currentPrefs === 'string' 
              ? JSON.parse(currentPrefs) 
              : currentPrefs;
            
            // Mesclar preferências
            const mergedPrefs = { ...currentPrefsObj, ...updateData[key] };
            userValues.push(JSON.stringify(mergedPrefs));
          } else {
            userValues.push(updateData[key]);
          }
          userParamIndex++;
        }
      });
      
      if (userFields.length > 0) {
        userFields.push(`updated_at = NOW()`);
        
        const userUpdateQuery = `
          UPDATE users 
          SET ${userFields.join(', ')}
          WHERE id = $${userParamIndex}
          RETURNING id, name, email, phone, clinic_name, preferences, updated_at
        `;
        
        userValues.push(userId);
        const updatedUserResult = await client.query(userUpdateQuery, userValues);
        return updatedUserResult.rows[0];
      }
      
      // Se não houver campos para atualizar, retornar dados atuais
      const currentUserResult = await client.query(`
        SELECT id, name, email, phone, clinic_name, preferences, updated_at
        FROM users 
        WHERE id = $1
      `, [userId]);
      
      return currentUserResult.rows[0];
    });
    
    logger.info(`Perfil atualizado: ${req.user.email}`);
    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/change-password - Alterar senha
router.put('/change-password', authenticate, changePasswordValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const userId = req.user.id;
    const { current_password, new_password } = req.body;
    
    // Buscar usuário e verificar senha atual
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const user = userResult.rows[0];
    
    // Verificar senha atual
    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }
    
    // Gerar hash da nova senha
    const newPasswordHash = await bcrypt.hash(new_password, 12);
    
    // Atualizar senha no banco
    await pool.query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [newPasswordHash, userId]);
    
    // Invalidar todas as sessões existentes (forçar novo login)
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    
    logger.info(`Senha alterada: ${req.user.email}`);
    res.json({
      success: true,
      message: 'Senha alterada com sucesso. Faça login novamente.'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/dashboard - Dados do dashboard do usuário
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { period = '30' } = req.query; // dias
    
    // Estatísticas básicas
    let dashboardData = {
      user: {
        id: userId,
        name: req.user.name || 'Usuário',
        role: userRole
      },
      summary: {},
      recent_activity: [],
      notifications: [],
      charts: {}
    };
    
    // Calcular período para filtros
    let periodCondition = '';
    if (period === '7') {
      periodCondition = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30') {
      periodCondition = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === '90') {
      periodCondition = "AND created_at >= CURRENT_DATE - INTERVAL '90 days'";
    }
    
    if (userRole === 'terapeuta') {
      // Estatísticas para terapeuta
      const statsResult = await pool.query(`
        SELECT 
          COUNT(b.id) as total_bookings,
          COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
          COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
          COUNT(CASE WHEN b.date >= CURRENT_DATE AND b.date < CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as upcoming_week,
          COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.date >= DATE_TRUNC('month', CURRENT_DATE) THEN s.price ELSE 0 END), 0) as revenue_this_month,
          COUNT(DISTINCT b.client_id) as total_clients
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.therapist_id = $1 ${periodCondition}
      `, [userId]);
      
      const stats = statsResult.rows[0];
      dashboardData.summary = {
        total_bookings: parseInt(stats.total_bookings) || 0,
        pending_bookings: parseInt(stats.pending_bookings) || 0,
        confirmed_bookings: parseInt(stats.confirmed_bookings) || 0,
        completed_bookings: parseInt(stats.completed_bookings) || 0,
        cancelled_bookings: parseInt(stats.cancelled_bookings) || 0,
        upcoming_week: parseInt(stats.upcoming_week) || 0,
        revenue_this_month: parseFloat(stats.revenue_this_month) || 0,
        total_clients: parseInt(stats.total_clients) || 0
      };
      
      // Próximos agendamentos
      const upcomingResult = await pool.query(`
        SELECT 
          b.id,
          b.date,
          b.start_time,
          b.status,
          s.name as service_name,
          u.name as client_name
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN users u ON b.client_id = u.id
        WHERE b.therapist_id = $1 
          AND b.date >= CURRENT_DATE
          AND b.status IN ('pending', 'confirmed')
        ORDER BY b.date, b.start_time
        LIMIT 5
      `, [userId]);
      
      dashboardData.recent_activity = upcomingResult.rows;
      
      // Dados para gráficos
      // Evolução mensal
      const monthlyEvolutionResult = await pool.query(`
        SELECT 
          DATE_TRUNC('month', date) as month,
          COUNT(*) as total,
          SUM(s.price) as revenue
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.therapist_id = $1 
          AND b.date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month
      `, [userId]);
      
      dashboardData.charts.monthly_evolution = monthlyEvolutionResult.rows;
      
      // Serviços mais populares
      const popularServicesResult = await pool.query(`
        SELECT 
          s.name,
          COUNT(*) as count
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        WHERE b.therapist_id = $1 ${periodCondition}
        GROUP BY s.id, s.name
        ORDER BY count DESC
        LIMIT 5
      `, [userId]);
      
      dashboardData.charts.popular_services = popularServicesResult.rows;
      
    } else if (userRole === 'afiliado') {
      // Estatísticas para afiliado
      const affiliateResult = await pool.query(`
        SELECT 
          a.affiliate_code,
          a.commission_rate,
          a.total_earnings,
          a.total_referrals,
          COALESCE(SUM(CASE WHEN c.created_at >= DATE_TRUNC('month', CURRENT_DATE) AND c.status = 'paid' THEN c.amount ELSE 0 END), 0) as earnings_this_month,
          COALESCE(SUM(CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '30 days' AND c.status = 'paid' THEN c.amount ELSE 0 END), 0) as earnings_last_30_days
        FROM affiliates a
        LEFT JOIN commissions c ON a.id = c.affiliate_id
        WHERE a.user_id = $1
        GROUP BY a.affiliate_code, a.commission_rate, a.total_earnings, a.total_referrals
      `, [userId]);
      
      const affiliate = affiliateResult.rows[0] || {};
      dashboardData.summary = {
        affiliate_code: affiliate.affiliate_code || 'N/A',
        commission_rate: parseFloat(affiliate.commission_rate) || 0,
        total_earnings: parseFloat(affiliate.total_earnings) || 0,
        total_referrals: parseInt(affiliate.total_referrals) || 0,
        earnings_this_month: parseFloat(affiliate.earnings_this_month) || 0,
        earnings_last_30_days: parseFloat(affiliate.earnings_last_30_days) || 0
      };
      
      // Comissões recentes
      const commissionsResult = await pool.query(`
        SELECT 
          c.id,
          c.amount,
          c.status,
          c.created_at,
          b.date as booking_date,
          u.name as client_name
        FROM commissions c
        LEFT JOIN bookings b ON c.booking_id = b.id
        LEFT JOIN users u ON b.client_id = u.id
        WHERE c.affiliate_id = (SELECT id FROM affiliates WHERE user_id = $1)
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [userId]);
      
      dashboardData.recent_activity = commissionsResult.rows;
      
      // Dados para gráficos
      // Evolução mensal
      const monthlyEvolutionResult = await pool.query(`
        SELECT 
          DATE_TRUNC('month', c.created_at) as month,
          SUM(c.amount) as earnings,
          COUNT(*) as commissions
        FROM commissions c
        WHERE c.affiliate_id = (SELECT id FROM affiliates WHERE user_id = $1)
          AND c.created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', c.created_at)
        ORDER BY month
      `, [userId]);
      
      dashboardData.charts.monthly_evolution = monthlyEvolutionResult.rows;
      
    } else {
      // Usuário comum (cliente)
      const patientResult = await pool.query(`
        SELECT 
          COUNT(b.id) as total_bookings,
          COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
          COUNT(CASE WHEN b.date >= CURRENT_DATE AND b.date < CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as upcoming_week,
          COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.date >= DATE_TRUNC('month', CURRENT_DATE) THEN s.price ELSE 0 END), 0) as spent_this_month
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.client_id = $1 ${periodCondition}
      `, [userId]);
      
      const stats = patientResult.rows[0];
      dashboardData.summary = {
        total_bookings: parseInt(stats.total_bookings) || 0,
        pending_bookings: parseInt(stats.pending_bookings) || 0,
        confirmed_bookings: parseInt(stats.confirmed_bookings) || 0,
        completed_bookings: parseInt(stats.completed_bookings) || 0,
        upcoming_week: parseInt(stats.upcoming_week) || 0,
        spent_this_month: parseFloat(stats.spent_this_month) || 0
      };
      
      // Próximos agendamentos
      const upcomingResult = await pool.query(`
        SELECT 
          b.id,
          b.date,
          b.start_time,
          b.status,
          s.name as service_name,
          u.name as therapist_name
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN users u ON b.therapist_id = u.id
        WHERE b.client_id = $1 
          AND b.date >= CURRENT_DATE
          AND b.status IN ('pending', 'confirmed')
        ORDER BY b.date, b.start_time
        LIMIT 5
      `, [userId]);
      
      dashboardData.recent_activity = upcomingResult.rows;
      
      // Histórico de agendamentos
      const historyResult = await pool.query(`
        SELECT 
          b.date,
          b.status,
          s.name as service_name,
          u.name as therapist_name
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN users u ON b.therapist_id = u.id
        WHERE b.client_id = $1 
          AND b.status = 'completed'
        ORDER BY b.date DESC
        LIMIT 10
      `, [userId]);
      
      dashboardData.charts.booking_history = historyResult.rows;
    }
    
    // Notificações não lidas
    const notificationsResult = await pool.query(`
      SELECT id, type, title, message, created_at
      FROM notifications
      WHERE user_id = $1 AND read = false
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);
    
    dashboardData.notifications = notificationsResult.rows;
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/notifications - Obter notificações do usuário
router.get('/notifications', authenticate, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('unread_only').optional().isBoolean().toBoolean()
], async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;
    
    // Construir query
    let whereClause = 'WHERE user_id = $1';
    let queryParams = [userId];
    let paramIndex = 2;
    
    if (unread_only) {
      whereClause += ' AND read = false';
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM notifications ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    
    const notificationsQuery = `
      SELECT id, type, title, message, data, read, created_at
      FROM notifications ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    
    const notificationsResult = await pool.query(notificationsQuery, queryParams);
    
    res.json({
      success: true,
      data: {
        notifications: notificationsResult.rows,
        pagination: {
          current: page,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: (page * limit) < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/notifications/:id/read - Marcar notificação como lida
router.put('/notifications/:id/read', authenticate, param('id').isInt(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido',
        errors: errors.array()
      });
    }
    
    const notificationId = req.params.id;
    const userId = req.user.id;
    
    // Verificar se notificação pertence ao usuário
    const notificationCheck = await pool.query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    
    if (notificationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificação não encontrada'
      });
    }
    
    // Marcar como lida
    await pool.query(
      'UPDATE notifications SET read = true, read_at = NOW() WHERE id = $1',
      [notificationId]
    );
    
    logger.info(`Notificação ${notificationId} marcada como lida pelo usuário ${userId}`);
    
    res.json({
      success: true,
      message: 'Notificação marcada como lida'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/notifications/read-all - Marcar todas notificações como lidas
router.put('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Marcar todas as notificações não lidas como lidas
    const result = await pool.query(
      'UPDATE notifications SET read = true, read_at = NOW() WHERE user_id = $1 AND read = false RETURNING *',
      [userId]
    );
    
    logger.info(`Todas as notificações marcadas como lidas pelo usuário ${userId}. Total: ${result.rowCount}`);
    
    res.json({
      success: true,
      message: `${result.rowCount} notificações marcadas como lidas`
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/account - Deletar conta do usuário
router.delete('/account', authenticate, accountDeletionValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const userId = req.user.id;
    const { confirmation, reason } = req.body;
    
    await transaction(async (client) => {
      // Deletar dados relacionados
      await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM bookings WHERE client_id = $1 OR therapist_id = $1', [userId]);
      await client.query('DELETE FROM profiles WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM affiliates WHERE user_id = $1', [userId]);
      
      // Deletar usuário
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    });
    
    logger.info(`Conta deletada: ${req.user.email}, motivo: ${reason || 'Não informado'}`);
    
    res.json({
      success: true,
      message: 'Conta deletada com sucesso'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/search - Buscar usuários (apenas para terapeutas/admins)
router.get('/search', authenticate, authorize(['terapeuta', 'admin']), [
  query('q').isLength({ min: 2 }).withMessage('Query deve ter pelo menos 2 caracteres'),
  query('role').optional().isIn(['client', 'therapist', 'affiliate', 'admin']),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res, next) => {
  try {
    const { q, role, limit = 10 } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.clinic_name,
        u.status
      FROM users u
      WHERE (u.name ILIKE $1 OR u.email ILIKE $1 OR u.clinic_name ILIKE $1)
        AND u.status = 'ativo'
    `;
    
    let params = [`%${q}%`];
    let paramIndex = 2;
    
    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    
    // Restringir busca por role
    if (req.user.role === 'therapist') {
      // Terapeutas só podem buscar clientes
      query += ` AND u.role = 'client'`;
    }
    
    query += ` ORDER BY u.name LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Obter dados básicos de um usuário (público)
router.get('/:id', param('id').isInt(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    
    // Buscar apenas dados públicos
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.role,
        u.clinic_name,
        u.status,
        p.bio,
        p.specializations,
        p.experience_years
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1 AND u.status = 'ativo'
    `, [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: userResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;