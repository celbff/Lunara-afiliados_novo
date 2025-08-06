// routes/therapists.js
// Rotas para terapeutas - Lunara Afiliados
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { pool, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const router = express.Router();

// =============================================
// VALIDAÇÕES
// =============================================
const createTherapistValidation = [
  body('name').isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('phone').optional().matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).withMessage('Telefone inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('specializations').isArray().withMessage('Especializações devem ser um array'),
  body('experience_years').optional().isInt({ min: 0, max: 50 }).withMessage('Anos de experiência inválidos'),
  body('license_number').optional().isLength({ max: 100 }).withMessage('Número de licença inválido'),
  body('commission_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão inválida'),
  body('working_hours').optional().isObject().withMessage('Horários de trabalho devem ser um objeto')
];

const profileUpdateValidation = [
  body('bio').optional().isLength({ max: 2000 }).withMessage('Bio não pode exceder 2000 caracteres'),
  body('specializations').optional().isArray().withMessage('Especializações devem ser uma lista'),
  body('experience_years').optional().isInt({ min: 0, max: 50 }).withMessage('Anos de experiência inválidos'),
  body('license_number').optional().isLength({ max: 100 }).withMessage('Número de licença inválido'),
  body('commission_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão deve estar entre 0 e 100%'),
  body('is_available').optional().isBoolean().withMessage('Disponibilidade deve ser true ou false'),
  body('working_hours').optional().isObject().withMessage('Horários de trabalho devem ser um objeto')
];

const workingHoursValidation = [
  body('working_hours').isArray().withMessage('Horários de trabalho devem ser um array'),
  body('working_hours.*.day_of_week').isInt({ min: 0, max: 6 }).withMessage('Dia da semana inválido'),
  body('working_hours.*.start_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário de início inválido'),
  body('working_hours.*.end_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário de término inválido')
];

const serviceValidation = [
  body('name').isLength({ min: 2, max: 100 }).withMessage('Nome do serviço inválido'),
  body('description').optional().isLength({ max: 500 }).withMessage('Descrição muito longa'),
  body('duration').isInt({ min: 15, max: 240 }).withMessage('Duração deve estar entre 15 e 240 minutos'),
  body('price').isFloat({ min: 0 }).withMessage('Preço deve ser um número positivo'),
  body('category').optional().isIn(['consulta', 'terapia', 'avaliacao', 'grupo']).withMessage('Categoria inválida'),
  body('is_online').optional().isBoolean().withMessage('Campo is_online deve ser booleano')
];

// =============================================
// FUNÇÕES AUXILIARES
// =============================================
// Formatar dados do terapeuta para resposta
const formatTherapistData = (therapist) => {
  // Garantir que specializations seja um array
  if (!therapist.specializations || typeof therapist.specializations === 'string') {
    try {
      therapist.specializations = therapist.specializations ? JSON.parse(therapist.specializations) : [];
    } catch (e) {
      therapist.specializations = [];
    }
  }
  
  // Garantir que working_hours seja um array
  if (!therapist.working_hours || typeof therapist.working_hours === 'string') {
    try {
      therapist.working_hours = therapist.working_hours ? JSON.parse(therapist.working_hours) : [];
    } catch (e) {
      therapist.working_hours = [];
    }
  }
  
  return therapist;
};

// =============================================
// ROTAS
// =============================================

// GET /api/therapists - Listar terapeutas
router.get('/', authenticate, authorize(['admin', 'affiliate']), [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString(),
  query('specialization').optional().isString(),
  query('available_only').optional().isBoolean().toBoolean(),
  query('sort').optional().isIn(['name', 'created_at', 'experience_years', 'rating']).withMessage('Ordenação inválida'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Ordem inválida')
], asyncHandler(async (req, res) => {
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
      p.license_number,
      p.is_available,
      p.rating,
      p.total_reviews,
      t.commission_rate
    FROM users u
    INNER JOIN therapists t ON u.id = t.user_id
    INNER JOIN profiles p ON u.id = p.user_id
    WHERE u.role = 'therapeuta' AND u.status = 'ativo'
  `;
  
  let countQuery = `
    SELECT COUNT(*) as total
    FROM users u
    INNER JOIN therapists t ON u.id = t.user_id
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
  
  if (available_only) {
    const availableCondition = ` AND p.is_available = true`;
    baseQuery += availableCondition;
    countQuery += availableCondition;
  }
  
  // Ordenação
  const sortFieldMapping = {
    name: 'u.name',
    created_at: 'u.created_at',
    experience_years: 'p.experience_years',
    rating: 'p.rating'
  };
  
  const sortField = sortFieldMapping[sort] || 'u.name';
  const sortOrder = order.toUpperCase();
  
  baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;
  baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  
  const finalParams = [...queryParams, limit, offset];
  
  // Executar queries
  const [therapistsResult, countResult] = await Promise.all([
    pool.query(baseQuery, finalParams),
    pool.query(countQuery, queryParams)
  ]);
  
  const therapists = therapistsResult.rows.map(formatTherapistData);
  const total = parseInt(countResult.rows[0].total);
  const totalPages = Math.ceil(total / limit);
  
  res.json({
    success: true,
    data: {
      therapists,
      pagination: {
        current: page,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// POST /api/therapists - Criar novo terapeuta (admin apenas)
router.post('/', authenticate, authorize(['admin']), createTherapistValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }
  
  const {
    name,
    email,
    phone,
    password,
    specializations,
    experience_years = 0,
    license_number,
    commission_rate = 70,
    working_hours = []
  } = req.body;
  
  const result = await transaction(async (client) => {
    // Verificar se email já existe
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      throw new ValidationError('Email já está em uso');
    }
    
    // Hash da senha
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Criar usuário
    const userResult = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, status, created_at)
      VALUES ($1, $2, $3, $4, 'terapeuta', 'ativo', NOW())
      RETURNING id, name, email, phone, created_at
    `, [name, email, phone, passwordHash]);
    
    const userId = userResult.rows[0].id;
    
    // Criar perfil
    const profileResult = await client.query(`
      INSERT INTO profiles (
        user_id, bio, specializations, experience_years, 
        license_number, is_available, created_at
      )
      VALUES ($1, '', $2, $3, $4, true, NOW())
      RETURNING *
    `, [userId, JSON.stringify(specializations), experience_years, license_number]);
    
    // Criar registro de terapeuta
    const therapistResult = await client.query(`
      INSERT INTO therapists (user_id, commission_rate, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *
    `, [userId, commission_rate]);
    
    // Inserir horários de trabalho se fornecidos
    if (working_hours.length > 0) {
      for (const wh of working_hours) {
        await client.query(`
          INSERT INTO therapist_working_hours (
            therapist_id, day_of_week, start_time, end_time, created_at
          )
          VALUES ($1, $2, $3, $4, NOW())
        `, [therapistResult.rows[0].id, wh.day_of_week, wh.start_time, wh.end_time]);
      }
    }
    
    // Retornar dados completos
    const completeResult = await client.query(`
      SELECT 
        u.id, u.name, u.email, u.phone, u.status, u.created_at,
        p.bio, p.specializations, p.experience_years, p.license_number, p.is_available,
        t.commission_rate
      FROM users u
      INNER JOIN therapists t ON u.id = t.user_id
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);
    
    return completeResult.rows[0];
  });
  
  logger.info(`Novo terapeuta criado: ${email}`);
  res.status(201).json({
    success: true,
    message: 'Terapeuta criado com sucesso',
    data: formatTherapistData(result)
  });
}));

// GET /api/therapists/:id - Obter terapeuta específico
router.get('/:id', [
  param('id').isInt().withMessage('ID inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('ID inválido', errors.array());
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
      p.license_number,
      p.is_available,
      p.rating,
      p.total_reviews,
      t.commission_rate
    FROM users u
    INNER JOIN therapists t ON u.id = t.user_id
    INNER JOIN profiles p ON u.id = p.user_id
    WHERE u.id = $1 AND u.role = 'terapeuta'
  `, [id]);
  
  if (therapistResult.rows.length === 0) {
    throw new NotFoundError('Terapeuta não encontrado');
  }
  
  const therapist = formatTherapistData(therapistResult.rows[0]);
  
  // Buscar horários de trabalho
  const workingHoursResult = await pool.query(`
    SELECT day_of_week, start_time, end_time
    FROM therapist_working_hours
    WHERE therapist_id = $1
    ORDER BY day_of_week
  `, [id]);
  
  // Buscar serviços oferecidos
  const servicesResult = await pool.query(`
    SELECT s.id, s.name, s.description, s.duration, s.price, s.category, s.is_online
    FROM therapist_services ts
    JOIN services s ON ts.service_id = s.id
    WHERE ts.therapist_id = $1 AND s.is_active = true
    ORDER BY s.name
  `, [id]);
  
  // Buscar estatísticas básicas
  const statsResult = await pool.query(`
    SELECT 
      COUNT(b.id) as total_bookings,
      COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
      AVG(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE NULL END) as avg_amount,
      COUNT(DISTINCT b.client_id) as unique_clients
    FROM bookings b
    WHERE b.therapist_id = $1
  `, [id]);
  
  res.json({
    success: true,
    data: {
      ...therapist,
      working_hours: workingHoursResult.rows,
      services: servicesResult.rows,
      stats: {
        total_bookings: parseInt(statsResult.rows[0].total_bookings) || 0,
        completed_bookings: parseInt(statsResult.rows[0].completed_bookings) || 0,
        avg_amount: parseFloat(statsResult.rows[0].avg_amount) || 0,
        unique_clients: parseInt(statsResult.rows[0].unique_clients) || 0
      }
    }
  });
}));

// PUT /api/therapists/:id - Atualizar terapeuta (admin ou próprio)
router.put('/:id', authenticate, [
  param('id').isInt().withMessage('ID inválido')
], profileUpdateValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }
  
  const { id } = req.params;
  const updateData = req.body;
  
  // Verificar permissões
  if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
    throw new AuthorizationError('Você só pode atualizar seu próprio perfil');
  }
  
  const result = await transaction(async (client) => {
    // Verificar se terapeuta existe
    const therapistCheck = await client.query(
      'SELECT user_id FROM therapists WHERE user_id = $1',
      [id]
    );
    
    if (therapistCheck.rows.length === 0) {
      throw new NotFoundError('Terapeuta não encontrado');
    }
    
    // Atualizar tabela users se necessário
    const userFields = [];
    const userValues = [];
    let userParamIndex = 1;
    
    if (updateData.name) {
      userFields.push(`name = $${userParamIndex}`);
      userValues.push(updateData.name);
      userParamIndex++;
    }
    
    if (updateData.email) {
      // Verificar se email já está em uso por outro usuário
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [updateData.email, id]
      );
      
      if (emailCheck.rows.length > 0) {
        throw new ValidationError('Email já está em uso por outro usuário');
      }
      
      userFields.push(`email = $${userParamIndex}`);
      userValues.push(updateData.email);
      userParamIndex++;
    }
    
    if (updateData.phone) {
      userFields.push(`phone = $${userParamIndex}`);
      userValues.push(updateData.phone);
      userParamIndex++;
    }
    
    if (userFields.length > 0) {
      userFields.push(`updated_at = NOW()`);
      userFields.push(`updated_at = NOW()`);
      
      const userUpdateQuery = `
        UPDATE users 
        SET ${userFields.join(', ')}
        WHERE id = $${userParamIndex}
      `;
      userValues.push(id);
      
      await client.query(userUpdateQuery, userValues);
    }
    
    // Atualizar perfil
    const profileFields = [];
    const profileValues = [];
    let profileParamIndex = 1;
    
    const allowedProfileFields = [
      'bio', 'specializations', 'experience_years', 
      'license_number', 'is_available'
    ];
    
    Object.keys(updateData).forEach(key => {
      if (allowedProfileFields.includes(key) && updateData[key] !== undefined) {
        profileFields.push(`${key} = $${profileParamIndex}`);
        
        if (key === 'specializations') {
          profileValues.push(JSON.stringify(updateData[key]));
        } else {
          profileValues.push(updateData[key]);
        }
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
      profileValues.push(id);
      
      await client.query(profileUpdateQuery, profileValues);
    }
    
    // Atualizar taxa de comissão se fornecida
    if (updateData.commission_rate !== undefined) {
      await client.query(
        'UPDATE therapists SET commission_rate = $1, updated_at = NOW() WHERE user_id = $2',
        [updateData.commission_rate, id]
      );
    }
    
    // Buscar dados atualizados
    const updatedResult = await client.query(`
      SELECT 
        u.id, u.name, u.email, u.phone, u.status, u.updated_at,
        p.bio, p.specializations, p.experience_years, p.license_number, p.is_available,
        t.commission_rate
      FROM users u
      INNER JOIN therapists t ON u.id = t.user_id
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [id]);
    
    return updatedResult.rows[0];
  });
  
  logger.info(`Perfil de terapeuta atualizado: ${req.user.email}`);
  res.json({
    success: true,
    message: 'Perfil atualizado com sucesso',
    data: formatTherapistData(result)
  });
}));

// PATCH /api/therapists/:id/status - Atualizar status do terapeuta
router.patch('/:id/status', authenticate, authorize(['admin']), [
  param('id').isInt().withMessage('ID inválido'),
  body('status').isIn(['ativo', 'inativo', 'suspenso']).withMessage('Status inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }
  
  const { id } = req.params;
  const { status } = req.body;
  
  await transaction(async (client) => {
    // Atualizar status na tabela users
    await client.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
    
    // Atualizar disponibilidade baseado no status
    const isAvailable = status === 'ativo';
    await client.query(
      'UPDATE profiles SET is_available = $1, updated_at = NOW() WHERE user_id = $2',
      [isAvailable, id]
    );
  });
  
  logger.info(`Status do terapeuta ${id} atualizado para: ${status}`);
  res.json({
    success: true,
    message: 'Status atualizado com sucesso',
    data: { status }
  });
}));

// PUT /api/therapists/:id/working-hours - Atualizar horários de trabalho
router.put('/:id/working-hours', authenticate, [
  param('id').isInt().withMessage('ID inválido')
], workingHoursValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }
  
  const { id } = req.params;
  const { working_hours } = req.body;
  
  // Verificar permissões
  if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
    throw new AuthorizationError('Você só pode atualizar seus próprios horários');
  }
  
  await transaction(async (client) => {
    // Remover horários existentes
    await client.query(
      'DELETE FROM therapist_working_hours WHERE therapist_id = $1',
      [id]
    );
    
    // Inserir novos horários
    for (const wh of working_hours) {
      await client.query(`
        INSERT INTO therapist_working_hours (
          therapist_id, day_of_week, start_time, end_time, created_at
        )
        VALUES ($1, $2, $3, $4, NOW())
      `, [id, wh.day_of_week, wh.start_time, wh.end_time]);
    }
  });
  
  logger.info(`Horários de trabalho atualizados para terapeuta: ${id}`);
  res.json({
    success: true,
    message: 'Horários de trabalho atualizados com sucesso'
  });
}));

// GET /api/therapists/:id/appointments - Obter agendamentos do terapeuta
router.get('/:id/appointments', authenticate, [
  param('id').isInt().withMessage('ID inválido'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }
  
  const { id } = req.params;
  const {
    page = 1,
    limit = 20,
    status,
    date_from,
    date_to
  } = req.query;
  
  // Verificar permissões
  if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
    throw new AuthorizationError('Você só pode ver seus próprios agendamentos');
  }
  
  const offset = (page - 1) * limit;
  
  // Construir query
  let baseQuery = `
    SELECT 
      b.id,
      b.date,
      b.start_time,
      b.end_time,
      b.status,
      b.total_amount,
      b.created_at,
      s.name as service_name,
      s.duration as service_duration,
      u.name as client_name,
      u.email as client_email
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN users u ON b.client_id = u.id
    WHERE b.therapist_id = $1
  `;
  
  let countQuery = `
    SELECT COUNT(*) as total
    FROM bookings b
    WHERE b.therapist_id = $1
  `;
  
  let queryParams = [id];
  let paramIndex = 2;
  
  // Filtros
  if (status) {
    baseQuery += ` AND b.status = $${paramIndex}`;
    countQuery += ` AND b.status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }
  
  if (date_from) {
    baseQuery += ` AND b.date >= $${paramIndex}`;
    countQuery += ` AND b.date >= $${paramIndex}`;
    queryParams.push(date_from);
    paramIndex++;
  }
  
  if (date_to) {
    baseQuery += ` AND b.date <= $${paramIndex}`;
    countQuery += ` AND b.date <= $${paramIndex}`;
    queryParams.push(date_to);
    paramIndex++;
  }
  
  baseQuery += ` ORDER BY b.date DESC, b.start_time DESC`;
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
        current: page,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// GET /api/therapists/:id/stats - Obter estatísticas do terapeuta
router.get('/:id/stats', authenticate, [
  param('id').isInt().withMessage('ID inválido'),
  query('period').optional().isIn(['7', '30', '90', 'month', 'year']).withMessage('Período inválido'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }
  
  const { id } = req.params;
  const { period = '30', year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
  
  // Verificar permissões
  if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
    throw new AuthorizationError('Você só pode ver suas próprias estatísticas');
  }
  
  // Estatísticas gerais
  const generalStatsResult = await pool.query(`
    SELECT 
      COUNT(b.id) as total_bookings,
      COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_bookings,
      COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
      COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
      COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
      COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_bookings,
      COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0) as total_revenue,
      COALESCE(AVG(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE NULL END), 0) as avg_amount,
      COUNT(DISTINCT b.client_id) as unique_clients
    FROM bookings b
    WHERE b.therapist_id = $1
  `, [id]);
  
  // Estatísticas por período
  let periodCondition = '';
  if (period === '7') {
    periodCondition = "AND b.created_at >= CURRENT_DATE - INTERVAL '7 days'";
  } else if (period === '30') {
    periodCondition = "AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'";
  } else if (period === '90') {
    periodCondition = "AND b.created_at >= CURRENT_DATE - INTERVAL '90 days'";
  } else if (period === 'month') {
    periodCondition = `AND EXTRACT(YEAR FROM b.created_at) = ${year} AND EXTRACT(MONTH FROM b.created_at) = ${month}`;
  } else if (period === 'year') {
    periodCondition = `AND EXTRACT(YEAR FROM b.created_at) = ${year}`;
  }
  
  const periodStatsResult = await pool.query(`
    SELECT 
      COUNT(b.id) as period_total,
      COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as period_completed,
      COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0) as period_revenue,
      COUNT(DISTINCT b.client_id) as period_unique_clients
    FROM bookings b
    WHERE b.therapist_id = $1 ${periodCondition}
  `, [id]);
  
  // Evolução mensal
  const monthlyEvolutionResult = await pool.query(`
    SELECT 
      DATE_TRUNC('month', b.created_at) as month,
      COUNT(b.id) as bookings,
      COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed,
      COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0) as revenue
    FROM bookings b
    WHERE b.therapist_id = $1 
      AND b.created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', b.created_at)
    ORDER BY month
  `, [id]);
  
  // Serviços mais populares
  const popularServicesResult = await pool.query(`
    SELECT 
      s.name,
      COUNT(b.id) as count,
      COALESCE(SUM(b.total_amount), 0) as revenue
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.therapist_id = $1 ${periodCondition}
    GROUP BY s.id, s.name
    ORDER BY count DESC
    LIMIT 5
  `, [id]);
  
  const generalStats = generalStatsResult.rows[0];
  const periodStats = periodStatsResult.rows[0];
  const monthlyEvolution = monthlyEvolutionResult.rows;
  const popularServices = popularServicesResult.rows;
  
  // Calcular taxas
  const completionRate = generalStats.total_bookings > 0 
    ? ((generalStats.completed_bookings / generalStats.total_bookings) * 100).toFixed(2)
    : 0;
    
  const cancellationRate = generalStats.total_bookings > 0 
    ? ((generalStats.cancelled_bookings / generalStats.total_bookings) * 100).toFixed(2)
    : 0;
  
  res.json({
    success: true,
    data: {
      general: {
        total_bookings: parseInt(generalStats.total_bookings),
        pending_bookings: parseInt(generalStats.pending_bookings),
        confirmed_bookings: parseInt(generalStats.confirmed_bookings),
        completed_bookings: parseInt(generalStats.completed_bookings),
        cancelled_bookings: parseInt(generalStats.cancelled_bookings),
        no_show_bookings: parseInt(generalStats.no_show_bookings),
        total_revenue: parseFloat(generalStats.total_revenue),
        avg_amount: parseFloat(generalStats.avg_amount),
        unique_clients: parseInt(generalStats.unique_clients),
        completion_rate: parseFloat(completionRate),
        cancellation_rate: parseFloat(cancellationRate)
      },
      period: {
        period_total: parseInt(periodStats.period_total),
        period_completed: parseInt(periodStats.period_completed),
        period_revenue: parseFloat(periodStats.period_revenue),
        period_unique_clients: parseInt(periodStats.period_unique_clients)
      },
      monthly_evolution: monthlyEvolution.map(evolution => ({
        month: evolution.month,
        bookings: parseInt(evolution.bookings),
        completed: parseInt(evolution.completed),
        revenue: parseFloat(evolution.revenue)
      })),
      popular_services: popularServices.map(service => ({
        name: service.name,
        count: parseInt(service.count),
        revenue: parseFloat(service.revenue)
      }))
    }
  });
}));

// GET /api/therapists/specializations - Listar especializações disponíveis
router.get('/specializations', asyncHandler(async (req, res) => {
  // Buscar todas as especializações únicas
  const result = await pool.query(`
    SELECT DISTINCT unnest(specializations) as specialization
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
}));

// DELETE /api/therapists/:id - Deletar terapeuta (admin apenas)
router.delete('/:id', authenticate, authorize(['admin']), [
  param('id').isInt().withMessage('ID inválido'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Motivo muito longo')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }
  
  const { id } = req.params;
  const { reason } = req.body;
  
  await transaction(async (client) => {
    // Verificar se terapeuta existe
    const therapistCheck = await client.query(
      'SELECT user_id FROM therapists WHERE user_id = $1',
      [id]
    );
    
    if (therapistCheck.rows.length === 0) {
      throw new NotFoundError('Terapeuta não encontrado');
    }
    
    // Verificar se há agendamentos futuros
    const futureBookings = await client.query(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE therapist_id = $1 AND date >= CURRENT_DATE AND status != 'cancelled'`,
      [id]
    );
    
    if (parseInt(futureBookings.rows[0].count) > 0) {
      throw new ValidationError('Não é possível deletar terapeuta com agendamentos futuros');
    }
    
    // Deletar dados relacionados
    await client.query('DELETE FROM therapist_working_hours WHERE therapist_id = $1', [id]);
    await client.query('DELETE FROM therapist_services WHERE therapist_id = $1', [id]);
    await client.query('DELETE FROM therapists WHERE user_id = $1', [id]);
    await client.query('DELETE FROM profiles WHERE user_id = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);
  });
  
  logger.info(`Terapeuta deletado: ${id}, motivo: ${reason || 'Não informado'}`);
  res.json({
    success: true,
    message: 'Terapeuta deletado com sucesso'
  });
}));

module.exports = router;