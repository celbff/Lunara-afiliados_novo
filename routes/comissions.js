// routes/commissions.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const { pool } = require('../config/database');
const router = express.Router();

// GET /api/commissions - Listar comissões (com paginação e filtros)
router.get('/', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, affiliateId, status, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.id, c.booking_id, c.affiliate_id, c.amount, c.commission_rate, c.status, c.created_at, c.updated_at,
             u.name as affiliate_name, u.email as affiliate_email,
             b.date, b.start_time, b.end_time, b.status as booking_status,
             s.name as service_name, s.price as service_price
      FROM commissions c
      JOIN affiliates a ON c.affiliate_id = a.id
      JOIN users u ON a.user_id = u.id
      JOIN bookings b ON c.booking_id = b.id
      JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM commissions c WHERE 1=1';
    const queryParams = [];
    const countParams = [];

    // Adicionar filtros
    if (affiliateId) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.affiliate_id = $${paramIndex}`;
      countQuery += ` AND c.affiliate_id = $${paramIndex}`;
      queryParams.push(affiliateId);
      countParams.push(affiliateId);
    }

    if (status) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.status = $${paramIndex}`;
      countQuery += ` AND c.status = $${paramIndex}`;
      queryParams.push(status);
      countParams.push(status);
    }

    if (startDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.created_at >= $${paramIndex}`;
      countQuery += ` AND c.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      countParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.created_at <= $${paramIndex}`;
      countQuery += ` AND c.created_at <= $${paramIndex}`;
      queryParams.push(endDate);
      countParams.push(endDate);
    }

    // Adicionar paginação
    query += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit);
    queryParams.push(offset);

    // Executar queries
    const commissionsResult = await pool.query(query, queryParams);
    const countResult = await pool.query(countQuery, countParams);

    const totalPages = Math.ceil(countResult.rows[0].count / limit);

    res.json({
      success: true,
      data: {
        commissions: commissionsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/commissions/:id - Buscar comissão específica
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const commissionResult = await pool.query(`
      SELECT c.id, c.booking_id, c.affiliate_id, c.amount, c.commission_rate, c.status, c.created_at, c.updated_at,
             u.name as affiliate_name, u.email as affiliate_email,
             b.date as booking_date, b.start_time, b.end_time, b.status as booking_status,
             s.name as service_name, s.price as service_price,
             t.id as therapist_id, ut.name as therapist_name,
             cl.id as client_id, ucl.name as client_name
      FROM commissions c
      JOIN affiliates a ON c.affiliate_id = a.id
      JOIN users u ON a.user_id = u.id
      JOIN bookings b ON c.booking_id = b.id
      JOIN services s ON b.service_id = s.id
      JOIN therapists t ON b.therapist_id = t.id
      JOIN users ut ON t.user_id = ut.id
      JOIN clients cl ON b.client_id = cl.id
      JOIN users ucl ON cl.user_id = ucl.id
      WHERE c.id = $1
    `, [id]);

    if (commissionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comissão não encontrada' });
    }

    const commission = commissionResult.rows[0];

    // Verificar permissões
    if (req.user.userType === 'affiliate') {
      const affiliateResult = await pool.query(
        'SELECT id FROM affiliates WHERE user_id = $1',
        [req.user.id]
      );

      if (affiliateResult.rows.length === 0 || affiliateResult.rows[0].id !== commission.affiliate_id) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }

    res.json({
      success: true,
      data: {
        commission
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/commissions/:id - Atualizar comissão (apenas admin)
router.put('/:id', authenticateToken, authorize(['admin']), [
  body('status').isIn(['pending', 'paid', 'cancelled']).withMessage('Status inválido'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Valor deve ser um número positivo'),
  body('commissionRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Taxa de comissão deve ser entre 0 e 1')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Dados inválidos', errors: errors.array() });
    }

    const { id } = req.params;
    const { status, amount, commissionRate } = req.body;

    // Verificar se a comissão existe
    const commissionExists = await pool.query(
      'SELECT * FROM commissions WHERE id = $1',
      [id]
    );

    if (commissionExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comissão não encontrada' });
    }

    // Construir query dinamicamente
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }

    if (amount !== undefined) {
      updateFields.push(`amount = $${paramIndex}`);
      updateValues.push(amount);
      paramIndex++;
    }

    if (commissionRate !== undefined) {
      updateFields.push(`commission_rate = $${paramIndex}`);
      updateValues.push(commissionRate);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }

    // Adicionar updated_at e o ID
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const updateQuery = `
      UPDATE commissions 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);

    // Buscar dados completos da comissão atualizada
    const fullCommissionResult = await pool.query(`
      SELECT c.id, c.booking_id, c.affiliate_id, c.amount, c.commission_rate, c.status, c.created_at, c.updated_at,
             u.name as affiliate_name, u.email as affiliate_email,
             b.date, b.start_time, b.end_time, b.status as booking_status,
             s.name as service_name, s.price as service_price
      FROM commissions c
      JOIN affiliates a ON c.affiliate_id = a.id
      JOIN users u ON a.user_id = u.id
      JOIN bookings b ON c.booking_id = b.id
      JOIN services s ON b.service_id = s.id
      WHERE c.id = $1
    `, [result.rows[0].id]);

    res.json({
      success: true,
      message: 'Comissão atualizada com sucesso',
      data: {
        commission: fullCommissionResult.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/commissions/pay/:id - Pagar comissão (apenas admin)
router.post('/pay/:id', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar se a comissão existe e está pendente
    const commissionExists = await pool.query(
      'SELECT * FROM commissions WHERE id = $1 AND status = \'pending\'',
      [id]
    );

    if (commissionExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comissão não encontrada ou não está pendente' });
    }

    // Atualizar status para pago
    await pool.query(
      'UPDATE commissions SET status = \'paid\', updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Comissão paga com sucesso'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/commissions/cancel/:id - Cancelar comissão (apenas admin)
router.post('/cancel/:id', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar se a comissão existe e está pendente
    const commissionExists = await pool.query(
      'SELECT * FROM commissions WHERE id = $1 AND status = \'pending\'',
      [id]
    );

    if (commissionExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comissão não encontrada ou não está pendente' });
    }

    // Atualizar status para cancelado
    await pool.query(
      'UPDATE commissions SET status = \'cancelled\', updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Comissão cancelada com sucesso'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/commissions/summary - Resumo de comissões (apenas admin)
router.get('/summary', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_commissions,
        SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN c.status = 'cancelled' THEN c.amount ELSE 0 END) as total_cancelled,
        COUNT(DISTINCT c.affiliate_id) as active_affiliates
      FROM commissions c
      WHERE 1=1
    `;
    
    const queryParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.created_at <= $${paramIndex}`;
      queryParams.push(endDate);
    }

    // Executar query
    const summaryResult = await pool.query(query, queryParams);

    // Buscar top afiliados
    let topAffiliatesQuery = `
      SELECT 
        a.id, 
        u.name as affiliate_name,
        COUNT(c.id) as commissions_count,
        SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as total_paid
      FROM commissions c
      JOIN affiliates a ON c.affiliate_id = a.id
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const topAffiliatesParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = topAffiliatesParams.length + 1;
      topAffiliatesQuery += ` AND c.created_at >= $${paramIndex}`;
      topAffiliatesParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = topAffiliatesParams.length + 1;
      topAffiliatesQuery += ` AND c.created_at <= $${paramIndex}`;
      topAffiliatesParams.push(endDate);
    }

    topAffiliatesQuery += `
      GROUP BY a.id, u.name
      ORDER BY total_paid DESC
      LIMIT 5
    `;

    const topAffiliatesResult = await pool.query(topAffiliatesQuery, topAffiliatesParams);

    res.json({
      success: true,
      data: {
        summary: summaryResult.rows[0],
        topAffiliates: topAffiliatesResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;