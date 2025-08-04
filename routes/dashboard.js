# routes/dashboard.js

```javascript
// routes/dashboard.js
// Dashboard integrado - Lunara Afiliados + Agenda 2.0
// Métricas unificadas para todos os roles

const express = require('express');
const { query, validationResult } = require('express-validator');
const moment = require('moment');

const { executeQuery } = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticateToken } = require('./auth');
const { 
  asyncHandler, 
  ValidationError,
  AuthorizationError 
} = require('../middleware/errorHandler');

const router = express.Router();

// ===== VALIDAÇÕES =====
const dashboardValidation = [
  query('period').optional().isIn(['today', '7d', '30d', '90d', '6m', '1y']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601()
];

// ===== FUNÇÕES AUXILIARES =====

// Definir período de datas
const getDateRange = (period, dateFrom, dateTo) => {
  let startDate, endDate;
  
  if (dateFrom && dateTo) {
    startDate = moment(dateFrom).startOf('day');
    endDate = moment(dateTo).endOf('day');
  } else {
    endDate = moment().endOf('day');
    
    switch (period) {
      case 'today':
        startDate = moment().startOf('day');
        break;
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
  
  return { startDate, endDate };
};

// Dashboard para Admin
const getAdminDashboard = async (startDate, endDate) => {
  // Métricas gerais
  const overviewQuery = `
    SELECT 
      COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'client') as total_clients,
      COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'affiliate') as total_affiliates,
      COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'therapist') as total_therapists,
      COUNT(DISTINCT b.id) as total_bookings,
      COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
      COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
      COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as total_revenue,
      COALESCE(SUM(b.affiliate_commission) FILTER (WHERE b.status = 'completed'), 0) as total_affiliate_commission,
      COALESCE(SUM(b.therapist_commission) FILTER (WHERE b.status = 'completed'), 0) as total_therapist_commission
    FROM users u
    FULL OUTER JOIN bookings b ON b.created_at BETWEEN $1 AND $2
  `;

  const overviewResult = await executeQuery(overviewQuery, [startDate, endDate]);
  const overview = overviewResult.rows[0];

  // Agendamentos por status
  const bookingsByStatusQuery = `
    SELECT 
      status,
      COUNT(*) as count,
      SUM(total_amount) as total_amount
    FROM bookings
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY status
    ORDER BY count DESC
  `;

  const bookingsByStatusResult = await executeQuery(bookingsByStatusQuery, [startDate, endDate]);

  // Evolução temporal
  const timeSeriesQuery = `
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      COUNT(*) as bookings,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as revenue
    FROM bookings
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date
  `;

  const timeSeriesResult = await executeQuery(timeSeriesQuery, [startDate, endDate]);

  // Top terapeutas
  const topTherapistsQuery = `
    SELECT 
      u.name,
      t.specialty,
      COUNT(b.id) as total_bookings,
      COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
      COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as revenue,
      COALESCE(AVG(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as avg_booking_value
    FROM therapists t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN bookings b ON t.id = b.therapist_id AND b.created_at BETWEEN $1 AND $2
    GROUP BY u.id, u.name, t.specialty
    HAVING COUNT(b.id) > 0
    ORDER BY revenue DESC
    LIMIT 10
  `;

  const topTherapistsResult = await executeQuery(topTherapistsQuery, [startDate, endDate]);

  // Top afiliados
  const topAffiliatesQuery = `
    SELECT 
      u.name,
      a.affiliate_code,
      COUNT(b.id) as total_referrals,
      COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_referrals,
      COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as revenue_generated,
      COALESCE(SUM(b.affiliate_commission) FILTER (WHERE b.status = 'completed'), 0) as commission_earned
    FROM affiliates a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN bookings b ON a.id = b.affiliate_id AND b.created_at BETWEEN $1 AND $2
    GROUP BY u.id, u.name, a.affiliate_code
    HAVING COUNT(b.id) > 0
    ORDER BY revenue_generated DESC
    LIMIT 10
  `;

  const topAffiliatesResult = await executeQuery(topAffiliatesQuery, [startDate, endDate]);

  // Próximos agendamentos
  const upcomingBookingsQuery = `
    SELECT 
      b.id,
      b.client_name,
      b.scheduled_date,
      b.scheduled_time,
      b.status,
      s.name as service_name,
      u.name as therapist_name
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE b.scheduled_date >= CURRENT_DATE
    AND b.status IN ('pending', 'confirmed')
    ORDER BY b.scheduled_date, b.scheduled_time
    LIMIT 10
  `;

  const upcomingBookingsResult = await executeQuery(upcomingBookingsQuery, []);

  return {
    overview: {
      totalClients: parseInt(overview.total_clients) || 0,
      totalAffiliates: parseInt(overview.total_affiliates) || 0,
      totalTherapists: parseInt(overview.total_therapists) || 0,
      totalBookings: parseInt(overview.total_bookings) || 0,
      completedBookings: parseInt(overview.completed_bookings) || 0,
      cancelledBookings: parseInt(overview.cancelled_bookings) || 0,
      totalRevenue: parseFloat(overview.total_revenue) || 0,
      totalAffiliateCommission: parseFloat(overview.total_affiliate_commission) || 0,
      totalTherapistCommission: parseFloat(overview.total_therapist_commission) || 0,
      conversionRate: overview.total_bookings > 0 
        ? ((overview.completed_bookings / overview.total_bookings) * 100).toFixed(2)
        : 0
    },
    bookingsByStatus: bookingsByStatusResult.rows.map(row => ({
      status: row.status,
      count: parseInt(row.count),
      totalAmount: parseFloat(row.total_amount) || 0
    })),
    timeSeries: timeSeriesResult.rows.map(row => ({
      date: row.date,
      bookings: parseInt(row.bookings),
      completed: parseInt(row.completed),
      cancelled: parseInt(row.cancelled),
      revenue: parseFloat(row.revenue)
    })),
    topTherapists: topTherapistsResult.rows.map(row => ({
      name: row.name,
      specialty: row.specialty,
      totalBookings: parseInt(row.total_bookings),
      completedBookings: parseInt(row.completed_bookings),
      revenue: parseFloat(row.revenue),
      avgBookingValue: parseFloat(row.avg_booking_value)
    })),
    topAffiliates: topAffiliatesResult.rows.map(row => ({
      name: row.name,
      affiliateCode: row.affiliate_code,
      totalReferrals: parseInt(row.total_referrals),
      completedReferrals: parseInt(row.completed_referrals),
      revenueGenerated: parseFloat(row.revenue_generated),
      commissionEarned: parseFloat(row.commission_earned)
    })),
    upcomingBookings: upcomingBookingsResult.rows
  };
};

// Dashboard para Terapeuta
const getTherapistDashboard = async (userId, startDate, endDate) => {
  // Buscar ID do terapeuta
  const therapistResult = await executeQuery(
    'SELECT id FROM therapists WHERE user_id = $1',
    [userId]
  );

  if (therapistResult.rows.length === 0) {
    throw new AuthorizationError('Terapeuta não encontrado');
  }

  const therapistId = therapistResult.rows[0].id;

  // Métricas do terapeuta
  const metricsQuery = `
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_bookings,
      COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
      COALESCE(SUM(therapist_commission) FILTER (WHERE status = 'completed'), 0) as total_commission,
      COALESCE(AVG(total_amount) FILTER (WHERE status = 'completed'), 0) as avg_session_value,
      COUNT(DISTINCT client_email) as unique_clients
    FROM bookings
    WHERE therapist_id = $1
    AND created_at BETWEEN $2 AND $3
  `;

  const metricsResult = await executeQuery(metricsQuery, [therapistId, startDate, endDate]);
  const metrics = metricsResult.rows[0];

  // Agendamentos hoje
  const todayBookingsQuery = `
    SELECT 
      b.id,
      b.client_name,
      b.client_phone,
      b.scheduled_time,
      b.status,
      b.notes,
      b.meeting_link,
      s.name as service_name,
      s.duration
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.therapist_id = $1
    AND b.scheduled_date = CURRENT_DATE
    ORDER BY b.scheduled_time
  `;

  const todayBookingsResult = await executeQuery(todayBookingsQuery, [therapistId]);

  // Próximos agendamentos (próximos 7 dias)
  const upcomingBookingsQuery = `
    SELECT 
      b.id,
      b.client_name,
      b.scheduled_date,
      b.scheduled_time,
      b.status,
      s.name as service_name,
      s.duration
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.therapist_id = $1
    AND b.scheduled_date > CURRENT_DATE
    AND b.scheduled_date <= CURRENT_DATE + INTERVAL '7 days'
    AND b.status IN ('pending', 'confirmed')
    ORDER BY b.scheduled_date, b.scheduled_time
    LIMIT 10
  `;

  const upcomingBookingsResult = await executeQuery(upcomingBookingsQuery, [therapistId]);

  // Evolução semanal
  const weeklyStatsQuery = `
    SELECT 
      EXTRACT(WEEK FROM created_at) as week,
      COUNT(*) as bookings,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as revenue
    FROM bookings
    WHERE therapist_id = $1
    AND created_at >= DATE_TRUNC('week', $2)
    AND created_at <= $3
    GROUP BY EXTRACT(WEEK FROM created_at)
    ORDER BY week
  `;

  const weeklyStatsResult = await executeQuery(weeklyStatsQuery, [therapistId, startDate, endDate]);

  return {
    metrics: {
      totalBookings: parseInt(metrics.total_bookings) || 0,
      completedBookings: parseInt(metrics.completed_bookings) || 0,
      cancelledBookings: parseInt(metrics.cancelled_bookings) || 0,
      pendingBookings: parseInt(metrics.pending_bookings) || 0,
      confirmedBookings: parseInt(metrics.confirmed_bookings) || 0,
      totalRevenue: parseFloat(metrics.total_revenue) || 0,
      totalCommission: parseFloat(metrics.total_commission) || 0,
      avgSessionValue: parseFloat(metrics.avg_session_value) || 0,
      uniqueClients: parseInt(metrics.unique_clients) || 0,
      conversionRate: metrics.total_bookings > 0 
        ? ((metrics.completed_bookings / metrics.total_bookings) * 100).toFixed(2)
        : 0
    },
    todayBookings: todayBookingsResult.rows,
    upcomingBookings: upcomingBookingsResult.rows,
    weeklyStats: weeklyStatsResult.rows.map(row => ({
      week: parseInt(row.week),
      bookings: parseInt(row.bookings),
      completed: parseInt(row.completed),
      revenue: parseFloat(row.revenue)
    }))
  };
};

// Dashboard para Afiliado
const getAffiliateDashboard = async (userId, startDate, endDate) => {
  // Buscar ID do afiliado
  const affiliateResult = await executeQuery(
    'SELECT id, affiliate_code, commission_rate FROM affiliates WHERE user_id = $1',
    [userId]
  );

  if (affiliateResult.rows.length === 0) {
    throw new AuthorizationError('Afiliado não encontrado');
  }

  const affiliate = affiliateResult.rows[0];

  // Métricas do afiliado
  const metricsQuery = `
    SELECT 
      COUNT(*) as total_referrals,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_referrals,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_referrals,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as revenue_generated,
      COALESCE(SUM(affiliate_commission) FILTER (WHERE status = 'completed'), 0) as commission_earned,
      COALESCE(AVG(total_amount) FILTER (WHERE status = 'completed'), 0) as avg_referral_value,
      COUNT(DISTINCT client_email) as unique_clients
    FROM bookings
    WHERE affiliate_id = $1
    AND created_at BETWEEN $2 AND $3
  `;

  const metricsResult = await executeQuery(metricsQuery, [affiliate.id, startDate, endDate]);
  const metrics = metricsResult.rows[0];

  // Comissões pendentes de pagamento
  const pendingCommissionsQuery = `
    SELECT 
      COALESCE(SUM(affiliate_amount), 0) as pending_amount,
      COUNT(*) as pending_count
    FROM commissions
    WHERE affiliate_id = $1
    AND status = 'calculated'
  `;

  const pendingCommissionsResult = await executeQuery(pendingCommissionsQuery, [affiliate.id]);
  const pendingCommissions = pendingCommissionsResult.rows[0];

  // Últimos referrals
  const recentReferralsQuery = `
    SELECT 
      b.id,
      b.client_name,
      b.client_email,
      b.scheduled_date,
      b.status,
      b.total_amount,
      b.affiliate_commission,
      b.created_at,
      s.name as service_name,
      u.name as therapist_name
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE b.affiliate_id = $1
    ORDER BY b.created_at DESC
    LIMIT 10
  `;

  const recentReferralsResult = await executeQuery(recentReferralsQuery, [affiliate.id]);

  // Top serviços referenciados
  const topServicesQuery = `
    SELECT 
      s.name,
      s.category,
      COUNT(b.id) as referral_count,
      COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as revenue,
      COALESCE(SUM(b.affiliate_commission) FILTER (WHERE b.status = 'completed'), 0) as commission
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE b.affiliate_id = $1
    AND b.created_at BETWEEN $2 AND $3
    GROUP BY s.id, s.name, s.category
    ORDER BY referral_count DESC
    LIMIT 5
  `;

  const topServicesResult = await executeQuery(topServicesQuery, [affiliate.id, startDate, endDate]);

  return {
    affiliate: {
      code: affiliate.affiliate_code,
      commissionRate: parseFloat(affiliate.commission_rate)
    },
    metrics: {
      totalReferrals: parseInt(metrics.total_referrals) || 0,
      completedReferrals: parseInt(metrics.completed_referrals) || 0,
      cancelledReferrals: parseInt(metrics.cancelled_referrals) || 0,
      pendingReferrals: parseInt(metrics.pending_referrals) || 0,
      revenueGenerated: parseFloat(metrics.revenue_generated) || 0,
      commissionEarned: parseFloat(metrics.commission_earned) || 0,
      avgReferralValue: parseFloat(metrics.avg_referral_value) || 0,
      uniqueClients: parseInt(metrics.unique_clients) || 0,
      conversionRate: metrics.total_referrals > 0 
        ? ((metrics.completed_referrals / metrics.total_referrals) * 100).toFixed(2)
        : 0,
      pendingCommissionAmount: parseFloat(pendingCommissions.pending_amount) || 0,
      pendingCommissionCount: parseInt(pendingCommissions.pending_count) || 0
    },
    recentReferrals: recentReferralsResult.rows,
    topServices: topServicesResult.rows.map(row => ({
      name: row.name,
      category: row.category,
      referralCount: parseInt(row.referral_count),
      revenue: parseFloat(row.revenue),
      commission: parseFloat(row.commission)
    }))
  };
};

// Dashboard para Cliente
const getClientDashboard = async (userId, userEmail, startDate, endDate) => {
  // Métricas do cliente
  const metricsQuery = `
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_sessions,
      COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed')) as upcoming_sessions,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_spent,
      COALESCE(AVG(total_amount) FILTER (WHERE status = 'completed'), 0) as avg_session_cost,
      COUNT(DISTINCT therapist_id) as therapists_visited,
      COUNT(DISTINCT service_id) as services_used
    FROM bookings
    WHERE (client_id = $1 OR client_email = $2)
    AND created_at BETWEEN $3 AND $4
  `;

  const metricsResult = await executeQuery(metricsQuery, [userId, userEmail, startDate, endDate]);
  const metrics = metricsResult.rows[0];

  // Próximas sessões
  const upcomingSessionsQuery = `
    SELECT 
      b.id,
      b.scheduled_date,
      b.scheduled_time,
      b.status,
      b.notes,
      b.meeting_link,
      s.name as service_name,
      s.duration,
      s.is_online,
      u.name as therapist_name,
      t.specialty
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE (b.client_id = $1 OR b.client_email = $2)
    AND b.scheduled_date >= CURRENT_DATE
    AND b.status IN ('pending', 'confirmed')
    ORDER BY b.scheduled_date, b.scheduled_time
    LIMIT 5
  `;

  const upcomingSessionsResult = await executeQuery(upcomingSessionsQuery, [userId, userEmail]);

  // Histórico recente
  const recentSessionsQuery = `
    SELECT 
      b.id,
      b.scheduled_date,
      b.scheduled_time,
      b.status,
      b.total_amount,
      s.name as service_name,
      u.name as therapist_name,
      t.specialty
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE (b.client_id = $1 OR b.client_email = $2)
    ORDER BY b.scheduled_date DESC, b.scheduled_time DESC
    LIMIT 10
  `;

  const recentSessionsResult = await executeQuery(recentSessionsQuery, [userId, userEmail]);

  // Terapeutas favoritos
  const favoriteTherapistsQuery = `
    SELECT 
      u.name,
      t.specialty,
      COUNT(b.id) as session_count,
      COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_sessions,
      COALESCE(AVG(b.total_amount) FILTER (WHERE b.status = 'completed'), 0) as avg_cost
    FROM bookings b
    JOIN therapists t ON b.therapist_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE (b.client_id = $1 OR b.client_email = $2)
    AND b.created_at BETWEEN $3 AND $4
    GROUP BY u.id, u.name, t.specialty
    ORDER BY session_count DESC
    LIMIT 5
  `;

  const favoriteTherapistsResult = await executeQuery(favoriteTherapistsQuery, [userId, userEmail, startDate, endDate]);

  return {
    metrics: {
      totalBookings: parseInt(metrics.total_bookings) || 0,
      completedSessions: parseInt(metrics.completed_sessions) || 0,
      cancelledSessions: parseInt(metrics.cancelled_sessions) || 0,
      upcomingSessions: parseInt(metrics.upcoming_sessions) || 0,
      totalSpent: parseFloat(metrics.total_spent) || 0,
      avgSessionCost: parseFloat(metrics.avg_session_cost) || 0,
      therapistsVisited: parseInt(metrics.therapists_visited) || 0,
      servicesUsed: parseInt(metrics.services_used) || 0
    },
    upcomingSessions: upcomingSessionsResult.rows,
    recentSessions: recentSessionsResult.rows,
    favoriteTherapists: favoriteTherapistsResult.rows.map(row => ({
      name: row.name,
      specialty: row.specialty,
      sessionCount: parseInt(row.session_count),
      completedSessions: parseInt(row.completed_sessions),
      avgCost: parseFloat(row.avg_cost)
    }))
  };
};

// ===== ROTAS =====

// GET /api/dashboard - Dashboard principal
router.get('/', authenticateToken, dashboardValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Parâmetros inválidos', errors.array());
  }

  const { period = '30d', dateFrom, dateTo } = req.query;
  const { startDate, endDate } = getDateRange(period, dateFrom, dateTo);

  let dashboardData;

  switch (req.user.role) {
    case 'admin':
      dashboardData = await getAdminDashboard(startDate, endDate);
      break;
    
    case 'therapist':
      dashboardData = await getTherapistDashboard(req.user.id, startDate, endDate);
      break;
    
    case 'affiliate':
      dashboardData = await getAffiliateDashboard(req.user.id, startDate, endDate);
      break;
    
    case 'client':
      dashboardData = await getClientDashboard(req.user.id, req.user.email, startDate, endDate);
      break;
    
    default:
      throw new AuthorizationError('Role não autorizado para dashboard');
  }

  res.json({
    success: true,
    data: {
      period: {
        start: startDate.format(),
        end: endDate.format(),
        label: period
      },
      role: req.user.role,
      ...dashboardData
    }
  });
}));

// GET /api/dashboard/stats - Estatísticas rápidas
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  
  let stats = {};

  if (req.user.role === 'admin') {
    // Stats para admin
    const adminStatsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'client') as total_clients,
        (SELECT COUNT(*) FROM users WHERE role = 'affiliate') as total_affiliates,
        (SELECT COUNT(*) FROM users WHERE role = 'therapist') as total_therapists,
        (SELECT COUNT(*) FROM bookings WHERE scheduled_date = $1) as today_bookings,
        (SELECT COUNT(*) FROM bookings WHERE scheduled_date = $1 AND status = 'pending') as today_pending,
        (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE scheduled_date = $1 AND status = 'completed') as today_revenue
    `;
    
    const result = await executeQuery(adminStatsQuery, [today]);
    stats = result.rows[0];
    
  } else if (req.user.role === 'therapist') {
    // Stats para terapeuta
    const therapistResult = await executeQuery(
      'SELECT id FROM therapists WHERE user_id = $1',
      [req.user.id]
    );
    
    if (therapistResult.rows.length > 0) {
      const therapistId = therapistResult.rows[0].id;
      
      const therapistStatsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM bookings WHERE therapist_id = $1 AND scheduled_date = $2) as today_bookings,
          (SELECT COUNT(*) FROM bookings WHERE therapist_id = $1 AND scheduled_date = $2 AND status = 'pending') as today_pending,
          (SELECT COUNT(*) FROM bookings WHERE therapist_id = $1 AND scheduled_date > $2 AND status IN ('pending', 'confirmed')) as upcoming_bookings,
          (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE therapist_id = $1 AND DATE_TRUNC('month', scheduled_date) = DATE_TRUNC('month', $2::date) AND status = 'completed') as month_revenue
      `;
      
      const result = await executeQuery(therapistStatsQuery, [therapistId, today]);
      stats = result.rows[0];
    }
    
  } else if (req.user.role === 'affiliate') {
    // Stats para afiliado
    const affiliateResult = await executeQuery(
      'SELECT id FROM affiliates WHERE user_id = $1',
      [req.user.id]
    );
    
    if (affiliateResult.rows.length > 0) {
      const affiliateId = affiliateResult.rows[0].id;
      
      const affiliateStatsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM bookings WHERE affiliate_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $2::date)) as month_referrals,
          (SELECT COUNT(*) FROM bookings WHERE affiliate_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $2::date) AND status = 'completed') as month_completed,
          (SELECT COALESCE(SUM(affiliate_commission), 0) FROM bookings WHERE affiliate_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $2::date) AND status = 'completed') as month_commission,
          (SELECT COALESCE(SUM(affiliate_amount), 0) FROM commissions WHERE affiliate_id = $1 AND status = 'calculated') as pending_payment
      `;
      
      const result = await executeQuery(affiliateStatsQuery, [affiliateId, today]);
      stats = result.rows[0];
    }
    
  } else if (req.user.role === 'client') {
    // Stats para cliente
    const clientStatsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM bookings WHERE (client_id = $1 OR client_email = $2) AND scheduled_date >= $3 AND status IN ('pending', 'confirmed')) as upcoming_sessions,
        (SELECT COUNT(*) FROM bookings WHERE (client_id = $1 OR client_email = $2) AND DATE_TRUNC('month', scheduled_date) = DATE_TRUNC('month', $3::date)) as month_sessions,
        (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE (client_id = $1 OR client_email = $2) AND DATE_TRUNC('month', scheduled_date) = DATE_TRUNC('month', $3::date) AND status = 'completed') as month_spent,
        (SELECT COUNT(DISTINCT therapist_id) FROM bookings WHERE (client_id = $1 OR client_email = $2)) as therapists_count
    `;
    
    const result = await executeQuery(clientStatsQuery, [req.user.id, req.user.email, today]);
    stats = result.rows[0];
  }

  // Converter valores para números
  Object.keys(stats).forEach(key => {
    if (stats[key] !== null && stats[key] !== undefined) {
      stats[key] = isNaN(parseFloat(stats[key])) ? parseInt(stats[key]) : parseFloat(stats[key]);
    }
  });

  res.json({
    success: true,
    data: {
      role: req.user.role,
      stats
    }
  });
}));

module.exports = router;
```
