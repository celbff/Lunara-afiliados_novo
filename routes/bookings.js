# routes/bookings.js

```javascript
// routes/bookings.js
// Sistema de agendamentos (Agenda 2.0) - Lunara Afiliados
// Core do sistema com validações, notificações e integrações

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const moment = require('moment-timezone');

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
const createBookingValidation = [
  body('serviceId').isUUID().withMessage('ID do serviço inválido'),
  body('clientName').trim().isLength({ min: 2, max: 255 }).withMessage('Nome do cliente deve ter entre 2 e 255 caracteres'),
  body('clientEmail').isEmail().normalizeEmail().withMessage('Email do cliente inválido'),
  body('clientPhone').optional().matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).withMessage('Telefone inválido'),
  body('scheduledDate').isISO8601().withMessage('Data inválida'),
  body('scheduledTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário inválido'),
  body('affiliateCode').optional().isLength({ min: 3, max: 50 }).withMessage('Código de afiliado inválido'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Observações muito longas')
];

const updateBookingValidation = [
  param('id').isUUID().withMessage('ID do agendamento inválido'),
  body('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).withMessage('Status inválido'),
  body('scheduledDate').optional().isISO8601().withMessage('Data inválida'),
  body('scheduledTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário inválido'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Observações muito longas'),
  body('internalNotes').optional().isLength({ max: 1000 }).withMessage('Observações internas muito longas'),
  body('cancellationReason').optional().isLength({ max: 500 }).withMessage('Motivo de cancelamento muito longo')
];

// ===== FUNÇÕES AUXILIARES =====

// Verificar disponibilidade do horário
const checkAvailability = async (therapistId, date, time, excludeBookingId = null) => {
  const query = `
    SELECT id FROM bookings 
    WHERE therapist_id = $1 
    AND scheduled_date = $2 
    AND scheduled_time = $3 
    AND status != 'cancelled'
    ${excludeBookingId ? 'AND id != $4' : ''}
  `;
  
  const params = [therapistId, date, time];
  if (excludeBookingId) {
    params.push(excludeBookingId);
  }
  
  const result = await executeQuery(query, params);
  return result.rows.length === 0;
};

// Validar horário de funcionamento
const validateBusinessHours = async (date, time) => {
  const settingsResult = await executeQuery(`
    SELECT value FROM settings WHERE key = 'business_hours'
  `);
  
  const businessHours = settingsResult.rows[0]?.value || {
    start: '08:00',
    end: '18:00',
    timezone: 'America/Sao_Paulo'
  };

  const appointmentDateTime = moment.tz(`${date} ${time}`, businessHours.timezone);
  const dayOfWeek = appointmentDateTime.day(); // 0 = domingo, 6 = sábado
  
  // Verificar se não é fim de semana
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new ValidationError('Agendamentos não são permitidos nos finais de semana');
  }
  
  // Verificar horário de funcionamento
  const startTime = moment.tz(`${date} ${businessHours.start}`, businessHours.timezone);
  const endTime = moment.tz(`${date} ${businessHours.end}`, businessHours.timezone);
  
  if (appointmentDateTime.isBefore(startTime) || appointmentDateTime.isAfter(endTime)) {
    throw new ValidationError(`Agendamentos permitidos apenas entre ${businessHours.start} e ${businessHours.end}`);
  }
  
  return true;
};

// Validar antecedência mínima
const validateAdvanceBooking = async (date, time) => {
  const settingsResult = await executeQuery(`
    SELECT value FROM settings WHERE key = 'booking_advance_hours'
  `);
  
  const advanceHours = parseInt(settingsResult.rows[0]?.value) || 24;
  const appointmentDateTime = moment(`${date} ${time}`);
  const minBookingTime = moment().add(advanceHours, 'hours');
  
  if (appointmentDateTime.isBefore(minBookingTime)) {
    throw new ValidationError(`Agendamentos devem ser feitos com pelo menos ${advanceHours} horas de antecedência`);
  }
  
  return true;
};

// Buscar dados completos do agendamento
const getBookingWithDetails = async (bookingId) => {
  const result = await executeQuery(`
    SELECT 
      b.*,
      s.name as service_name,
      s.description as service_description,
      s.duration as service_duration,
      s.category as service_category,
      s.is_online,
      u_therapist.name as therapist_name,
      u_therapist.email as therapist_email,
      t.specialty as therapist_specialty,
      t.license_number as therapist_license,
      u_client.name as client_user_name,
      u_client.email as client_user_email,
      a.affiliate_code,
      u_affiliate.name as affiliate_name,
      u_affiliate.email as affiliate_email
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u_therapist ON t.user_id = u_therapist.id
    LEFT JOIN users u_client ON b.client_id = u_client.id
    LEFT JOIN affiliates a ON b.affiliate_id = a.id
    LEFT JOIN users u_affiliate ON a.user_id = u_affiliate.id
    WHERE b.id = $1
  `, [bookingId]);
  
  return result.rows[0];
};

// Criar notificação
const createNotification = async (userId, type, title, message, data = {}, bookingId = null) => {
  await executeQuery(`
    INSERT INTO notifications (user_id, type, title, message, data, booking_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, type, title, message, JSON.stringify(data), bookingId]);
};

// ===== ROTAS =====

// GET /api/bookings - Listar agendamentos
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']),
  query('therapistId').optional().isUUID(),
  query('affiliateId').optional().isUUID(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('search').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }

  const {
    page = 1,
    limit = 20,
    status,
    therapistId,
    affiliateId,
    dateFrom,
    dateTo,
    search
  } = req.query;

  const offset = (page - 1) * limit;
  
  // Construir query baseada no role do usuário
  let whereConditions = ['1=1'];
  let queryParams = [];
  let paramCount = 0;

  // Filtros por role
  if (req.user.role === 'therapist') {
    // Terapeuta só vê seus próprios agendamentos
    whereConditions.push(`t.user_id = $${++paramCount}`);
    queryParams.push(req.user.id);
  } else if (req.user.role === 'affiliate') {
    // Afiliado só vê agendamentos de seus referrals
    whereConditions.push(`a.user_id = $${++paramCount}`);
    queryParams.push(req.user.id);
  } else if (req.user.role === 'client') {
    // Cliente só vê seus próprios agendamentos
    whereConditions.push(`(b.client_id = $${++paramCount} OR b.client_email = $${++paramCount})`);
    queryParams.push(req.user.id, req.user.email);
  }

  // Filtros adicionais
  if (status) {
    whereConditions.push(`b.status = $${++paramCount}`);
    queryParams.push(status);
  }

  if (therapistId && (req.user.role === 'admin' || req.user.role === 'therapist')) {
    whereConditions.push(`b.therapist_id = $${++paramCount}`);
    queryParams.push(therapistId);
  }

  if (affiliateId && (req.user.role === 'admin' || req.user.role === 'affiliate')) {
    whereConditions.push(`b.affiliate_id = $${++paramCount}`);
    queryParams.push(affiliateId);
  }

  if (dateFrom) {
    whereConditions.push(`b.scheduled_date >= $${++paramCount}`);
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    whereConditions.push(`b.scheduled_date <= $${++paramCount}`);
    queryParams.push(dateTo);
  }

  if (search) {
    whereConditions.push(`(
      b.client_name ILIKE $${++paramCount} OR
      b.client_email ILIKE $${++paramCount} OR
      s.name ILIKE $${++paramCount} OR
      u_therapist.name ILIKE $${++paramCount}
    )`);
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = whereConditions.join(' AND ');

  // Query principal
  const bookingsQuery = `
    SELECT 
      b.*,
      s.name as service_name,
      s.duration as service_duration,
      s.category as service_category,
      s.is_online,
      u_therapist.name as therapist_name,
      t.specialty as therapist_specialty,
      a.affiliate_code,
      u_affiliate.name as affiliate_name,
      COUNT(*) OVER() as total_count
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u_therapist ON t.user_id = u_therapist.id
    LEFT JOIN affiliates a ON b.affiliate_id = a.id
    LEFT JOIN users u_affiliate ON a.user_id = u_affiliate.id
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
        isOnline: booking.is_online,
        therapistName: booking.therapist_name,
        therapistSpecialty: booking.therapist_specialty,
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        clientPhone: booking.client_phone,
        scheduledDate: booking.scheduled_date,
        scheduledTime: booking.scheduled_time,
        status: booking.status,
        paymentStatus: booking.payment_status,
        totalAmount: parseFloat(booking.total_amount),
        affiliateCode: booking.affiliate_code,
        affiliateName: booking.affiliate_name,
        notes: booking.notes,
        meetingLink: booking.meeting_link,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at
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

// GET /api/bookings/:id - Buscar agendamento específico
router.get('/:id', authenticateToken, [
  param('id').isUUID().withMessage('ID inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('ID inválido');
  }

  const booking = await getBookingWithDetails(req.params.id);
  
  if (!booking) {
    throw new NotFoundError('Agendamento não encontrado');
  }

  // Verificar autorização
  const canView = 
    req.user.role === 'admin' ||
    (req.user.role === 'therapist' && booking.therapist_email === req.user.email) ||
    (req.user.role === 'affiliate' && booking.affiliate_email === req.user.email) ||
    (req.user.role === 'client' && (booking.client_id === req.user.id || booking.client_email === req.user.email));

  if (!canView) {
    throw new AuthorizationError('Acesso negado a este agendamento');
  }

  res.json({
    success: true,
    data: { booking }
  });
}));

// POST /api/bookings - Criar novo agendamento
router.post('/', createBookingValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const {
    serviceId,
    clientName,
    clientEmail,
    clientPhone,
    scheduledDate,
    scheduledTime,
    affiliateCode,
    notes
  } = req.body;

  // Buscar dados do serviço
  const serviceResult = await executeQuery(`
    SELECT s.*, t.id as therapist_id, t.user_id as therapist_user_id,
           u.name as therapist_name, u.email as therapist_email
    FROM services s
    JOIN therapists t ON s.therapist_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE s.id = $1 AND s.is_active = true
  `, [serviceId]);

  if (serviceResult.rows.length === 0) {
    throw new NotFoundError('Serviço não encontrado ou inativo');
  }

  const service = serviceResult.rows[0];

  // Validar horário
  await validateBusinessHours(scheduledDate, scheduledTime);
  await validateAdvanceBooking(scheduledDate, scheduledTime);

  // Verificar disponibilidade
  const isAvailable = await checkAvailability(
    service.therapist_id,
    scheduledDate,
    scheduledTime
  );

  if (!isAvailable) {
    throw new ConflictError('Horário não disponível');
  }

  // Buscar afiliado se código fornecido
  let affiliate = null;
  if (affiliateCode) {
    const affiliateResult = await executeQuery(`
      SELECT a.*, u.name, u.email 
      FROM affiliates a
      JOIN users u ON a.user_id = u.id
      WHERE a.affiliate_code = $1 AND a.status = 'active'
    `, [affiliateCode]);

    if (affiliateResult.rows.length === 0) {
      throw new NotFoundError('Código de afiliado inválido');
    }

    affiliate = affiliateResult.rows[0];
  }

  // Verificar se cliente existe
  let clientId = null;
  const clientResult = await executeQuery(
    'SELECT id FROM users WHERE email = $1',
    [clientEmail]
  );

  if (clientResult.rows.length > 0) {
    clientId = clientResult.rows[0].id;
  }

  // Calcular valores
  const servicePrice = parseFloat(service.price);
  const discountAmount = 0; // Implementar lógica de desconto se necessário
  const totalAmount = servicePrice - discountAmount;

  // Calcular comissões
  let affiliateCommission = 0;
  let therapistCommission = 0;

  if (affiliate) {
    affiliateCommission = (totalAmount * parseFloat(affiliate.commission_rate)) / 100;
  }

  // Buscar taxa de comissão do terapeuta
  const therapistResult = await executeQuery(
    'SELECT commission_rate FROM therapists WHERE id = $1',
    [service.therapist_id]
  );
  
  if (therapistResult.rows.length > 0) {
    const therapistRate = parseFloat(therapistResult.rows[0].commission_rate);
    therapistCommission = (totalAmount * therapistRate) / 100;
  }

  // Calcular horário de fim
  const endTime = moment(scheduledTime, 'HH:mm')
    .add(service.duration, 'minutes')
    .format('HH:mm');

  // Criar agendamento
  const bookingQuery = `
    INSERT INTO bookings (
      service_id, therapist_id, client_id, affiliate_id,
      client_name, client_email, client_phone,
      scheduled_date, scheduled_time, scheduled_end_time,
      service_price, discount_amount, total_amount,
      affiliate_commission, therapist_commission,
      notes, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, 'pending'
    ) RETURNING id
  `;

  const bookingParams = [
    serviceId,
    service.therapist_id,
    clientId,
    affiliate?.id || null,
    clientName,
    clientEmail,
    clientPhone || null,
    scheduledDate,
    scheduledTime,
    endTime,
    servicePrice,
    discountAmount,
    totalAmount,
    affiliateCommission,
    therapistCommission,
    notes || null
  ];

  const bookingResult = await executeQuery(bookingQuery, bookingParams);
  const bookingId = bookingResult.rows[0].id;

  // Buscar agendamento criado com detalhes
  const newBooking = await getBookingWithDetails(bookingId);

  // Criar notificações
  try {
    // Notificar terapeuta
    await createNotification(
      service.therapist_user_id,
      'system',
      'Novo agendamento',
      `Novo agendamento com ${clientName} para ${moment(scheduledDate).format('DD/MM/YYYY')} às ${scheduledTime}`,
      { type: 'new_booking' },
      bookingId
    );

    // Notificar afiliado se existir
    if (affiliate) {
      await createNotification(
        affiliate.user_id,
        'system',
        'Novo agendamento de referral',
        `Seu referral ${clientName} agendou uma consulta`,
        { type: 'affiliate_booking', commission: affiliateCommission },
        bookingId
      );
    }

    // Enviar emails
    await emailService.sendBookingConfirmation(clientEmail, {
      clientName,
      serviceName: service.name,
      therapistName: service.therapist_name,
      scheduledDate: moment(scheduledDate).format('DD/MM/YYYY'),
      scheduledTime,
      duration: service.duration,
      totalAmount,
      bookingId
    });

  } catch (error) {
    logger.warn('Erro ao enviar notificações:', error);
  }

  // Log da ação
  logHelpers.audit('CREATE_BOOKING', {
    bookingId,
    clientEmail,
    serviceId,
    therapistId: service.therapist_id,
    affiliateCode,
    totalAmount,
    user: req.user?.email || 'public'
  });

  res.status(201).json({
    success: true,
    message: 'Agendamento criado com sucesso',
    data: { booking: newBooking }
  });
}));

// PUT /api/bookings/:id - Atualizar agendamento
router.put('/:id', authenticateToken, updateBookingValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const bookingId = req.params.id;
  const updates = req.body;

  // Buscar agendamento atual
  const currentBooking = await getBookingWithDetails(bookingId);
  
  if (!currentBooking) {
    throw new NotFoundError('Agendamento não encontrado');
  }

  // Verificar autorização para editar
  const canEdit = 
    req.user.role === 'admin' ||
    (req.user.role === 'therapist' && currentBooking.therapist_email === req.user.email) ||
    (req.user.role === 'client' && (currentBooking.client_id === req.user.id || currentBooking.client_email === req.user.email));

  if (!canEdit) {
    throw new AuthorizationError('Sem permissão para editar este agendamento');
  }

  // Se alterando data/horário, verificar disponibilidade
  if (updates.scheduledDate || updates.scheduledTime) {
    const newDate = updates.scheduledDate || currentBooking.scheduled_date;
    const newTime = updates.scheduledTime || currentBooking.scheduled_time;

    if (updates.scheduledDate || updates.scheduledTime) {
      await validateBusinessHours(newDate, newTime);
      
      // Só validar antecedência se for no futuro
      if (moment(`${newDate} ${newTime}`).isAfter(moment())) {
        await validateAdvanceBooking(newDate, newTime);
      }

      const isAvailable = await checkAvailability(
        currentBooking.therapist_id,
        newDate,
        newTime,
        bookingId
      );

      if (!isAvailable) {
        throw new ConflictError('Horário não disponível');
      }
    }
  }

  // Construir query de update
  const updateFields = [];
  const updateParams = [];
  let paramCount = 0;

  const allowedFields = [
    'status', 'scheduledDate', 'scheduledTime', 'notes', 
    'internalNotes', 'cancellationReason', 'noShowReason',
    'meetingLink', 'paymentStatus', 'paymentMethod'
  ];

  const fieldMapping = {
    scheduledDate: 'scheduled_date',
    scheduledTime: 'scheduled_time',
    internalNotes: 'internal_notes',
    cancellationReason: 'cancellation_reason',
    noShowReason: 'no_show_reason',
    meetingLink: 'meeting_link',
    paymentStatus: 'payment_status',
    paymentMethod: 'payment_method'
  };

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      const dbField = fieldMapping[key] || key;
      updateFields.push(`${dbField} = $${++paramCount}`);
      updateParams.push(updates[key]);
    }
  });

  // Adicionar timestamps baseado no status
  if (updates.status) {
    switch (updates.status) {
      case 'confirmed':
        updateFields.push(`confirmed_at = $${++paramCount}`);
        updateParams.push(new Date());
        break;
      case 'cancelled':
        updateFields.push(`cancelled_at = $${++paramCount}`);
        updateParams.push(new Date());
        break;
      case 'completed':
        updateFields.push(`completed_at = $${++paramCount}`);
        updateParams.push(new Date());
        break;
    }
  }

  if (updateFields.length === 0) {
    throw new ValidationError('Nenhum campo válido para atualização');
  }

  updateFields.push(`updated_at = $${++paramCount}`);
  updateParams.push(new Date());
  updateParams.push(bookingId);

  const updateQuery = `
    UPDATE bookings 
    SET ${updateFields.join(', ')}
    WHERE id = $${++paramCount}
    RETURNING *
  `;

  await executeQuery(updateQuery, updateParams);

  // Buscar agendamento atualizado
  const updatedBooking = await getBookingWithDetails(bookingId);

  // Enviar notificações se status mudou
  if (updates.status && updates.status !== currentBooking.status) {
    try {
      let notificationTitle = '';
      let notificationMessage = '';

      switch (updates.status) {
        case 'confirmed':
          notificationTitle = 'Agendamento confirmado';
          notificationMessage = `Seu agendamento para ${moment(updatedBooking.scheduled_date).format('DD/MM/YYYY')} às ${updatedBooking.scheduled_time} foi confirmado`;
          break;
        case 'cancelled':
          notificationTitle = 'Agendamento cancelado';
          notificationMessage = `Seu agendamento foi cancelado. Motivo: ${updates.cancellationReason || 'Não informado'}`;
          break;
        case 'completed':
          notificationTitle = 'Consulta concluída';
          notificationMessage = 'Sua consulta foi concluída. Obrigado por escolher nossos serviços!';
          break;
      }

      if (notificationTitle) {
        // Notificar cliente se tiver cadastro
        if (updatedBooking.client_id) {
          await createNotification(
            updatedBooking.client_id,
            'system',
            notificationTitle,
            notificationMessage,
            { type: 'booking_status_change', status: updates.status },
            bookingId
          );
        }

        // Enviar email para cliente
        if (updates.status === 'confirmed') {
          await emailService.sendBookingConfirmation(updatedBooking.client_email, {
            clientName: updatedBooking.client_name,
            serviceName: updatedBooking.service_name,
            therapistName: updatedBooking.therapist_name,
            scheduledDate: moment(updatedBooking.scheduled_date).format('DD/MM/YYYY'),
            scheduledTime: updatedBooking.scheduled_time,
            meetingLink: updatedBooking.meeting_link
          });
        } else if (updates.status === 'cancelled') {
          await emailService.sendBookingCancellation(updatedBooking.client_email, {
            clientName: updatedBooking.client_name,
            serviceName: updatedBooking.service_name,
            scheduledDate: moment(updatedBooking.scheduled_date).format('DD/MM/YYYY'),
            scheduledTime: updatedBooking.scheduled_time,
            reason: updates.cancellationReason
          });
        }
      }

    } catch (error) {
      logger.warn('Erro ao enviar notificações de atualização:', error);
    }
  }

  // Log da ação
  logHelpers.audit('UPDATE_BOOKING', {
    bookingId,
    changes: updates,
    previousStatus: currentBooking.status,
    newStatus: updates.status,
    user: req.user.email
  });

  res.json({
    success: true,
    message: 'Agendamento atualizado com sucesso',
    data: { booking: updatedBooking }
  });
}));

// DELETE /api/bookings/:id - Cancelar agendamento
router.delete('/:id', authenticateToken, [
  param('id').isUUID().withMessage('ID inválido'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Motivo muito longo')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const bookingId = req.params.id;
  const { reason } = req.body;

  // Buscar agendamento
  const booking = await getBookingWithDetails(bookingId);
  
  if (!booking) {
    throw new NotFoundError('Agendamento não encontrado');
  }

  // Verificar se já foi cancelado
  if (booking.status === 'cancelled') {
    throw new ConflictError('Agendamento já foi cancelado');
  }

  // Verificar autorização
  const canCancel = 
    req.user.role === 'admin' ||
    (req.user.role === 'therapist' && booking.therapist_email === req.user.email) ||
    (req.user.role === 'client' && (booking.client_id === req.user.id || booking.client_email === req.user.email));

  if (!canCancel) {
    throw new AuthorizationError('Sem permissão para cancelar este agendamento');
  }

  // Verificar política de cancelamento
  const appointmentDateTime = moment(`${booking.scheduled_date} ${booking.scheduled_time}`);
  const now = moment();
  const hoursUntilAppointment = appointmentDateTime.diff(now, 'hours');

  const settingsResult = await executeQuery(`
    SELECT value FROM settings WHERE key = 'cancellation_hours'
  `);
  
  const minCancellationHours = parseInt(settingsResult.rows[0]?.value) || 24;

  if (hoursUntilAppointment < minCancellationHours && req.user.role !== 'admin') {
    throw new ValidationError(`Cancelamentos devem ser feitos com pelo menos ${minCancellationHours} horas de antecedência`);
  }

  // Cancelar agendamento
  await executeQuery(`
    UPDATE bookings 
    SET status = 'cancelled', 
        cancelled_at = NOW(), 
        cancellation_reason = $1,
        updated_at = NOW()
    WHERE id = $2
  `, [reason || 'Cancelado pelo usuário', bookingId]);

  // Notificações e emails
  try {
    // Notificar terapeuta se cancelamento foi feito pelo cliente
    if (req.user.role === 'client') {
      const therapistResult = await executeQuery(
        'SELECT user_id FROM therapists WHERE id = $1',
        [booking.therapist_id]
      );
      
      if (therapistResult.rows.length > 0) {
        await createNotification(
          therapistResult.rows[0].user_id,
          'system',
          'Agendamento cancelado',
          `O agendamento com ${booking.client_name} foi cancelado`,
          { type: 'booking_cancelled', reason },
          bookingId
        );
      }
    }

    // Enviar email de cancelamento
    await emailService.sendBookingCancellation(booking.client_email, {
      clientName: booking.client_name,
      serviceName: booking.service_name,
      therapistName: booking.therapist_name,
      scheduledDate: moment(booking.scheduled_date).format('DD/MM/YYYY'),
      scheduledTime: booking.scheduled_time,
      reason: reason || 'Cancelado'
    });

  } catch (error) {
    logger.warn('Erro ao enviar notificações de cancelamento:', error);
  }

  // Log da ação
  logHelpers.audit('CANCEL_BOOKING', {
    bookingId,
    reason,
    cancelledBy: req.user.email,
    hoursInAdvance: hoursUntilAppointment
  });

  res.json({
    success: true,
    message: 'Agendamento cancelado com sucesso'
  });
}));

// GET /api/bookings/availability/:therapistId - Verificar disponibilidade
router.get('/availability/:therapistId', [
  param('therapistId').isUUID().withMessage('ID do terapeuta inválido'),
  query('date').isISO8601().withMessage('Data inválida'),
  query('duration').optional().isInt({ min: 15, max: 240 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }

  const { therapistId } = req.params;
  const { date, duration = 60 } = req.query;

  // Verificar se terapeuta existe
  const therapistResult = await executeQuery(`
    SELECT t.*, u.name 
    FROM therapists t
    JOIN users u ON t.user_id = u.id
    WHERE t.id = $1 AND t.status = 'active'
  `, [therapistId]);

  if (therapistResult.rows.length === 0) {
    throw new NotFoundError('Terapeuta não encontrado');
  }

  // Buscar configurações de horário
  const settingsResult = await executeQuery(`
    SELECT value FROM settings WHERE key = 'business_hours'
  `);
  
  const businessHours = settingsResult.rows[0]?.value || {
    start: '08:00',
    end: '18:00'
  };

  // Gerar slots disponíveis
  const slots = [];
  const startTime = moment(`${date} ${businessHours.start}`);
  const endTime = moment(`${date} ${businessHours.end}`);
  const slotDuration = 30; // slots de 30 minutos

  while (startTime.clone().add(duration, 'minutes').isSameOrBefore(endTime)) {
    const timeSlot = startTime.format('HH:mm');
    
    // Verificar se horário está disponível
    const isAvailable = await checkAvailability(therapistId, date, timeSlot);
    
    slots.push({
      time: timeSlot,
      available: isAvailable
    });

    startTime.add(slotDuration, 'minutes');
  }

  res.json({
    success: true,
    data: {
      date,
      therapistId,
      therapistName: therapistResult.rows[0].name,
      duration,
      slots
    }
  });
}));

module.exports = router;
```
