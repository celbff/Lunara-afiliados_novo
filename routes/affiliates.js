# routes/affiliates.js

```javascript
// routes/affiliates.js
// Sistema de afiliados - Lunara Afiliados
// Gestão completa de afiliados, comissões e performance

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const moment = require('moment');

const { executeQuery, executeTransaction } = require('../config/database');
const { emailService } = require('../config/email');
const { logger, logHelpers } = require('../utils/logger');
const { authenticateToken } = require('./auth');
const { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  ConflictError,
  AuthorizationError 
} = require('../middleware/errorHandler');

const router = express.Router();

// ===== MIDDLEWARE DE AUTORIZAÇÃO =====
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthorizationError('Usuário não autenticado');
    }
    
    if (!roles.includes(req.user.role)) {
      throw new AuthorizationError('Acesso negado para este recurso');
    }
    
    next();
  };
};

// ===== VALIDAÇÕES =====
const createAffiliateValidation = [
  body('userId').isUUID().withMessage('ID do usuário inválido'),
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão deve estar entre 0 e 100'),
  body('pixKey').optional().isString().withMessage('Chave PIX inválida'),
  body('taxDocument').optional().matches(/^\d{11}$|^\d{14}$/).withMessage('CPF/CNPJ inválido'),
  body('bankDetails').optional().isObject().withMessage('Dados bancários inválidos')
];

const updateAffiliateValidation = [
  param('id').isUUID().withMessage('ID do afiliado inválido'),
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão deve estar entre 0 e 100'),
  body('pixKey').optional().isString().withMessage('Chave PIX inválida'),
  body('taxDocument').optional().matches(/^\d{11}$|^\d{14}$/).withMessage('CPF/CNPJ inválido'),
  body('bankDetails').optional().isObject().withMessage('Dados bancários inválidos'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Status inválido')
];

// ===== FUNÇÕES AUXILIARES =====

// Gerar código único de afiliado
const generateAffiliateCode = async (baseName) => {
  const baseCode = baseName.replace(/\s+/g, '').substring(0, 4).toUpperCase();
  let code = baseCode + Math.floor(1000 + Math.random() * 9000);
  
  // Verificar se código já existe
  let exists = true;
  let attempts = 0;
  
  while (exists && attempts < 10) {
    const result = await executeQuery(
      'SELECT id FROM affiliates WHERE affiliate_code = $1',
      [code]
    );
    
    if (result.rows.length === 0) {
      exists = false;
    } else {
      code = baseCode + Math.floor(1000 + Math.random() * 9000);
      attempts++;
    }
  }
  
  if (exists) {
    throw new ConflictError('Não foi possível gerar código único');
  }
  
  return code;
};

// Calcular métricas de performance
const calculateAffiliateMetrics = async (affiliateId, startDate, endDate) => {
  const metricsQuery = `
    SELECT 
      COUNT(b.id) as total_bookings,
      COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
      COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
      SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN b.status = 'completed' THEN b.affiliate_commission ELSE 0 END) as total_commission,
      AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END) as avg_booking_value,
      COUNT(DISTINCT b.client_email) as unique_clients
    FROM bookings b
    WHERE b.affiliate_id = $1
    AND b.created_at >= $2
    AND b.created_at <= $3
  `;
  
  const result = await executeQuery(metricsQuery, [affiliateId, startDate, endDate]);
  return result.rows[0];
};

// Atualizar totais do afiliado
const updateAffiliateTotals = async (affiliateId) => {
  const totalsQuery = `
    UPDATE affiliates SET
      total_referrals = (
        SELECT COUNT(*) FROM bookings 
        WHERE affiliate_id = $1
      ),
      total_earnings = (
        SELECT COALESCE(SUM(affiliate_commission), 0) FROM bookings 
        WHERE affiliate_id = $1 AND status = 'completed'
      ),
      current_balance = (
        SELECT COALESCE(SUM(affiliate_commission), 0) FROM bookings 
        WHERE affiliate_id = $1 AND status = 'completed'
      ) - (
        SELECT COALESCE(SUM(affiliate_amount), 0) FROM commissions 
        WHERE affiliate_id = $1 AND status = 'paid'
      ),
      updated_at = NOW()
    WHERE id = $1
  `;
  
  await executeQuery(totalsQuery, [affiliateId]);
};

// ===== ROTAS =====

// GET /api/affiliates - Listar afiliados
router.get('/', authenticateToken, authorize(['admin']), [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']),
  query('search').optional().isString(),
  query('sortBy').optional().isIn(['name', 'created_at', 'total_earnings', 'total_referrals']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }

  const {
    page = 1,
    limit = 20,
    status,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;
  
  // Construir filtros
  let whereConditions = ['1=1'];
  let queryParams = [];
  let paramCount = 0;

  if (status) {
    whereConditions.push(`a.status = $${++paramCount}`);
    queryParams.push(status);
  }

  if (search) {
    whereConditions.push(`(
      u.name ILIKE $${++paramCount} OR
      u.email ILIKE $${++paramCount} OR
      a.affiliate_code ILIKE $${++paramCount}
    )`);
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = whereConditions.join(' AND ');
  
  // Mapear campos de ordenação
  const sortFields = {
    name: 'u.name',
    created_at: 'a.created_at',
    total_earnings: 'a.total_earnings',
    total_referrals: 'a.total_referrals'
  };
  
  const orderBy = `${sortFields[sortBy]} ${sortOrder.toUpperCase()}`;

  const affiliatesQuery = `
    SELECT 
      a.*,
      u.name,
      u.email,
      u.phone,
      u.is_active as user_active,
      u.email_verified,
      u.created_at as user_created_at,
      COUNT(*) OVER() as total_count
    FROM affiliates a
    JOIN users u ON a.user_id = u.id
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `;

  queryParams.push(limit, offset);

  const result = await executeQuery(affiliatesQuery, queryParams);
  
  const affiliates = result.rows;
  const totalCount = affiliates.length > 0 ? parseInt(affiliates[0].total_count) : 0;
  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    success: true,
    data: {
      affiliates: affiliates.map(affiliate => ({
        id: affiliate.id,
        userId: affiliate.user_id,
        name: affiliate.name,
        email: affiliate.email,
        phone: affiliate.phone,
        affiliateCode: affiliate.affiliate_code,
        commissionRate: parseFloat(affiliate.commission_rate),
        totalReferrals: affiliate.total_referrals,
        totalEarnings: parseFloat(affiliate.total_earnings),
        currentBalance: parseFloat(affiliate.current_balance),
        status: affiliate.status,
        pixKey: affiliate.pix_key,
        taxDocument: affiliate.tax_document,
        isActive: affiliate.user_active,
        emailVerified: affiliate.email_verified,
        approvedAt: affiliate.approved_at,
        createdAt: affiliate.created_at,
        updatedAt: affiliate.updated_at
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// GET /api/affiliates/:id - Buscar afiliado específico
router.get('/:id', authenticateToken, [
  param('id').isUUID().withMessage('ID inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('ID inválido');
  }

  const affiliateId = req.params.id;

  // Verificar autorização
  if (req.user.role !== 'admin') {
    // Afiliado só pode ver seus próprios dados
    if (req.user.role === 'affiliate') {
      const checkResult = await executeQuery(
        'SELECT id FROM affiliates WHERE id = $1 AND user_id = $2',
        [affiliateId, req.user.id]
      );
      
      if (checkResult.rows.length === 0) {
        throw new AuthorizationError('Acesso negado');
      }
    } else {
      throw new AuthorizationError('Acesso negado');
    }
  }

  // Buscar dados do afiliado
  const affiliateQuery = `
    SELECT 
      a.*,
      u.name,
      u.email,
      u.phone,
      u.is_active as user_active,
      u.email_verified,
      u.last_login,
      u.created_at as user_created_at,
      approver.name as approved_by_name
    FROM affiliates a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN users approver ON a.approved_by = approver.id
    WHERE a.id = $1
  `;

  const result = await executeQuery(affiliateQuery, [affiliateId]);
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Afiliado não encontrado');
  }

  const affiliate = result.rows[0];

  // Buscar métricas dos últimos 30 dias
  const endDate = moment().endOf('day');
  const startDate = moment().subtract(30, 'days').startOf('day');
  const metrics = await calculateAffiliateMetrics(affiliateId, startDate, endDate);

  // Buscar últimos agendamentos
  const recentBookingsQuery = `
    SELECT 
      b.id,
      b.client_name,
      b.client_email,
      b.scheduled_date,
      b.scheduled_time,
      b.status,
      b.total_amount,
      b.affiliate_commission,
      b.created_at,
      s.name as service_name,
      u_therapist.name as therapist_name
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u_therapist ON t.user_id = u_therapist.id
    WHERE b.affiliate_id = $1
    ORDER BY b.created_at DESC
    LIMIT 10
  `;

  const bookingsResult = await executeQuery(recentBookingsQuery, [affiliateId]);

  const affiliateData = {
    id: affiliate.id,
    userId: affiliate.user_id,
    name: affiliate.name,
    email: affiliate.email,
    phone: affiliate.phone,
    affiliateCode: affiliate.affiliate_code,
    commissionRate: parseFloat(affiliate.commission_rate),
    totalReferrals: affiliate.total_referrals,
    totalEarnings: parseFloat(affiliate.total_earnings),
    currentBalance: parseFloat(affiliate.current_balance),
    status: affiliate.status,
    pixKey: affiliate.pix_key,
    taxDocument: affiliate.tax_document,
    bankDetails: affiliate.bank_details,
    paymentInfo: affiliate.payment_info,
    address: affiliate.address,
    performanceMetrics: affiliate.performance_metrics,
    notes: affiliate.notes,
    isActive: affiliate.user_active,
    emailVerified: affiliate.email_verified,
    lastLogin: affiliate.last_login,
    approvedAt: affiliate.approved_at,
    approvedBy: affiliate.approved_by_name,
    createdAt: affiliate.created_at,
    updatedAt: affiliate.updated_at,
    metrics: {
      ...metrics,
      totalRevenue: parseFloat(metrics.total_revenue) || 0,
      totalCommission: parseFloat(metrics.total_commission) || 0,
      avgBookingValue: parseFloat(metrics.avg_booking_value) || 0,
      conversionRate: metrics.total_bookings > 0 
        ? ((metrics.completed_bookings / metrics.total_bookings) * 100).toFixed(2)
        : 0
    },
    recentBookings: bookingsResult.rows
  };

  res.json({
    success: true,
    data: { affiliate: affiliateData }
  });
}));

// POST /api/affiliates - Criar novo afiliado
router.post('/', authenticateToken, authorize(['admin']), createAffiliateValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const {
    userId,
    commissionRate,
    pixKey,
    taxDocument,
    bankDetails,
    address,
    notes
  } = req.body;

  // Verificar se usuário existe e não é afiliado ainda
  const userResult = await executeQuery(`
    SELECT u.*, a.id as affiliate_id
    FROM users u
    LEFT JOIN affiliates a ON u.id = a.user_id
    WHERE u.id = $1
  `, [userId]);

  if (userResult.rows.length === 0) {
    throw new NotFoundError('Usuário não encontrado');
  }

  const user = userResult.rows[0];

  if (user.affiliate_id) {
    throw new ConflictError('Usuário já é afiliado');
  }

  // Gerar código de afiliado
  const affiliateCode = await generateAffiliateCode(user.name);

  // Buscar taxa de comissão padrão se não informada
  let finalCommissionRate = commissionRate;
  if (!finalCommissionRate) {
    const settingsResult = await executeQuery(`
      SELECT value FROM settings WHERE key = 'default_commission_rate'
    `);
    finalCommissionRate = parseFloat(settingsResult.rows[0]?.value) || 20.00;
  }

  // Criar afiliado
  const createQuery = `
    INSERT INTO affiliates (
      user_id, affiliate_code, commission_rate, pix_key, 
      tax_document, bank_details, address, notes,
      status, approved_at, approved_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), $9
    ) RETURNING id
  `;

  const createParams = [
    userId,
    affiliateCode,
    finalCommissionRate,
    pixKey || null,
    taxDocument || null,
    bankDetails ? JSON.stringify(bankDetails) : null,
    address ? JSON.stringify(address) : null,
    notes || null,
    req.user.id
  ];

  const result = await executeQuery(createQuery, createParams);
  const affiliateId = result.rows[0].id;

  // Atualizar role do usuário
  await executeQuery(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
    ['affiliate', userId]
  );

  // Buscar afiliado criado
  const newAffiliateResult = await executeQuery(`
    SELECT 
      a.*,
      u.name,
      u.email,
      u.phone
    FROM affiliates a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = $1
  `, [affiliateId]);

  const newAffiliate = newAffiliateResult.rows[0];

  // Enviar email de boas-vindas
  try {
    await emailService.sendWelcomeEmail(user.email, {
      name: user.name,
      role: 'affiliate',
      affiliateCode,
      loginUrl: `${process.env.FRONTEND_URL}/login`
    });
  } catch (error) {
    logger.warn('Erro ao enviar email de boas-vindas:', error);
  }

  // Log da ação
  logHelpers.audit('CREATE_AFFILIATE', {
    affiliateId,
    userId,
    affiliateCode,
    commissionRate: finalCommissionRate,
    createdBy: req.user.email
  });

  res.status(201).json({
    success: true,
    message: 'Afiliado criado com sucesso',
    data: {
      affiliate: {
        id: newAffiliate.id,
        userId: newAffiliate.user_id,
        name: newAffiliate.name,
        email: newAffiliate.email,
        phone: newAffiliate.phone,
        affiliateCode: newAffiliate.affiliate_code,
        commissionRate: parseFloat(newAffiliate.commission_rate),
        status: newAffiliate.status,
        createdAt: newAffiliate.created_at
      }
    }
  });
}));

// PUT /api/affiliates/:id - Atualizar afiliado
router.put('/:id', authenticateToken, updateAffiliateValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const affiliateId = req.params.id;
  const updates = req.body;

  // Verificar se afiliado existe
  const affiliateResult = await executeQuery(
    'SELECT * FROM affiliates WHERE id = $1',
    [affiliateId]
  );

  if (affiliateResult.rows.length === 0) {
    throw new NotFoundError('Afiliado não encontrado');
  }

  const currentAffiliate = affiliateResult.rows[0];

  // Verificar autorização
  if (req.user.role !== 'admin') {
    if (req.user.role === 'affiliate' && currentAffiliate.user_id !== req.user.id) {
      throw new AuthorizationError('Acesso negado');
    }
    
    // Afiliados não podem alterar status ou taxa de comissão
    if (req.user.role === 'affiliate') {
      delete updates.status;
      delete updates.commissionRate;
    }
  }

  // Construir query de update
  const updateFields = [];
  const updateParams = [];
  let paramCount = 0;

  const allowedFields = {
    commissionRate: 'commission_rate',
    pixKey: 'pix_key',
    taxDocument: 'tax_document',
    bankDetails: 'bank_details',
    address: 'address',
    notes: 'notes',
    status: 'status'
  };

  Object.keys(updates).forEach(key => {
    if (allowedFields[key] && updates[key] !== undefined) {
      const dbField = allowedFields[key];
      updateFields.push(`${dbField} = $${++paramCount}`);
      
      if (key === 'bankDetails' || key === 'address') {
        updateParams.push(JSON.stringify(updates[key]));
      } else {
        updateParams.push(updates[key]);
      }
    }
  });

  if (updateFields.length === 0) {
    throw new ValidationError('Nenhum campo válido para atualização');
  }

  updateFields.push(`updated_at = $${++paramCount}`);
  updateParams.push(new Date());
  updateParams.push(affiliateId);

  const updateQuery = `
    UPDATE affiliates 
    SET ${updateFields.join(', ')}
    WHERE id = $${++paramCount}
    RETURNING *
  `;

  await executeQuery(updateQuery, updateParams);

  // Se status mudou para 'active', atualizar data de aprovação
  if (updates.status === 'active' && currentAffiliate.status !== 'active') {
    await executeQuery(`
      UPDATE affiliates 
      SET approved_at = NOW(), approved_by = $1
      WHERE id = $2
    `, [req.user.id, affiliateId]);
  }

  // Buscar afiliado atualizado
  const updatedResult = await executeQuery(`
    SELECT 
      a.*,
      u.name,
      u.email,
      u.phone
    FROM affiliates a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = $1
  `, [affiliateId]);

  const updatedAffiliate = updatedResult.rows[0];

  // Log da ação
  logHelpers.audit('UPDATE_AFFILIATE', {
    affiliateId,
    changes: updates,
    updatedBy: req.user.email
  });

  res.json({
    success: true,
    message: 'Afiliado atualizado com sucesso',
    data: {
      affiliate: {
        id: updatedAffiliate.id,
        userId: updatedAffiliate.user_id,
        name: updatedAffiliate.name,
        email: updatedAffiliate.email,
        phone: updatedAffiliate.phone,
        affiliateCode: updatedAffiliate.affiliate_code,
        commissionRate: parseFloat(updatedAffiliate.commission_rate),
        totalReferrals: updatedAffiliate.total_referrals,
        totalEarnings: parseFloat(updatedAffiliate.total_earnings),
        currentBalance: parseFloat(updatedAffiliate.current_balance),
        status: updatedAffiliate.status,
        pixKey: updatedAffiliate.pix_key,
        taxDocument: updatedAffiliate.tax_document,
        bankDetails: updatedAffiliate.bank_details,
        address: updatedAffiliate.address,
        notes: updatedAffiliate.notes,
        updatedAt: updatedAffiliate.updated_at
      }
    }
  });
}));

// GET /api/affiliates/:id/bookings - Agendamentos do afiliado
router.get('/:id/bookings', authenticateToken, [
  param('id').isUUID().withMessage('ID do afiliado inválido'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }

  const affiliateId = req.params.id;
  const {
    page = 1,
    limit = 20,
    status,
    dateFrom,
    dateTo
  } = req.query;

  // Verificar autorização
  if (req.user.role !== 'admin') {
    if (req.user.role === 'affiliate') {
      const checkResult = await executeQuery(
        'SELECT id FROM affiliates WHERE id = $1 AND user_id = $2',
        [affiliateId, req.user.id]
      );
      
      if (checkResult.rows.length === 0) {
        throw new AuthorizationError('Acesso negado');
      }
    } else {
      throw new AuthorizationError('Acesso negado');
    }
  }

  const offset = (page - 1) * limit;
  
  // Construir filtros
  let whereConditions = ['b.affiliate_id = $1'];
  let queryParams = [affiliateId];
  let paramCount = 1;

  if (status) {
    whereConditions.push(`b.status = $${++paramCount}`);
    queryParams.push(status);
  }

  if (dateFrom) {
    whereConditions.push(`b.scheduled_date >= $${++paramCount}`);
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    whereConditions.push(`b.scheduled_date <= $${++paramCount}`);
    queryParams.push(dateTo);
  }

  const whereClause = whereConditions.join(' AND ');

  const bookingsQuery = `
    SELECT 
      b.*,
      s.name as service_name,
      s.duration as service_duration,
      s.category as service_category,
      u_therapist.name as therapist_name,
      t.specialty as therapist_specialty,
      COUNT(*) OVER() as total_count
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u_therapist ON t.user_id = u_therapist.id
    WHERE ${whereClause}
    ORDER BY b.scheduled_date DESC, b.scheduled_time DESC
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `;

  queryParams.push(limit, offset);

  const result = await executeQuery(bookingsQuery, queryParams);
  
  const bookings = result.rows;
  const totalCount = bookings.length > 0 ? parseInt(bookings[0].total_count) : 0;
  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    success: true,
    data: {
      bookings: bookings.map(booking => ({
        id: booking.id,
        serviceName: booking.service_name,
        serviceDuration: booking.service_duration,
        serviceCategory: booking.service_category,
        therapistName: booking.therapist_name,
        therapistSpecialty: booking.therapist_specialty,
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        scheduledDate: booking.scheduled_date,
        scheduledTime: booking.scheduled_time,
        status: booking.status,
        paymentStatus: booking.payment_status,
        totalAmount: parseFloat(booking.total_amount),
        affiliateCommission: parseFloat(booking.affiliate_commission),
        createdAt: booking.created_at
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// GET /api/affiliates/:id/metrics - Métricas do afiliado
router.get('/:id/metrics', authenticateToken, [
  param('id').isUUID().withMessage('ID do afiliado inválido'),
  query('period').optional().isIn(['7d', '30d', '90d', '6m', '1y']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }

  const affiliateId = req.params.id;
  const { period = '30d', dateFrom, dateTo } = req.query;

  // Verificar autorização
  if (req.user.role !== 'admin') {
    if (req.user.role === 'affiliate') {
      const checkResult = await executeQuery(
        'SELECT id FROM affiliates WHERE id = $1 AND user_id = $2',
        [affiliateId, req.user.id]
      );
      
      if (checkResult.rows.length === 0) {
        throw new AuthorizationError('Acesso negado');
      }
    } else {
      throw new AuthorizationError('Acesso negado');
    }
  }

  // Definir datas
  let startDate, endDate;
  
  if (dateFrom && dateTo) {
    startDate = moment(dateFrom).startOf('day');
    endDate = moment(dateTo).endOf('day');
  } else {
    endDate = moment().endOf('day');
    
    switch (period) {
      case '7d':
        startDate = moment().subtract(7, 'days').startOf('day');
        break;
      case '30d':
        startDate = moment().subtract(30, 'days').startOf('day');
        break;
      case '90d':
        startDate = moment().subtract(90, 'days').startOf('day');
        break;
      case '6m':
        startDate = moment().subtract(6, 'months').startOf('day');
        break;
      case '1y':
        startDate = moment().subtract(1, 'year').startOf('day');
        break;
      default:
        startDate = moment().subtract(30, 'days').startOf('day');
    }
  }

  // Buscar métricas
  const metrics = await calculateAffiliateMetrics(affiliateId, startDate, endDate);

  // Buscar dados de evolução temporal
  const timeSeriesQuery = `
    SELECT 
      DATE_TRUNC('day', b.created_at) as date,
      COUNT(b.id) as bookings,
      COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed,
      SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as revenue,
      SUM(CASE WHEN b.status = 'completed' THEN b.affiliate_commission ELSE 0 END) as commission
    FROM bookings b
    WHERE b.affiliate_id = $1
    AND b.created_at >= $2
    AND b.created_at <= $3
    GROUP BY DATE_TRUNC('day', b.created_at)
    ORDER BY date
  `;

  const timeSeriesResult = await executeQuery(timeSeriesQuery, [affiliateId, startDate, endDate]);

  // Buscar top serviços
  const topServicesQuery = `
    SELECT 
      s.name,
      s.category,
      COUNT(b.id) as bookings_count,
      SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN b.status = 'completed' THEN b.affiliate_commission ELSE 0 END) as total_commission
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.affiliate_id = $1
    AND b.created_at >= $2
    AND b.created_at <= $3
    GROUP BY s.id, s.name, s.category
    ORDER BY bookings_count DESC
    LIMIT 10
  `;

  const topServicesResult = await executeQuery(topServicesQuery, [affiliateId, startDate, endDate]);

  res.json({
    success: true,
    data: {
      period: {
        start: startDate.format(),
        end: endDate.format(),
        days: endDate.diff(startDate, 'days') + 1
      },
      summary: {
        totalBookings: parseInt(metrics.total_bookings) || 0,
        completedBookings: parseInt(metrics.completed_bookings) || 0,
        cancelledBookings: parseInt(metrics.cancelled_bookings) || 0,
        totalRevenue: parseFloat(metrics.total_revenue) || 0,
        totalCommission: parseFloat(metrics.total_commission) || 0,
        avgBookingValue: parseFloat(metrics.avg_booking_value) || 0,
        uniqueClients: parseInt(metrics.unique_clients) || 0,
        conversionRate: metrics.total_bookings > 0 
          ? ((metrics.completed_bookings / metrics.total_bookings) * 100).toFixed(2)
          : 0
      },
      timeSeries: timeSeriesResult.rows.map(row => ({
        date: row.date,
        bookings: parseInt(row.bookings),
        completed: parseInt(row.completed),
        revenue: parseFloat(row.revenue),
        commission: parseFloat(row.commission)
      })),
      topServices: topServicesResult.rows.map(row => ({
        name: row.name,
        category: row.category,
        bookingsCount: parseInt(row.bookings_count),
        totalRevenue: parseFloat(row.total_revenue),
        totalCommission: parseFloat(row.total_commission)
      }))
    }
  });
}));

// POST /api/affiliates/:id/update-totals - Atualizar totais (admin only)
router.post('/:id/update-totals', authenticateToken, authorize(['admin']), [
  param('id').isUUID().withMessage('ID do afiliado inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('ID inválido');
  }

  const affiliateId = req.params.id;

  // Verificar se afiliado existe
  const affiliateResult = await executeQuery(
    'SELECT id FROM affiliates WHERE id = $1',
    [affiliateId]
  );

  if (affiliateResult.rows.length === 0) {
    throw new NotFoundError('Afiliado não encontrado');
  }

  // Atualizar totais
  await updateAffiliateTotals(affiliateId);

  // Log da ação
  logHelpers.audit('UPDATE_AFFILIATE_TOTALS', {
    affiliateId,
    updatedBy: req.user.email
  });

  res.json({
    success: true,
    message: 'Totais atualizados com sucesso'
  });
}));

module.exports = router;
```
