// routes/services.js
// Rotas para serviços/tipos de consulta - Lunara Afiliados

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const { pool, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// =============================================
// VALIDAÇÕES
// =============================================

const serviceValidation = [
  body('name')
    .notEmpty()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome do serviço deve ter entre 2 e 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode exceder 500 caracteres'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Preço deve ser um valor válido'),
  body('duration')
    .isInt({ min: 15, max: 480 })
    .withMessage('Duração deve estar entre 15 e 480 minutos'),
  body('category')
    .notEmpty()
    .isLength({ min: 2, max: 50 })
    .withMessage('Categoria é obrigatória'),
  body('commission_rate')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Taxa de comissão deve estar entre 0% e 50%')
];

// =============================================
// ROTAS
// =============================================

// GET /api/services - Listar todos os serviços
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      category = '',
      active_only = 'true',
      search = '',
      sort = 'name',
      order = 'asc'
    } = req.query;

    const offset = (page - 1) * limit;

    // Construir query
    let baseQuery = `
      SELECT 
        id,
        name,
        description,
        price,
        duration,
        category,
        commission_rate,
        is_active,
        created_at,
        updated_at
      FROM services
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM services
      WHERE 1=1
    `;

    let queryParams = [];
    let paramIndex = 1;

    // Filtros
    if (active_only === 'true') {
      const activeCondition = ` AND is_active = true`;
      baseQuery += activeCondition;
      countQuery += activeCondition;
    }

    if (category) {
      const categoryCondition = ` AND category = $${paramIndex}`;
      baseQuery += categoryCondition;
      countQuery += categoryCondition;
      queryParams.push(category);
      paramIndex++;
    }

    if (search) {
      const searchCondition = ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      baseQuery += searchCondition;
      countQuery += searchCondition;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Ordenação
    const validSortFields = {
      name: 'name',
      price: 'price',
      duration: 'duration',
      category: 'category',
      created_at: 'created_at'
    };

    const sortField = validSortFields[sort] || 'name';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const finalParams = [...queryParams, limit, offset];

    // Executar queries
    const [servicesResult, countResult] = await Promise.all([
      pool.query(baseQuery, finalParams),
      pool.query(countQuery, queryParams)
    ]);

    const services = servicesResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        services,
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

// GET /api/services/categories - Listar categorias de serviços
router.get('/categories', async (req, res, next) => {
  try {
    const categoriesResult = await pool.query(`
      SELECT 
        category,
        COUNT(*) as service_count,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM services 
      WHERE is_active = true
      GROUP BY category
      ORDER BY category
    `);

    res.json({
      success: true,
      data: {
        categories: categoriesResult.rows.map(cat => ({
          name: cat.category,
          service_count: parseInt(cat.service_count),
          avg_price: parseFloat(cat.avg_price) || 0,
          min_price: parseFloat(cat.min_price) || 0,
          max_price: parseFloat(cat.max_price) || 0
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/services/:id - Obter serviço específico
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

    const serviceResult = await pool.query(`
      SELECT 
        id,
        name,
        description,
        price,
        duration,
        category,
        commission_rate,
        is_active,
        created_at,
        updated_at
      FROM services
      WHERE id = $1
    `, [id]);

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Serviço não encontrado'
      });
    }

    const service = serviceResult.rows[0];

    // Buscar estatísticas do serviço
    const statsResult = await pool.query(`
      SELECT 
        COUNT(a.id) as total_appointments,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN a.status = 'cancelado' THEN 1 END) as cancelled_appointments,
        AVG(CASE WHEN a.status = 'concluido' THEN a.price ELSE NULL END) as avg_price_completed
      FROM appointments a
      WHERE a.type = $1
        AND a.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `, [service.name]);

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        ...service,
        stats: {
          total_appointments: parseInt(stats.total_appointments) || 0,
          completed_appointments: parseInt(stats.completed_appointments) || 0,
          cancelled_appointments: parseInt(stats.cancelled_appointments) || 0,
          avg_price_completed: parseFloat(stats.avg_price_completed) || 0,
          completion_rate: stats.total_appointments > 0 
            ? ((stats.completed_appointments / stats.total_appointments) * 100).toFixed(2)
            : 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/services - Criar novo serviço (admin apenas)
router.post('/', authenticate, authorize(['admin']), serviceValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const {
      name,
      description = '',
      price,
      duration,
      category,
      commission_rate = 10
    } = req.body;

    // Verificar se já existe serviço com o mesmo nome
    const existingService = await pool.query(
      'SELECT id FROM services WHERE name = $1',
      [name]
    );

    if (existingService.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Já existe um serviço com este nome'
      });
    }

    const serviceResult = await pool.query(`
      INSERT INTO services (
        name,
        description,
        price,
        duration,
        category,
        commission_rate,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [name, description, price, duration, category, commission_rate]);

    const service = serviceResult.rows[0];

    logger.info(`Novo serviço criado: ${name} por ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Serviço criado com sucesso',
      data: service
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/services/:id - Atualizar serviço (admin apenas)
router.put('/:id', authenticate, authorize(['admin']), param('id').isInt(), serviceValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Verificar se o serviço existe
    const existingService = await pool.query(
      'SELECT * FROM services WHERE id = $1',
      [id]
    );

    if (existingService.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Serviço não encontrado'
      });
    }

    // Verificar se nome já existe (se está sendo alterado)
    if (updateData.name && updateData.name !== existingService.rows[0].name) {
      const nameConflict = await pool.query(
        'SELECT id FROM services WHERE name = $1 AND id != $2',
        [updateData.name, id]
      );

      if (nameConflict.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Já existe um serviço com este nome'
        });
      }
    }

    // Construir query de atualização
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'description', 'price', 'duration', 'category', 'commission_rate'];
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo válido para atualizar'
      });
    }

    updateFields.push(`updated_at = NOW()`);
    
    const updateQuery = `
      UPDATE services 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    updateValues.push(id);

    const serviceResult = await pool.query(updateQuery, updateValues);
    const service = serviceResult.rows[0];

    logger.info(`Serviço atualizado: ${service.name} por ${req.user.email}`);

    res.json({
      success: true,
      message: 'Serviço atualizado com sucesso',
      data: service
    });

  } catch (error) {
    next(error);
  }
});

// PATCH /api/services/:id/toggle - Ativar/desativar serviço (admin apenas)
router.patch('/:id/toggle', authenticate, authorize(['admin']), param('id').isInt(), async (req, res, next) => {
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

    const serviceResult = await pool.query(`
      UPDATE services 
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Serviço não encontrado'
      });
    }

    const service = serviceResult.rows[0];
    const status = service.is_active ? 'ativado' : 'desativado';

    logger.info(`Serviço ${status}: ${service.name} por ${req.user.email}`);

    res.json({
      success: true,
      message: `Serviço ${status} com sucesso`,
      data: service
    });

  } catch (error) {
    next(error);
  }
});

// DELETE /api/services/:id - Deletar serviço (admin apenas)
router.delete('/:id', authenticate, authorize(['admin']), param('id').isInt(), async (req, res, next) => {
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

    // Verificar se existe agendamentos com este serviço
    const appointmentsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM appointments a
      INNER JOIN services s ON a.type = s.name
      WHERE s.id = $1
    `, [id]);

    const appointmentsCount = parseInt(appointmentsResult.rows[0].count);

    if (appointmentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível deletar o serviço. Existem ${appointmentsCount} agendamento(s) relacionado(s). Desative o serviço ao invés de deletá-lo.`
      });
    }

    const serviceResult = await pool.query(
      'DELETE FROM services WHERE id = $1 RETURNING name',
      [id]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Serviço não encontrado'
      });
    }

    const serviceName = serviceResult.rows[0].name;

    logger.info(`Serviço deletado: ${serviceName} por ${req.user.email}`);

    res.json({
      success: true,
      message: 'Serviço deletado com sucesso'
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/services/:id/stats - Estatísticas detalhadas do serviço
router.get('/:id/stats', authenticate, authorize(['admin', 'terapeuta']), param('id').isInt(), async (req, res, next) => {
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

    // Buscar o serviço
    const serviceResult = await pool.query(
      'SELECT name FROM services WHERE id = $1',
      [id]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Serviço não encontrado'
      });
    }

    const serviceName = serviceResult.rows[0].name;

    // Definir filtro de período
    let periodCondition = '';
    if (period === '7') {
      periodCondition = "AND a.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30') {
      periodCondition = "AND a.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'month') {
      periodCondition = `AND EXTRACT(YEAR FROM a.created_at) = ${year} AND EXTRACT(MONTH FROM a.created_at) = ${month}`;
    } else if (period === 'year') {
      periodCondition = `AND EXTRACT(YEAR FROM a.created_at) = ${year}`;
    }

    // Estatísticas gerais
    const generalStatsResult = await pool.query(`
      SELECT 
        COUNT(a.id) as total_appointments,
        COUNT(CASE WHEN a.status = 'agendado' THEN 1 END) as scheduled_appointments,
        COUNT(CASE WHEN a.status = 'confirmado' THEN 1 END) as confirmed_appointments,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN a.status = 'cancelado' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN a.status = 'faltou' THEN 1 END) as missed_appointments,
        COALESCE(SUM(a.price), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN a.status = 'concluido' THEN a.price ELSE 0 END), 0) as completed_revenue,
        COALESCE(AVG(CASE WHEN a.status = 'concluido' THEN a.price ELSE NULL END), 0) as avg_price,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        COUNT(DISTINCT a.therapist_id) as therapists_count
      FROM appointments a
      WHERE a.type = $1 ${periodCondition}
    `, [serviceName]);

    // Evolução mensal (últimos 12 meses)
    const monthlyEvolutionResult = await pool.query(`
      SELECT 
        DATE_TRUNC('month', a.created_at) as month,
        COUNT(a.id) as appointments,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed,
        COALESCE(SUM(CASE WHEN a.status = 'concluido' THEN a.price ELSE 0 END), 0) as revenue
      FROM appointments a
      WHERE a.type = $1 
        AND a.created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', a.created_at)
      ORDER BY month
    `, [serviceName]);

    // Top terapeutas
    const topTherapistsResult = await pool.query(`
      SELECT 
        u.name as therapist_name,
        COUNT(a.id) as appointments,
        COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) as completed,
        COALESCE(SUM(CASE WHEN a.status = 'concluido' THEN a.price ELSE 0 END), 0) as revenue
      FROM appointments a
      INNER JOIN users u ON a.therapist_id = u.id
      WHERE a.type = $1 ${periodCondition}
      GROUP BY u.id, u.name
      ORDER BY completed DESC, revenue DESC
      LIMIT 10
    `, [serviceName]);

    // Horários mais procurados
    const popularTimesResult = await pool.query(`
      SELECT 
        appointment_time,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'concluido' THEN 1 END) as completed
      FROM appointments
      WHERE type = $1 ${periodCondition}
      GROUP BY appointment_time
      ORDER BY count DESC
      LIMIT 10
    `, [serviceName]);

    const generalStats = generalStatsResult.rows[0];
    const monthlyEvolution = monthlyEvolutionResult.rows;
    const topTherapists = topTherapistsResult.rows;
    const popularTimes = popularTimesResult.rows;

    // Calcular taxas
    const completionRate = generalStats.total_appointments > 0 
      ? ((generalStats.completed_appointments / generalStats.total_appointments) * 100).toFixed(2)
      : 0;

    const cancellationRate = generalStats.total_appointments > 0 
      ? ((generalStats.cancelled_appointments / generalStats.total_appointments) * 100).toFixed(2)
      : 0;

    const noShowRate = generalStats.total_appointments > 0 
      ? ((generalStats.missed_appointments / generalStats.total_appointments) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        service_name: serviceName,
        period_info: {
          period,
          year: period === 'month' || period === 'year' ? parseInt(year) : null,
          month: period === 'month' ? parseInt(month) : null
        },
        general: {
          ...generalStats,
          total_appointments: parseInt(generalStats.total_appointments),
          scheduled_appointments: parseInt(generalStats.scheduled_appointments),
          confirmed_appointments: parseInt(generalStats.confirmed_appointments),
          completed_appointments: parseInt(generalStats.completed_appointments),
          cancelled_appointments: parseInt(generalStats.cancelled_appointments),
          missed_appointments: parseInt(generalStats.missed_appointments),
          unique_patients: parseInt(generalStats.unique_patients),
          therapists_count: parseInt(generalStats.therapists_count),
          total_revenue: parseFloat(generalStats.total_revenue),
          completed_revenue: parseFloat(generalStats.completed_revenue),
          avg_price: parseFloat(generalStats.avg_price),
          completion_rate: parseFloat(completionRate),
          cancellation_rate: parseFloat(cancellationRate),
          no_show_rate: parseFloat(noShowRate)
        },
        monthly_evolution: monthlyEvolution.map(evolution => ({
          month: evolution.month,
          appointments: parseInt(evolution.appointments),
          completed: parseInt(evolution.completed),
          revenue: parseFloat(evolution.revenue)
        })),
        top_therapists: topTherapists.map(therapist => ({
          therapist_name: therapist.therapist_name,
          appointments: parseInt(therapist.appointments),
          completed: parseInt(therapist.completed),
          revenue: parseFloat(therapist.revenue),
          completion_rate: therapist.appointments > 0 
            ? ((therapist.completed / therapist.appointments) * 100).toFixed(2)
            : 0
        })),
        popular_times: popularTimes.map(time => ({
          time: time.appointment_time,
          appointments: parseInt(time.count),
          completed: parseInt(time.completed),
          completion_rate: time.count > 0 
            ? ((time.completed / time.count) * 100).toFixed(2)
            : 0
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;