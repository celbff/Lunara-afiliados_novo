// routes/reports.js
const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { pool } = require('../config/database');
const router = express.Router();

// GET /api/reports/bookings - Relatório de agendamentos
router.get('/bookings', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { startDate, endDate, therapistId, status } = req.query;

    let query = `
      SELECT 
        b.id,
        b.date,
        b.start_time,
        b.end_time,
        b.status,
        s.price as service_price,
        u_t.name as therapist_name,
        u_c.name as client_name
      FROM bookings b
      JOIN therapists t ON b.therapist_id = t.id
      JOIN users u_t ON t.user_id = u_t.id
      JOIN clients c ON b.client_id = c.id
      JOIN users u_c ON c.user_id = u_c.id
      JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    
    const queryParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND b.date >= $${paramIndex}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND b.date <= $${paramIndex}`;
      queryParams.push(endDate);
    }

    if (therapistId) {
      const paramIndex = queryParams.length + 1;
      query += ` AND b.therapist_id = $${paramIndex}`;
      queryParams.push(therapistId);
    }

    if (status) {
      const paramIndex = queryParams.length + 1;
      query += ` AND b.status = $${paramIndex}`;
      queryParams.push(status);
    }

    query += ` ORDER BY b.date, b.start_time`;

    // Executar query
    const bookingsResult = await pool.query(query, queryParams);

    // Calcular estatísticas
    let statsQuery = `
      SELECT 
        COUNT(*) as total_bookings,
        SUM(s.price) as total_revenue,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
        COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_bookings
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    
    const statsParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND b.date >= $${paramIndex}`;
      statsParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND b.date <= $${paramIndex}`;
      statsParams.push(endDate);
    }

    if (therapistId) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND b.therapist_id = $${paramIndex}`;
      statsParams.push(therapistId);
    }

    if (status) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND b.status = $${paramIndex}`;
      statsParams.push(status);
    }

    const statsResult = await pool.query(statsQuery, statsParams);

    res.json({
      success: true,
      data: {
        bookings: bookingsResult.rows,
        stats: statsResult.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/commissions - Relatório de comissões
router.get('/commissions', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { startDate, endDate, affiliateId, status } = req.query;

    let query = `
      SELECT 
        c.id,
        c.amount,
        c.commission_rate,
        c.status,
        c.created_at,
        u.name as affiliate_name,
        b.date as booking_date,
        s.name as service_name
      FROM commissions c
      JOIN affiliates a ON c.affiliate_id = a.id
      JOIN users u ON a.user_id = u.id
      JOIN bookings b ON c.booking_id = b.id
      JOIN services s ON b.service_id = s.id
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

    if (affiliateId) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.affiliate_id = $${paramIndex}`;
      queryParams.push(affiliateId);
    }

    if (status) {
      const paramIndex = queryParams.length + 1;
      query += ` AND c.status = $${paramIndex}`;
      queryParams.push(status);
    }

    query += ` ORDER BY c.created_at DESC`;

    // Executar query
    const commissionsResult = await pool.query(query, queryParams);

    // Calcular estatísticas
    let statsQuery = `
      SELECT 
        COUNT(*) as total_commissions,
        SUM(c.amount) as total_amount,
        SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN c.status = 'cancelled' THEN c.amount ELSE 0 END) as cancelled_amount,
        COUNT(DISTINCT c.affiliate_id) as active_affiliates
      FROM commissions c
      WHERE 1=1
    `;
    
    const statsParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND c.created_at >= $${paramIndex}`;
      statsParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND c.created_at <= $${paramIndex}`;
      statsParams.push(endDate);
    }

    if (affiliateId) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND c.affiliate_id = $${paramIndex}`;
      statsParams.push(affiliateId);
    }

    if (status) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND c.status = $${paramIndex}`;
      statsParams.push(status);
    }

    const statsResult = await pool.query(statsQuery, statsParams);

    res.json({
      success: true,
      data: {
        commissions: commissionsResult.rows,
        stats: statsResult.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/therapists - Relatório de terapeutas
router.get('/therapists', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        t.id,
        u.name as therapist_name,
        t.specialty,
        COUNT(b.id) as total_bookings,
        SUM(s.price) as total_revenue,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings
      FROM therapists t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN bookings b ON t.id = b.therapist_id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    
    const queryParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND (b.date >= $${paramIndex} OR b.date IS NULL)`;
      queryParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = queryParams.length + 1;
      query += ` AND (b.date <= $${paramIndex} OR b.date IS NULL)`;
      queryParams.push(endDate);
    }

    query += ` GROUP BY t.id, u.name, t.specialty ORDER BY total_revenue DESC`;

    // Executar query
    const therapistsResult = await pool.query(query, queryParams);

    // Calcular estatísticas gerais
    let statsQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as active_therapists,
        COUNT(b.id) as total_bookings,
        SUM(s.price) as total_revenue,
        AVG(COUNT(b.id)) OVER () as avg_bookings_per_therapist
      FROM therapists t
      LEFT JOIN bookings b ON t.id = b.therapist_id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    
    const statsParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND (b.date >= $${paramIndex} OR b.date IS NULL)`;
      statsParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND (b.date <= $${paramIndex} OR b.date IS NULL)`;
      statsParams.push(endDate);
    }

    const statsResult = await pool.query(statsQuery, statsParams);

    res.json({
      success: true,
      data: {
        therapists: therapistsResult.rows,
        stats: statsResult.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/financial - Relatório financeiro
router.get('/financial', authenticateToken, authorize(['admin']), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Receita por mês
    let revenueByMonthQuery = `
      SELECT 
        TO_CHAR(b.date, 'YYYY-MM') as month,
        SUM(s.price) as revenue,
        COUNT(b.id) as bookings_count
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.status = 'completed'
    `;
    
    const revenueByMonthParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = revenueByMonthParams.length + 1;
      revenueByMonthQuery += ` AND b.date >= $${paramIndex}`;
      revenueByMonthParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = revenueByMonthParams.length + 1;
      revenueByMonthQuery += ` AND b.date <= $${paramIndex}`;
      revenueByMonthParams.push(endDate);
    }

    revenueByMonthQuery += ` GROUP BY TO_CHAR(b.date, 'YYYY-MM') ORDER BY month`;

    const revenueByMonthResult = await pool.query(revenueByMonthQuery, revenueByMonthParams);

    // Comissões por mês
    let commissionsByMonthQuery = `
      SELECT 
        TO_CHAR(c.created_at, 'YYYY-MM') as month,
        SUM(c.amount) as commissions_amount,
        COUNT(c.id) as commissions_count
      FROM commissions c
      WHERE c.status = 'paid'
    `;
    
    const commissionsByMonthParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = commissionsByMonthParams.length + 1;
      commissionsByMonthQuery += ` AND c.created_at >= $${paramIndex}`;
      commissionsByMonthParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = commissionsByMonthParams.length + 1;
      commissionsByMonthQuery += ` AND c.created_at <= $${paramIndex}`;
      commissionsByMonthParams.push(endDate);
    }

    commissionsByMonthQuery += ` GROUP BY TO_CHAR(c.created_at, 'YYYY-MM') ORDER BY month`;

    const commissionsByMonthResult = await pool.query(commissionsByMonthQuery, commissionsByMonthParams);

    // Serviços mais populares
    let popularServicesQuery = `
      SELECT 
        s.id,
        s.name,
        COUNT(b.id) as bookings_count,
        SUM(s.price) as total_revenue
      FROM services s
      LEFT JOIN bookings b ON s.id = b.service_id
      WHERE b.status = 'completed'
    `;
    
    const popularServicesParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = popularServicesParams.length + 1;
      popularServicesQuery += ` AND b.date >= $${paramIndex}`;
      popularServicesParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = popularServicesParams.length + 1;
      popularServicesQuery += ` AND b.date <= $${paramIndex}`;
      popularServicesParams.push(endDate);
    }

    popularServicesQuery += ` GROUP BY s.id, s.name ORDER BY bookings_count DESC LIMIT 10`;

    const popularServicesResult = await pool.query(popularServicesQuery, popularServicesParams);

    // Estatísticas gerais
    let statsQuery = `
      SELECT 
        SUM(s.price) as total_revenue,
        SUM(c.amount) as total_commissions,
        (SUM(s.price) - SUM(c.amount)) as net_revenue,
        COUNT(b.id) as total_bookings,
        COUNT(DISTINCT t.id) as active_therapists,
        COUNT(DISTINCT a.id) as active_affiliates
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      LEFT JOIN commissions c ON b.id = c.booking_id
      LEFT JOIN therapists t ON b.therapist_id = t.id
      LEFT JOIN affiliates a ON c.affiliate_id = a.id
      WHERE b.status = 'completed'
    `;
    
    const statsParams = [];

    // Adicionar filtros
    if (startDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND b.date >= $${paramIndex}`;
      statsParams.push(startDate);
    }

    if (endDate) {
      const paramIndex = statsParams.length + 1;
      statsQuery += ` AND b.date <= $${paramIndex}`;
      statsParams.push(endDate);
    }

    const statsResult = await pool.query(statsQuery, statsParams);

    res.json({
      success: true,
      data: {
        revenueByMonth: revenueByMonthResult.rows,
        commissionsByMonth: commissionsByMonthResult.rows,
        popularServices: popularServicesResult.rows,
        stats: statsResult.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;