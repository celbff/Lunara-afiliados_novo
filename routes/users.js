// routes/users.js
// Rotas para usuários - Lunara Afiliados

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

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
    .withMessage('Timezone inválido')
];

const changePasswordValidation = [
  body('current_password')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nova senha deve conter ao menos: 1 letra minúscula, 1 maiúscula e 1 número'),
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Confirmação de senha não confere');
      }
      return true;
    })
];

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

    const user = userResult.rows[0];
    
    // Remover dados sensíveis
    const { password_hash, password_reset_token, password_reset_expires, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser
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
          
          // Para preferences, converter para JSON
          if (key === 'preferences') {
            userValues.push(JSON.stringify(updateData[key]));
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
    const bcrypt = require('bcrypt');
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

    // Estatísticas básicas
    let dashboardData = {
      user: {
        id: userId,
        name: req.user.name || 'Usuário',
        role: userRole
      },
      summary: {},
      recent_activity: [],
      notifications: []
    };

    if (userRole === 'terapeuta') {
      // Estatísticas para terapeuta
      const statsResult = await pool.query(`
        SELECT 
          COUNT(a.id) as total_appointments,
          COUNT(CASE WHEN a.status = 'agendado' THEN 1 END) as pending_appointments,
          COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE AND a.appointment_date < CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as upcoming_week,
          COALESCE(SUM(CASE WHEN a.status = 'concluido' AND a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN a.price ELSE 0 END), 0) as revenue_this_month,
          COUNT(DISTINCT a.patient_id) as total_patients
        FROM appointments a
        WHERE a.therapist_id = $1
      `, [userId]);

      const stats = statsResult.rows[0];

      dashboardData.summary = {
        total_appointments: parseInt(stats.total_appointments) || 0,
        pending_appointments: parseInt(stats.pending_appointments) || 0,
        completed_appointments: parseInt(stats.completed_appointments) || 0,
        upcoming_week: parseInt(stats.upcoming_week) || 0,
        revenue_this_month: parseFloat(stats.revenue_this_month) || 0,
        total_patients: parseInt(stats.total_patients) || 0
      };

      // Próximos agendamentos
      const upcomingResult = await pool.query(`
        SELECT 
          a.id,
          a.appointment_date,
          a.appointment_time,
          a.type,
          a.status,
          u.name as patient_name
        FROM appointments a
        LEFT JOIN users u ON a.patient_id = u.id
        WHERE a.therapist_id = $1 
          AND a.appointment_date >= CURRENT_DATE
          AND a.status IN ('agendado', 'confirmado')
        ORDER BY a.appointment_date, a.appointment_time
        LIMIT 5
      `, [userId]);

      dashboardData.recent_activity = upcomingResult.rows;

    } else if (userRole === 'afiliado') {
      // Estatísticas para afiliado
      const affiliateResult = await pool.query(`
        SELECT 
          a.affiliate_code,
          a.commission_rate,
          a.total_earnings,
          a.total_referrals,
          COALESCE(SUM(c.amount), 0) as earnings_this_month
        FROM affiliates a
        LEFT JOIN commissions c ON a.user_id = c.affiliate_id 
          AND c.created_at >= DATE_TRUNC('month', CURRENT_DATE)
          AND c.status = 'paid'
        WHERE a.user_id = $1
        GROUP BY a.affiliate_code, a.commission_rate, a.total_earnings, a.total_referrals
      `, [userId]);

      const affiliate = affiliateResult.rows[0] || {};

      dashboardData.summary = {
        affiliate_code: affiliate.affiliate_code || 'N/A',
        commission_rate: parseFloat(affiliate.commission_rate) || 0,
        total_earnings: parseFloat(affiliate.total_earnings) || 0,
        total_referrals: parseInt(affiliate.total_referrals) || 0,
        earnings_this_month: parseFloat(affiliate.earnings_this_month) || 0
      };

      // Comissões recentes
      const commissionsResult = await pool.query(`
        SELECT 
          c.id,
          c.amount,
          c.status,
          c.created_at,
          a.appointment_date,
          u.name as patient_name
        FROM commissions c
        LEFT JOIN appointments a ON c.appointment_id = a.id
        LEFT JOIN users u ON a.patient_id = u.id
        WHERE c.affiliate_id = $1
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [userId]);

      dashboardData.recent_activity = commissionsResult.rows;

    } else {
      // Usuário comum (cliente)
      const patientResult = await pool.query(`
        SELECT 
          COUNT(a.id) as total_appointments,
          COUNT(CASE WHEN a.status = 'agendado' THEN 1 END) as pending_appointments,
          COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE AND a.appointment_date < CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as upcoming_week
        FROM appointments a
        WHERE a.patient_id = $1
      `, [userId]);

      const stats = patientResult.rows[0];

      dashboardData.summary = {
        total_appointments: parseInt(stats.total_appointments) || 0,
        pending_appointments: parseInt(stats.pending_appointments) || 0,
        completed_appointments: parseInt(stats.completed_appointments) || 0,
        upcoming_week: parseInt(stats.upcoming_week) || 0
      };

      // Próximos agendamentos
      const upcomingResult = await pool.query(`
        SELECT 
          a.id,
          a.appointment_date,
          a.appointment_time,
          a.type,
          a.status,
          u.name as therapist_name
        FROM appointments a
        LEFT JOIN users u ON a.therapist_id = u.id
        WHERE a.patient_id = $1 
          AND a.appointment_date >= CURRENT_DATE
          AND a.status IN ('agendado', 'confirmado')
        ORDER BY a.appointment_date, a.appointment_time
        LIMIT 5
      `, [userId]);

      dashboardData.recent_activity = upcomingResult.rows;
    }

    // Notificações gerais (simuladas)
    dashboardData.notifications = [
      {
        id: 1,
        type: 'info',
        title: 'Bem-vindo ao sistema',
        message: 'Complete seu perfil para uma melhor experiência',
        read: false,
        created_at: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/users/notifications - Obter notificações do usuário
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unread_only = false } = req.query;

    const offset = (page - 1) * limit;

    // Construir query (simulada por enquanto)
    // Em produção, você teria uma tabela de notificações
    const notifications = [
      {
        id: 1,
        type: 'info',
        title: 'Sistema atualizado',
        message: 'Nova versão do sistema disponível com melhorias',
        read: false,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 horas atrás
      },
      {
        id: 2,
        type: 'appointment',
        title: 'Agendamento confirmado',
        message: 'Seu agendamento para amanhã às 14:00 foi confirmado',
        read: true,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 dia atrás
      }
    ];

    const filteredNotifications = unread_only === 'true' 
      ? notifications.filter(n => !n.read)
      : notifications;

    res.json({
      success: true,
      data: {
        notifications: filteredNotifications.slice(offset, offset + limit),
        pagination: {
          current: parseInt(page),
          total: filteredNotifications.length,
          totalPages: Math.ceil(filteredNotifications.length / limit),
          hasNext: (page * limit) < filteredNotifications.length,
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

    // Em produção, você atualizaria a tabela de notificações
    // UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2

    logger.info(`Notificação ${notificationId} marcada como lida pelo usuário ${userId}`);

    res.json({
      success: true,
      message: 'Notificação marcada como lida'
    });

  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/account - Deletar conta do usuário
router.delete('/account', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { confirmation } = req.body;

    // Verificar confirmação
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Para deletar sua conta, envie { "confirmation": "DELETE" }'
      });
    }

    await transaction(async (client) => {
      // Deletar dados relacionados
      await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM appointments WHERE patient_id = $1 OR therapist_id = $1', [userId]);
      await client.query('DELETE FROM profiles WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM affiliates WHERE user_id = $1', [userId]);
      
      // Deletar usuário
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    logger.info(`Conta deletada: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Conta deletada com sucesso'
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/users/search - Buscar usuários (apenas para terapeutas/admins)
router.get('/search', authenticate, authorize(['terapeuta', 'admin']), async (req, res, next) => {
  try {
    const { q, role, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query deve ter pelo menos 2 caracteres'
      });
    }

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