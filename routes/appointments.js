// routes/appointments.js
// Rotas para agendamentos - Lunara Afiliados

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const { pool, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// =============================================
// VALIDAÇÕES
// =============================================

const appointmentCreationValidation = [
  body('therapist_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('ID do terapeuta é obrigatório'),
  body('appointment_date')
    .isISO8601()
    .toDate()
    .withMessage('Data do agendamento deve estar no formato ISO8601'),
  body('appointment_time')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Horário deve estar no formato HH:MM'),
  body('type')
    .notEmpty()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tipo de consulta é obrigatório'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Preço deve ser um valor válido'),
  body('affiliate_code')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Código de afiliado inválido'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Observações não podem exceder 1000 caracteres')
];

const appointmentUpdateValidation = [
  body('appointment_date')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Data do agendamento deve estar no formato ISO8601'),
  body('appointment_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Horário deve estar no formato HH:MM'),
  body('status')
    .optional()
    .isIn(['agendado', 'confirmado', 'concluido', 'cancelado', 'faltou'])
    .withMessage('Status inválido'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Observações não podem exceder 1000 caracteres'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Preço deve ser um valor válido')
];

// =============================================
// ROTAS
// =============================================

// POST /api/appointments - Criar novo agendamento
router.post('/', authenticate, appointmentCreationValidation, async (req, res, next) => {
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
      therapist_id,
      appointment_date,
      appointment_time,
      type,
      price,
      affiliate_code,
      notes = ''
    } = req.body;

    const patient_id = req.user.id;

    // Verificar se o terapeuta existe e está ativo
    const therapistResult = await pool.query(
      'SELECT id, name FROM users WHERE id = $1 AND role = $2 AND status = $3',
      [therapist_id, 'terapeuta', 'ativo']
    );

    if (therapistResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Terapeuta não encontrado ou não disponível'
      });
    }

    // Verificar disponibilidade do horário
    const conflictResult = await pool.query(`
      SELECT id FROM appointments 
      WHERE therapist_id = $1 
        AND appointment_date = $2 
        AND appointment_time = $3
        AND status NOT IN ('cancelado', 'faltou')
    `, [therapist_id, appointment_date, appointment_time]);

    if (conflictResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Horário já está ocupado'
      });
    }

    const result = await transaction(async (client) => {
      let affiliate_id = null;

      // Verificar código de afiliado se fornecido
      if (affiliate_code) {
        const affiliateResult = await client.query(`
          SELECT a.user_id 
          FROM affiliates a
          INNER JOIN users u ON a.user_id = u.id
          WHERE a.affiliate_code = $1 
            AND u.status = 'ativo' 
            AND a.status = 'ativo'
        `, [affiliate_code.toUpperCase()]);

        if (affiliateResult.rows.length > 0) {
          affiliate_id = affiliateResult.rows[0].user_id;
        } else {
          throw new Error('Código de afiliado inválido');
        }
      }

      // Criar agendamento
      const appointmentResult = await client.query(`
        INSERT INTO appointments (
          patient_id,
          therapist_id,
          appointment_date,
          appointment_time,
          type,
          price,
          status,
          notes,
          affiliate_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'agendado', $7, $8)
        RETURNING *
      `, [patient_id, therapist_id, appointment_date, appointment_time, type, price, notes, affiliate_id]);

      const appointment = appointmentResult.rows[0];

      // Se há afiliado, criar comissão pendente
      if (affiliate_id) {
        const affiliateData = await client.query(
          'SELECT commission_rate FROM affiliates WHERE user_id = $1',
          [affiliate_id]
        );

        const commission_rate = affiliateData.rows[0].commission_rate;
        const commission_amount = (price * commission_rate) / 100;

        await client.query(`
          INSERT INTO commissions (
            affiliate_id,
            appointment_id,
            amount,
            status
          )
          VALUES ($1, $2, $3, 'pending')
        `, [affiliate_id, appointment.id, commission_amount]);

        // Atualizar contador de referências do afiliado
        await client.query(
          'UPDATE affiliates SET total_referrals = total_referrals + 1 WHERE user_id = $1',
          [affiliate_id]
        );
      }

      return appointment;
    });

    logger.info(`Novo agendamento criado: ID ${result.id} - Paciente: ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Agendamento criado com sucesso',
      data: result
    });

  } catch (error) {
    if (error.message === 'Código de afiliado inválido') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
});

// GET /api/appointments - Listar agendamentos
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      date_from = '',
      date_to = '',
      therapist_id = '',
      patient_id = '',
      sort = 'appointment_date',
      order = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Construir query baseada na role do usuário
    let baseQuery = `
      SELECT 
        a.*,
        u_patient.name as patient_name,
        u_patient.email as patient_email,
        u_patient.phone as patient_phone,
        u_therapist.name as therapist_name,
        u_therapist.email as therapist_email,
        u_affiliate.name as affiliate_name,
        af.affiliate_code
      FROM appointments a
      LEFT JOIN users u_patient ON a.patient_id = u_patient.id
      LEFT JOIN users u_therapist ON a.therapist_id = u_therapist.id
      LEFT JOIN users u_affiliate ON a.affiliate_id = u_affiliate.id
      LEFT JOIN affiliates af ON a.affiliate_id = af.user_id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM appointments a
      WHERE 1=1
    `;

    let queryParams = [];
    let paramIndex = 1;

    // Filtrar por role do usuário
    if (userRole === 'terapeuta') {
      const roleCondition = ` AND a.therapist_id = $${paramIndex}`;
      baseQuery += roleCondition;
      countQuery += roleCondition;
      queryParams.push(userId);
      paramIndex++;
    } else if (userRole === 'cliente') {
      const roleCondition = ` AND a.patient_id = $${paramIndex}`;
      baseQuery += roleCondition;
      countQuery += roleCondition;
      queryParams.push(userId);
      paramIndex++;
    }
    // Admin pode ver todos

    // Filtros adicionais
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

    if (therapist_id && userRole === 'admin') {
      const therapistCondition = ` AND a.therapist_id = $${paramIndex}`;
      baseQuery += therapistCondition;
      countQuery += therapistCondition;
      queryParams.push(therapist_id);
      paramIndex++;
    }

    if (patient_id && userRole === 'admin') {
      const patientCondition = ` AND a.patient_id = $${paramIndex}`;
      baseQuery += patientCondition;
      countQuery += patientCondition;
      queryParams.push(patient_id);
      paramIndex++;
    }

    // Ordenação
    const validSortFields = {
      appointment_date: 'a.appointment_date',
      appointment_time: 'a.appointment_time',
      created_at: 'a.created_at',
      status: 'a.status',
      price: 'a.price',
      type: 'a.type'
    };

    const sortField = validSortFields[sort] || 'a.appointment_date';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    baseQuery += ` ORDER BY ${sortField} ${sortOrder}, a.appointment_time ${sortOrder}`;
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

// GET /api/appointments/:id - Obter agendamento específico
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
    const userId = req.user.id;
    const userRole = req.user.role;

    // Buscar agendamento
    const appointmentResult = await pool.query(`
      SELECT 
        a.*,
        u_patient.name as patient_name,
        u_patient.email as patient_email,
        u_patient.phone as patient_phone,
        u_therapist.name as therapist_name,
        u_therapist.email as therapist_email,
        u_therapist.phone as therapist_phone,
        u_affiliate.name as affiliate_name,
        af.affiliate_code,
        af.commission_rate
      FROM appointments a
      LEFT JOIN users u_patient ON a.patient_id = u_patient.id
      LEFT JOIN users u_therapist ON a.therapist_id = u_therapist.id
      LEFT JOIN users u_affiliate ON a.affiliate_id = u_affiliate.id
      LEFT JOIN affiliates af ON a.affiliate_id = af.user_id
      WHERE a.id = $1
    `, [id]);

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado'
      });
    }

    const appointment = appointmentResult.rows[0];

    // Verificar permissão
    if (userRole !== 'admin' && 
        appointment.patient_id !== userId && 
        appointment.therapist_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/appointments/:id - Atualizar agendamento
router.put('/:id', authenticate, param('id').isInt(), appointmentUpdateValidation, async (req, res, next) => {
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
    const userId = req.user.id;
    const userRole = req.user.role;
    const updateData = req.body;

    // Buscar agendamento atual
    const currentResult = await pool.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado'
      });
    }

    const currentAppointment = currentResult.rows[0];

    // Verificar permissão
    if (userRole !== 'admin' && 
        currentAppointment.patient_id !== userId && 
        currentAppointment.therapist_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Verificar se pode alterar o status
    if (updateData.status && userRole === 'cliente') {
      const allowedStatusForPatient = ['cancelado'];
      if (!allowedStatusForPatient.includes(updateData.status)) {
        return res.status(403).json({
          success: false,
          message: 'Clientes só podem cancelar agendamentos'
        });
      }
    }

    // Verificar conflito de horário se mudando data/hora
    if (updateData.appointment_date || updateData.appointment_time) {
      const newDate = updateData.appointment_date || currentAppointment.appointment_date;
      const newTime = updateData.appointment_time || currentAppointment.appointment_time;

      const conflictResult = await pool.query(`
        SELECT id FROM appointments 
        WHERE therapist_id = $1 
          AND appointment_date = $2 
          AND appointment_time = $3
          AND id != $4
          AND status NOT IN ('cancelado', 'faltou')
      `, [currentAppointment.therapist_id, newDate, newTime, id]);

      if (conflictResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Horário já está ocupado'
        });
      }
    }

    const result = await transaction(async (client) => {
      // Construir query de atualização
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      const allowedFields = ['appointment_date', 'appointment_time', 'status', 'notes', 'price'];
      
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(updateData[key]);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        return currentAppointment;
      }

      updateFields.push(`updated_at = NOW()`);
      
      const updateQuery = `
        UPDATE appointments 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      updateValues.push(id);

      const updatedResult = await client.query(updateQuery, updateValues);
      const updatedAppointment = updatedResult.rows[0];

      // Atualizar comissões se o status mudou para concluído
      if (updateData.status === 'concluido' && currentAppointment.status !== 'concluido') {
        if (currentAppointment.affiliate_id) {
          await client.query(`
            UPDATE commissions 
            SET status = 'paid', paid_at = NOW()
            WHERE appointment_id = $1 AND status = 'pending'
          `, [id]);

          // Atualizar total de ganhos do afiliado
          const commissionResult = await client.query(
            'SELECT amount FROM commissions WHERE appointment_id = $1',
            [id]
          );

          if (commissionResult.rows.length > 0) {
            const commissionAmount = commissionResult.rows[0].amount;
            await client.query(
              'UPDATE affiliates SET total_earnings = total_earnings + $1 WHERE user_id = $2',
              [commissionAmount, currentAppointment.affiliate_id]
            );
          }
        }
      }

      // Cancelar comissões se o agendamento foi cancelado
      if (updateData.status === 'cancelado' && currentAppointment.status !== 'cancelado') {
        if (currentAppointment.affiliate_id) {
          await client.query(`
            UPDATE commissions 
            SET status = 'cancelled', cancelled_at = NOW()
            WHERE appointment_id = $1 AND status = 'pending'
          `, [id]);
        }
      }

      return updatedAppointment;
    });

    logger.info(`Agendamento atualizado: ID ${id} - Status: ${result.status}`);

    res.json({
      success: true,
      message: 'Agendamento atualizado com sucesso',
      data: result
    });

  } catch (error) {
    next(error);
  }
});

// DELETE /api/appointments/:id - Deletar agendamento
router.delete('/:id', authenticate, param('id').isInt(), async (req, res, next) => {
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
    const userId = req.user.id;
    const userRole = req.user.role;

    // Buscar agendamento
    const appointmentResult = await pool.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado'
      });
    }

    const appointment = appointmentResult.rows[0];

    // Verificar permissão (apenas admin pode deletar)
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Apenas administradores podem deletar agendamentos'
      });
    }

    // Verificar se pode deletar (apenas se não foi concluído)
    if (appointment.status === 'concluido') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar agendamentos concluídos'
      });
    }

    await transaction(async (client) => {
      // Deletar comissões relacionadas
      await client.query('DELETE FROM commissions WHERE appointment_id = $1', [id]);
      
      // Deletar agendamento
      await client.query('DELETE FROM appointments WHERE id = $1', [id]);

      // Atualizar contador de referências do afiliado se necessário
      if (appointment.affiliate_id) {
        await client.query(
          'UPDATE affiliates SET total_referrals = total_referrals - 1 WHERE user_id = $1',
          [appointment.affiliate_id]
        );
      }
    });

    logger.info(`Agendamento deletado: ID ${id} pelo admin ${req.user.email}`);

    res.json({
      success: true,
      message: 'Agendamento deletado com sucesso'
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/appointments/available-slots/:therapist_id - Obter horários disponíveis
router.get('/available-slots/:therapist_id', param('therapist_id').isInt(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'ID do terapeuta inválido',
        errors: errors.array()
      });
    }

    const { therapist_id } = req.params;
    const { date, days = 7 } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Data é obrigatória (formato: YYYY-MM-DD)'
      });
    }

    // Verificar se o terapeuta existe
    const therapistResult = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND status = $3',
      [therapist_id, 'terapeuta', 'ativo']
    );

    if (therapistResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Terapeuta não encontrado'
      });
    }

    // Buscar agendamentos ocupados nos próximos dias
    const occupiedResult = await pool.query(`
      SELECT appointment_date, appointment_time
      FROM appointments
      WHERE therapist_id = $1
        AND appointment_date >= $2
        AND appointment_date < $2::date + interval '${parseInt(days)} days'
        AND status NOT IN ('cancelado', 'faltou')
      ORDER BY appointment_date, appointment_time
    `, [therapist_id, date]);

    const occupiedSlots = occupiedResult.rows;

    // Gerar horários disponíveis (horário comercial: 8h às 18h, intervalos de 1h)
    const availableSlots = [];
    const startDate = new Date(date);

    for (let day = 0; day < parseInt(days); day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + day);
      
      // Pular finais de semana (opcional - configurável)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Domingo = 0, Sábado = 6

      // Pular dias passados
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (currentDate < today) continue;

      const dateStr = currentDate.toISOString().split('T')[0];
      const daySlots = [];

      // Gerar horários de 8h às 18h
      for (let hour = 8; hour < 18; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        
        // Verificar se o horário está ocupado
        const isOccupied = occupiedSlots.some(slot => 
          slot.appointment_date.toISOString().split('T')[0] === dateStr && 
          slot.appointment_time === timeStr
        );

        if (!isOccupied) {
          daySlots.push(timeStr);
        }
      }

      if (daySlots.length > 0) {
        availableSlots.push({
          date: dateStr,
          day_of_week: currentDate.toLocaleDateString('pt-BR', { weekday: 'long' }),
          available_times: daySlots
        });
      }
    }

    res.json({
      success: true,
      data: {
        therapist_id: parseInt(therapist_id),
        date_range: {
          start: date,
          days: parseInt(days)
        },
        available_slots: availableSlots
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;