// routes/therapists.js
// Rotas para terapeutas - Lunara Afiliados

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
  body('bio')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bio não pode exceder 1000 caracteres'),
  body('specializations')
    .optional()
    .isArray()
    .withMessage('Especializações devem ser uma lista'),
  body('experience_years')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Anos de experiência deve estar entre 0 e 50'),
  body('license_number')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Número de licença não pode exceder 100 caracteres'),
  body('commission_rate')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Taxa de comissão deve estar entre 0 e 50%'),
  body('is_available')
    .optional()
    .isBoolean()
    .withMessage('Disponibilidade deve ser true ou false')
];

// =============================================
// ROTAS
// =============================================

// GET /api/therapists - Listar terapeutas
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      specialization = '',
      available_only = false,
      sort = 'name',
      order = 'asc'
    } = req.query;

    const offset = (page - 1) * limit;

    // Construir query
    let baseQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.created_at,
        p.bio,
        p.specializations,
        p.experience_years,
        p.license_number
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE u.role = 'terapeuta' AND u.status = 'ativo'
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE u.role = 'terapeuta' AND u.status = 'ativo'
    `;

    let queryParams = [];
    let paramIndex = 1;

    // Filtros
    if (search) {
      const searchCondition = ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR p.bio ILIKE $${paramIndex})`;
      baseQuery += searchCondition;
      countQuery += searchCondition;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (specialization) {
      const specializationCondition = ` AND $${paramIndex} = ANY(p.specializations)`;
      baseQuery += specializationCondition;
      countQuery += specializationCondition;
      queryParams.push(specialization);
      paramIndex++;
    }

    // Ordenação
    const validSortFields = {
      name: 'u.name',
      created_at: 'u.created_at',
      experience_years: 'p.experience_years'
    };

    const sortField = validSortFields[sort] || 'u.name';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const finalParams = [...queryParams, limit, offset];

    // Executar queries
    const [therapistsResult, countResult] = await Promise.all([
      pool.query(baseQuery, finalParams),
      pool.query(countQuery, queryParams)
    ]);

    const therapists = therapistsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        therapists,
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

// GET /api/therapists/:id - Obter terapeuta específico
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

    // Buscar terapeuta
    const therapistResult = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.created_at,
        p.bio,
        p.specializations,
        p.experience_years,
        p.license_number
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1 AND u.role = 'terapeuta'
    `, [id]);

    if (therapistResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Terapeuta não encontrado'
      });
    }

    const therapist = therapistResult.rows[0];

    // Buscar estatísticas básicas
    const statsResult = await pool.query(`
      SELECT 
        COUNT(a.id) as total_appointments,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed_appointments,
        AVG(CASE WHEN a.status = 'concluido' THEN a.price ELSE NULL END) as avg_price
      FROM appointments a
      WHERE a.therapist_id = (
        SELECT id FROM users WHERE id = $1 AND role = 'terapeuta'
      )
    `, [id]);

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        ...therapist,
        stats: {
          total_appointments: parseInt(stats.total_appointments) || 0,
          completed_appointments: parseInt(stats.completed_appointments) || 0,
          avg_price: parseFloat(stats.avg_price) || 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/therapists/profile - Atualizar perfil do terapeuta (apenas próprio)
router.put('/profile', authenticate, authorize('terapeuta'), profileUpdateValidation, async (req, res, next) => {
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
      // Atualizar perfil na tabela profiles
      const profileFields = [];
      const profileValues = [];
      let profileParamIndex = 1;

      const allowedProfileFields = ['bio', 'specializations', 'experience_years', 'license_number'];
      
      Object.keys(updateData).forEach(key => {
        if (allowedProfileFields.includes(key) && updateData[key] !== undefined) {
          profileFields.push(`${key} = $${profileParamIndex}`);
          profileValues.push(updateData[key]);
          profileParamIndex++;
        }
      });

      if (profileFields.length > 0) {
        profileFields.push(`updated_at = NOW()`);
        
        const profileUpdateQuery = `
          UPDATE profiles 
          SET ${profileFields.join(', ')}
          WHERE user_id = $${profileParamIndex}
          RETURNING *
        `;
        profileValues.push(userId);

        await client.query(profileUpdateQuery, profileValues);
      }

      // Buscar dados atualizados
      const updatedResult = await client.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.status,
          u.created_at,
          u.updated_at,
          p.bio,
          p.specializations,
          p.experience_years,
          p.license_number,
          p.updated_at as profile_updated_at
        FROM users u
        INNER JOIN profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `, [userId]);

      return updatedResult.rows[0];
    });

    logger.info(`Perfil de terapeuta atualizado: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: result
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/therapists/:id/appointments - Obter agendamentos do terapeuta
router.get('/:id/appointments', authenticate, param('id').isInt(), async (req, res, next) => {
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
      sort = 'appointment_date',
      order = 'desc'
    } = req.query;

    // Verificar permissão (próprio terapeuta ou admin)
    if (req.user.role !== 'admin' && req.user.id != id) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você só pode ver seus próprios agendamentos.'
      });
    }

    const offset = (page - 1) * limit;

    // Construir query
    let baseQuery = `
      SELECT 
        a.*,
        u_patient.name as patient_name,
        u_patient.email as patient_email,
        u_patient.phone as patient_phone
      FROM appointments a
      LEFT JOIN users u_patient ON a.patient_id = u_patient.id
      WHERE a.therapist_id = $1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM appointments a
      WHERE a.therapist_id = $1
    `;

    let queryParams = [id];
    let paramIndex = 2;

    // Filtros
    if (status) {
      const statusCondition = ` AND a.status = $${paramIndex}`;
      baseQuery += statusCondition;
      countQuery += statusCondition;
      queryParams.push(status);
      paramIndex++;
    }

    if (date_from) {
      const dateFromCondition = ` AND a.appointment_date >= $${paramIndex}`;
      baseQuery += dateFromCondition;
      countQuery += dateFromCondition;
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      const dateToCondition = ` AND a.appointment_date <= $${paramIndex}`;
      baseQuery += dateToCondition;
      countQuery += dateToCondition;
      queryParams.push(date_to);
      paramIndex++;
    }

    // Ordenação
    const validSortFields = {
      appointment_date: 'a.appointment_date',
      created_at: 'a.created_at',
      status: 'a.status',
      price: 'a.price'
    };

    const sortField = validSortFields[sort] || 'a.appointment_date';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const finalParams = [...queryParams, limit, offset];

    // Executar queries
    const [appointmentsResult, countResult] = await Promise.all([
      pool.query(baseQuery, finalParams),
      pool.query(countQuery, queryParams)
    ]);

    const appointments = appointmentsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        appointments,
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

// GET /api/therapists/:id/stats - Obter estatísticas do terapeuta
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
        COUNT(a.id) as total_appointments,
        COUNT(CASE WHEN a.status = 'agendado' THEN 1 END) as scheduled_appointments,
        COUNT(CASE WHEN a.status = 'confirmado' THEN 1 END) as confirmed_appointments,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN a.status = 'cancelado' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN a.status = 'faltou' THEN 1 END) as no_show_appointments,
        COALESCE(SUM(CASE WHEN a.status = 'concluido' THEN a.price ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN a.status = 'concluido' THEN a.price ELSE NULL END), 0) as avg_price,
        COUNT(DISTINCT a.patient_id) as unique_patients
      FROM appointments a
      WHERE a.therapist_id = $1
    `, [id]);

    // Estatísticas por período
    let periodCondition = '';
    if (period === '7') {
      periodCondition = "AND a.appointment_date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30') {
      periodCondition = "AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'month') {
      periodCondition = `AND EXTRACT(YEAR FROM a.appointment_date) = ${year} AND EXTRACT(MONTH FROM a.appointment_date) = ${month}`;
    } else if (period === 'year') {
      periodCondition = `AND EXTRACT(YEAR FROM a.appointment_date) = ${year}`;
    }

    const periodStatsResult = await pool.query(`
      SELECT 
        COUNT(a.id) as period_total,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as period_completed,
        COALESCE(SUM(CASE WHEN a.status = 'concluido' THEN a.price ELSE 0 END), 0) as period_revenue,
        COUNT(DISTINCT a.patient_id) as period_unique_patients
      FROM appointments a
      WHERE a.therapist_id = $1 ${periodCondition}
    `, [id]);

    // Estatísticas por tipo de consulta
    const typeStatsResult = await pool.query(`
      SELECT 
        ct.name as consultation_type,
        COUNT(a.id) as count,
        COALESCE(SUM(CASE WHEN a.status = 'concluido' THEN a.price ELSE 0 END), 0) as revenue
      FROM appointments a
      INNER JOIN consultation_types ct ON a.type = ct.name
      WHERE a.therapist_id = $1 ${periodCondition}
      GROUP BY ct.name
      ORDER BY count DESC
    `, [id]);

    // Evolução mensal (últimos 12 meses)
    const monthlyEvolutionResult = await pool.query(`
      SELECT 
        DATE_TRUNC('month', a.appointment_date) as month,
        COUNT(a.id) as appointments,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed,
        COALESCE(SUM(CASE WHEN a.status = 'concluido' THEN a.price ELSE 0 END), 0) as revenue
      FROM appointments a
      WHERE a.therapist_id = $1 
        AND a.appointment_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', a.appointment_date)
      ORDER BY month
    `, [id]);

    const generalStats = generalStatsResult.rows[0];
    const periodStats = periodStatsResult.rows[0];
    const typeStats = typeStatsResult.rows;
    const monthlyEvolution = monthlyEvolutionResult.rows;

    // Calcular taxas
    const completionRate = generalStats.total_appointments > 0 
      ? ((generalStats.completed_appointments / generalStats.total_appointments) * 100).toFixed(2)
      : 0;

    const noShowRate = generalStats.total_appointments > 0
      ? ((generalStats.no_show_appointments / generalStats.total_appointments) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        general: {
          ...generalStats,
          total_appointments: parseInt(generalStats.total_appointments),
          scheduled_appointments: parseInt(generalStats.scheduled_appointments),
          confirmed_appointments: parseInt(generalStats.confirmed_appointments),
          completed_appointments: parseInt(generalStats.completed_appointments),
          cancelled_appointments: parseInt(generalStats.cancelled_appointments),
          no_show_appointments: parseInt(generalStats.no_show_appointments),
          unique_patients: parseInt(generalStats.unique_patients),
          total_revenue: parseFloat(generalStats.total_revenue),
          avg_price: parseFloat(generalStats.avg_price),
          completion_rate: parseFloat(completionRate),
          no_show_rate: parseFloat(noShowRate)
        },
        period: {
          ...periodStats,
          period_total: parseInt(periodStats.period_total),
          period_completed: parseInt(periodStats.period_completed),
          period_unique_patients: parseInt(periodStats.period_unique_patients),
          period_revenue: parseFloat(periodStats.period_revenue)
        },
        by_type: typeStats.map(stat => ({
          consultation_type: stat.consultation_type,
          count: parseInt(stat.count),
          revenue: parseFloat(stat.revenue)
        })),
        monthly_evolution: monthlyEvolution.map(evolution => ({
          month: evolution.month,
          appointments: parseInt(evolution.appointments),
          completed: parseInt(evolution.completed),
          revenue: parseFloat(evolution.revenue)
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/therapists/specializations - Listar especializações disponíveis
router.get('/specializations', async (req, res, next) => {
  try {
    // Buscar todas as especializações únicas
    const result = await pool.query(`
      SELECT DISTINCT unnest(p.specializations) as specialization
      FROM profiles p
      INNER JOIN users u ON p.user_id = u.id
      WHERE u.role = 'terapeuta' AND u.status = 'ativo'
        AND p.specializations IS NOT NULL
        AND array_length(p.specializations, 1) > 0
      ORDER BY specialization
    `);

    const specializations = result.rows.map(row => row.specialization);

    res.json({
      success: true,
      data: specializations
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;