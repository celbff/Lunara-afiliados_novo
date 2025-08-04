// routes/affiliates.js
// Rotas para afiliados - Lunara Afiliados

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const { pool, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// =============================================
// VALIDAÇÕES
// =============================================

const affiliateRegistrationValidation = [
  body('name')
    .notEmpty()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email deve ser válido'),
  body('phone')
    .matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/)
    .withMessage('Telefone deve estar no formato (XX) XXXXX-XXXX'),
  body('commission_rate')
    .optional()
    .isFloat({ min: 1, max: 30 })
    .withMessage('Taxa de comissão deve estar entre 1% e 30%')
];

const profileUpdateValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('phone')
    .optional()
    .matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/)
    .withMessage('Telefone deve estar no formato (XX) XXXXX-XXXX'),
  body('pix_key')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Chave PIX inválida'),
  body('bank_account')
    .optional()
    .isObject()
    .withMessage('Dados bancários devem ser um objeto'),
  body('marketing_materials')
    .optional()
    .isArray()
    .withMessage('Materiais de marketing devem ser uma lista')
];

// =============================================
// ROTAS PÚBLICAS
// =============================================

// POST /api/affiliates/register - Registro de novo afiliado
router.post('/register', affiliateRegistrationValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { name, email, phone, commission_rate = 10 } = req.body;

    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Este email já está cadastrado'
      });
    }

    const result = await transaction(async (client) => {
      // Criar usuário
      const userResult = await client.query(`
        INSERT INTO users (name, email, phone, role, status, password_hash)
        VALUES ($1, $2, $3, 'afiliado', 'pendente', 'TEMP_HASH')
        RETURNING id, name, email, phone, role, status, created_at
      `, [name, email, phone]);

      const user = userResult.rows[0];

      // Gerar código de afiliado único
      let affiliateCode;
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        affiliateCode = `LUN${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        const existingCode = await client.query(
          'SELECT id FROM affiliates WHERE affiliate_code = $1',
          [affiliateCode]
        );

        if (existingCode.rows.length === 0) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error('Erro ao gerar código de afiliado único');
      }

      // Criar registro de afiliado
      const affiliateResult = await client.query(`
        INSERT INTO affiliates (
          user_id, 
          affiliate_code, 
          commission_rate, 
          status,
          total_earnings,
          total_referrals
        )
        VALUES ($1, $2, $3, 'ativo', 0, 0)
        RETURNING *
      `, [user.id, affiliateCode, commission_rate]);

      const affiliate = affiliateResult.rows[0];

      // Criar perfil básico
      await client.query(`
        INSERT INTO profiles (user_id, bio)
        VALUES ($1, 'Afiliado Lunara')
      `, [user.id]);

      return {
        user,
        affiliate
      };
    });

    logger.info(`Novo afiliado registrado: ${email} - Código: ${result.affiliate.affiliate_code}`);

    res.status(201).json({
      success: true,
      message: 'Afiliado registrado com sucesso! Verifique seu email para ativar a conta.',
      data: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        affiliate_code: result.affiliate.affiliate_code,
        commission_rate: result.affiliate.commission_rate,
        status: result.user.status
      }
    });

  } catch (error) {
    next(error);
  }
});

// =============================================
// ROTAS AUTENTICADAS
// =============================================

// GET /api/affiliates - Listar afiliados (admin apenas)
router.get('/', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    // Construir query
    let baseQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status as user_status,
        u.created_at,
        a.affiliate_code,
        a.commission_rate,
        a.total_earnings,
        a.total_referrals,
        a.status as affiliate_status
      FROM users u
      INNER JOIN affiliates a ON u.id = a.user_id
      WHERE u.role = 'afiliado'
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      INNER JOIN affiliates a ON u.id = a.user_id
      WHERE u.role = 'afiliado'
    `;

    let queryParams = [];
    let paramIndex = 1;

    // Filtros
    if (search) {
      const searchCondition = ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR a.affiliate_code ILIKE $${paramIndex})`;
      baseQuery += searchCondition;
      countQuery += searchCondition;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      const statusCondition = ` AND u.status = $${paramIndex}`;
      baseQuery += statusCondition;
      countQuery += statusCondition;
      queryParams.push(status);
      paramIndex++;
    }

    // Ordenação
    const validSortFields = {
      name: 'u.name',
      email: 'u.email',
      created_at: 'u.created_at',
      total_earnings: 'a.total_earnings',
      total_referrals: 'a.total_referrals',
      commission_rate: 'a.commission_rate'
    };

    const sortField = validSortFields[sort] || 'u.created_at';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const finalParams = [...queryParams, limit, offset];

    // Executar queries
    const [affiliatesResult, countResult] = await Promise.all([
      pool.query(baseQuery, finalParams),
      pool.query(countQuery, queryParams)
    ]);

    const affiliates = affiliatesResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        affiliates,
        pagination: {
          current: parseInt(page),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/affiliates/:id - Obter afiliado específico
router.get('/:id', authenticate, param('id').isInt(), async (req, res, next) => {
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

    // Verificar permissão (próprio afiliado ou admin)
    if (req.user.role !== 'admin' && req.user.id != id) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Buscar afiliado
    const affiliateResult = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status as user_status,
        u.created_at,
        u.updated_at,
        u.last_login,
        a.affiliate_code,
        a.commission_rate,
        a.total_earnings,
        a.total_referrals,
        a.status as affiliate_status,
        a.pix_key,
        a.bank_account,
        a.marketing_materials,
        p.bio
      FROM users u
      INNER JOIN affiliates a ON u.id = a.user_id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1 AND u.role = 'afiliado'
    `, [id]);

    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Afiliado não encontrado'
      });
    }

    const affiliate = affiliateResult.rows[0];

    // Buscar estatísticas recentes
    const statsResult = await pool.query(`
      SELECT 
        COUNT(c.id) as total_commissions,
        COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_commissions,
        COUNT(CASE WHEN c.status = 'paid' THEN 1 END) as paid_commissions,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN c.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN c.amount ELSE 0 END), 0) as this_month_earnings
      FROM commissions c
      WHERE c.affiliate_id = $1
    `, [id]);

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        ...affiliate,
        stats: {
          total_commissions: parseInt(stats.total_commissions) || 0,
          pending_commissions: parseInt(stats.pending_commissions) || 0,
          paid_commissions: parseInt(stats.paid_commissions) || 0,
          total_paid: parseFloat(stats.total_paid) || 0,
          pending_amount: parseFloat(stats.pending_amount) || 0,
          this_month_earnings: parseFloat(stats.this_month_earnings) || 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/affiliates/profile - Atualizar perfil do afiliado
router.put('/profile', authenticate, authorize(['afiliado']), profileUpdateValidation, async (req, res, next) => {
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
      // Atualizar dados do usuário se necessário
      const userFields = [];
      const userValues = [];
      let userParamIndex = 1;

      const allowedUserFields = ['name', 'phone'];
      
      Object.keys(updateData).forEach(key => {
        if (allowedUserFields.includes(key) && updateData[key] !== undefined) {
          userFields.push(`${key} = $${userParamIndex}`);
          userValues.push(updateData[key]);
          userParamIndex++;
        }
      });

      if (userFields.length > 0) {
        userFields.push(`updated_at = NOW()`);
        
        const userUpdateQuery = `
          UPDATE users 
          SET ${userFields.join(', ')}
          WHERE id = $${userParamIndex}
        `;
        userValues.push(userId);

        await client.query(userUpdateQuery, userValues);
      }

      // Atualizar dados do afiliado
      const affiliateFields = [];
      const affiliateValues = [];
      let affiliateParamIndex = 1;

      const allowedAffiliateFields = ['pix_key', 'bank_account', 'marketing_materials'];
      
      Object.keys(updateData).forEach(key => {
        if (allowedAffiliateFields.includes(key) && updateData[key] !== undefined) {
          affiliateFields.push(`${key} = $${affiliateParamIndex}`);
          
          if (key === 'bank_account' || key === 'marketing_materials') {
            affiliateValues.push(JSON.stringify(updateData[key]));
          } else {
            affiliateValues.push(updateData[key]);
          }
          affiliateParamIndex++;
        }
      });

      if (affiliateFields.length > 0) {
        const affiliateUpdateQuery = `
          UPDATE affiliates 
          SET ${affiliateFields.join(', ')}
          WHERE user_id = $${affiliateParamIndex}
        `;
        affiliateValues.push(userId);

        await client.query(affiliateUpdateQuery, affiliateValues);
      }

      // Buscar dados atualizados
      const updatedResult = await client.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.updated_at,
          a.affiliate_code,
          a.commission_rate,
          a.pix_key,
          a.bank_account,
          a.marketing_materials
        FROM users u
        INNER JOIN affiliates a ON u.id = a.user_id
        WHERE u.id = $1
      `, [userId]);

      return updatedResult.rows[0];
    });

    logger.info(`Perfil de afiliado atualizado: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: result
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/affiliates/:id/commissions - Obter comissões do afiliado
router.get('/:id/commissions', authenticate, param('id').isInt(), async (req, res, next) => {
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
    const {
      page = 1,
      limit = 20,
      status = '',
      date_from = '',
      date_to = '',
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    // Verificar permissão
    if (req.user.role !== 'admin' && req.user.id != id) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    const offset = (page - 1) * limit;

    // Construir query
    let baseQuery = `
      SELECT 
        c.*,
        a.appointment_date,
        a.appointment_time,
        a.type as appointment_type,
        a.price as appointment_price,
        u_patient.name as patient_name,
        u_therapist.name as therapist_name
      FROM commissions c
      LEFT JOIN appointments a ON c.appointment_id = a.id
      LEFT JOIN users u_patient ON a.patient_id = u_patient.id
      LEFT JOIN users u_therapist ON a.therapist_id = u_therapist.id
      WHERE c.affiliate_id = $1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM commissions c
      WHERE c.affiliate_id = $1
    `;

    let queryParams = [id];
    let paramIndex = 2;

    // Filtros
    if (status) {
      const statusCondition = ` AND c.status = $${paramIndex}`;
      baseQuery += statusCondition;
      countQuery += statusCondition;
      queryParams.push(status);
      paramIndex++;
    }

    if (date_from) {
      const dateFromCondition = ` AND c.created_at >= $${paramIndex}`;
      baseQuery += dateFromCondition;
      countQuery += dateFromCondition;
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      const dateToCondition = ` AND c.created_at <= $${paramIndex}`;
      baseQuery += dateToCondition;
      countQuery += dateToCondition;
      queryParams.push(date_to);
      paramIndex++;
    }

    // Ordenação
    const validSortFields = {
      created_at: 'c.created_at',
      amount: 'c.amount',
      status: 'c.status',
      appointment_date: 'a.appointment_date'
    };

    const sortField = validSortFields[sort] || 'c.created_at';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const finalParams = [...queryParams, limit, offset];

    // Executar queries
    const [commissionsResult, countResult] = await Promise.all([
      pool.query(baseQuery, finalParams),
      pool.query(countQuery, queryParams)
    ]);

    const commissions = commissionsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        commissions,
        pagination: {
          current: parseInt(page),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/affiliates/:id/stats - Obter estatísticas do afiliado
router.get('/:id/stats', authenticate, param('id').isInt(), async (req, res, next) => {
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
    const {
      period = '30', // dias
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1
    } = req.query;

    // Verificar permissão
    if (req.user.role !== 'admin' && req.user.id != id) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Estatísticas gerais
    const generalStatsResult = await pool.query(`
      SELECT 
        COUNT(c.id) as total_commissions,
        COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_commissions,
        COUNT(CASE WHEN c.status = 'paid' THEN 1 END) as paid_commissions,
        COUNT(CASE WHEN c.status = 'cancelled' THEN 1 END) as cancelled_commissions,
        COALESCE(SUM(c.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END), 0) as pending_amount,
        COALESCE(AVG(CASE WHEN c.status = 'paid' THEN c.amount ELSE NULL END), 0) as avg_commission,
        COUNT(DISTINCT a.patient_id) as unique_referrals
      FROM commissions c
      LEFT JOIN appointments a ON c.appointment_id = a.id
      WHERE c.affiliate_id = $1
    `, [id]);

    // Estatísticas por período
    let periodCondition = '';
    if (period === '7') {
      periodCondition = "AND c.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30') {
      periodCondition = "AND c.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'month') {
      periodCondition = `AND EXTRACT(YEAR FROM c.created_at) = ${year} AND EXTRACT(MONTH FROM c.created_at) = ${month}`;
    } else if (period === 'year') {
      periodCondition = `AND EXTRACT(YEAR FROM c.created_at) = ${year}`;
    }

    const periodStatsResult = await pool.query(`
      SELECT 
        COUNT(c.id) as period_commissions,
        COALESCE(SUM(c.amount), 0) as period_amount,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END), 0) as period_paid,
        COUNT(DISTINCT a.patient_id) as period_referrals
      FROM commissions c
      LEFT JOIN appointments a ON c.appointment_id = a.id
      WHERE c.affiliate_id = $1 ${periodCondition}
    `, [id]);

    // Evolução mensal (últimos 12 meses)
    const monthlyEvolutionResult = await pool.query(`
      SELECT 
        DATE_TRUNC('month', c.created_at) as month,
        COUNT(c.id) as commissions,
        COALESCE(SUM(c.amount), 0) as amount,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END), 0) as paid_amount,
        COUNT(DISTINCT a.patient_id) as referrals
      FROM commissions c
      LEFT JOIN appointments a ON c.appointment_id = a.id
      WHERE c.affiliate_id = $1 
        AND c.created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', c.created_at)
      ORDER BY month
    `, [id]);

    // Top tipos de consulta referenciados
    const topTypesResult = await pool.query(`
      SELECT 
        a.type as appointment_type,
        COUNT(c.id) as count,
        COALESCE(SUM(c.amount), 0) as total_commission
      FROM commissions c
      INNER JOIN appointments a ON c.appointment_id = a.id
      WHERE c.affiliate_id = $1 ${periodCondition}
      GROUP BY a.type
      ORDER BY count DESC
      LIMIT 5
    `, [id]);

    const generalStats = generalStatsResult.rows[0];
    const periodStats = periodStatsResult.rows[0];
    const monthlyEvolution = monthlyEvolutionResult.rows;
    const topTypes = topTypesResult.rows;

    // Calcular taxas
    const conversionRate = generalStats.unique_referrals > 0 
      ? ((generalStats.paid_commissions / generalStats.unique_referrals) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        general: {
          ...generalStats,
          total_commissions: parseInt(generalStats.total_commissions),
          pending_commissions: parseInt(generalStats.pending_commissions),
          paid_commissions: parseInt(generalStats.paid_commissions),
          cancelled_commissions: parseInt(generalStats.cancelled_commissions),
          unique_referrals: parseInt(generalStats.unique_referrals),
          total_amount: parseFloat(generalStats.total_amount),
          paid_amount: parseFloat(generalStats.paid_amount),
          pending_amount: parseFloat(generalStats.pending_amount),
          avg_commission: parseFloat(generalStats.avg_commission),
          conversion_rate: parseFloat(conversionRate)
        },
        period: {
          ...periodStats,
          period_commissions: parseInt(periodStats.period_commissions),
          period_referrals: parseInt(periodStats.period_referrals),
          period_amount: parseFloat(periodStats.period_amount),
          period_paid: parseFloat(periodStats.period_paid)
        },
        monthly_evolution: monthlyEvolution.map(evolution => ({
          month: evolution.month,
          commissions: parseInt(evolution.commissions),
          referrals: parseInt(evolution.referrals),
          amount: parseFloat(evolution.amount),
          paid_amount: parseFloat(evolution.paid_amount)
        })),
        top_types: topTypes.map(type => ({
          appointment_type: type.appointment_type,
          count: parseInt(type.count),
          total_commission: parseFloat(type.total_commission)
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/affiliates/code/:code - Validar código de afiliado (público)
router.get('/code/:code', param('code').isAlphanumeric(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Código inválido',
        errors: errors.array()
      });
    }

    const { code } = req.params;

    // Buscar afiliado pelo código
    const affiliateResult = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.status as user_status,
        a.affiliate_code,
        a.commission_rate,
        a.status as affiliate_status
      FROM users u
      INNER JOIN affiliates a ON u.id = a.user_id
      WHERE a.affiliate_code = $1 
        AND u.status = 'ativo' 
        AND a.status = 'ativo'
    `, [code.toUpperCase()]);

    if (affiliateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Código de afiliado não encontrado ou inativo'
      });
    }

    const affiliate = affiliateResult.rows[0];

    res.json({
      success: true,
      message: 'Código de afiliado válido',
      data: {
        affiliate_name: affiliate.name,
        affiliate_code: affiliate.affiliate_code,
        commission_rate: affiliate.commission_rate
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;