# routes/auth.js

```javascript
// routes/auth.js
// Rotas de autenticação - Lunara Afiliados
// Sistema completo de auth com JWT, rate limiting e validações

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const { executeQuery, executeTransaction } = require('../config/database');
const { emailService } = require('../config/email');
const { logger, logHelpers } = require('../utils/logger');
const { 
  asyncHandler, 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  ConflictError 
} = require('../middleware/errorHandler');

const router = express.Router();

// Rate limiting específico para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || '');
  }
});

// Função para gerar JWT
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'lunara-afiliados',
      audience: 'lunara-users'
    }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'lunara-afiliados',
      audience: 'lunara-users'
    }
  );

  return { accessToken, refreshToken };
};

// Middleware para validar token
const authenticateToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new AuthenticationError('Token de acesso requerido');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar dados atualizados do usuário
    const result = await executeQuery(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Usuário não encontrado');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AuthenticationError('Conta desativada');
    }

    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Token inválido');
    }
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expirado');
    }
    throw error;
  }
});

// Validações
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve conter pelo menos: 1 minúscula, 1 maiúscula e 1 número'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Nome deve ter entre 2 e 255 caracteres'),
  body('phone')
    .optional()
    .matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/)
    .withMessage('Telefone deve estar no formato (11) 99999-9999'),
  body('role')
    .optional()
    .isIn(['affiliate', 'therapist', 'client'])
    .withMessage('Role inválido')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
];

// ===== ROTAS =====

// POST /api/auth/register
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const { email, password, name, phone, role = 'client' } = req.body;

  // Verificar se email já existe
  const existingUser = await executeQuery(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw new ConflictError('Email já está em uso');
  }

  // Hash da senha
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Gerar token de verificação
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');

  // Criar usuário
  const result = await executeQuery(`
    INSERT INTO users (email, password_hash, name, phone, role, email_verification_token)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, name, role, created_at
  `, [email, passwordHash, name, phone, role, emailVerificationToken]);

  const user = result.rows[0];

  // Se for afiliado ou terapeuta, criar registro específico
  if (role === 'affiliate') {
    const affiliateCode = `${name.replace(/\s+/g, '').substring(0, 4).toUpperCase()}${Date.now().toString().slice(-4)}`;
    
    await executeQuery(`
      INSERT INTO affiliates (user_id, affiliate_code, status)
      VALUES ($1, $2, 'pending')
    `, [user.id, affiliateCode]);
  }

  if (role === 'therapist') {
    await executeQuery(`
      INSERT INTO therapists (user_id, specialty, hourly_rate, status)
      VALUES ($1, 'Não informado', 100.00, 'pending')
    `, [user.id]);
  }

  // Enviar email de verificação
  try {
    await emailService.sendEmailVerification(email, {
      name,
      verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`
    });
  } catch (error) {
    logger.warn('Erro ao enviar email de verificação:', error);
  }

  // Log da ação
  logHelpers.auth('REGISTER', user, { 
    role, 
    ip: req.ip, 
    userAgent: req.get('User-Agent') 
  });

  res.status(201).json({
    success: true,
    message: 'Usuário criado com sucesso. Verifique seu email.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }
  });
}));

// POST /api/auth/login
router.post('/login', authLimiter, loginValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const { email, password } = req.body;

  // Buscar usuário
  const result = await executeQuery(`
    SELECT u.*, 
           a.affiliate_code, a.status as affiliate_status,
           t.specialty, t.status as therapist_status
    FROM users u
    LEFT JOIN affiliates a ON u.id = a.user_id
    LEFT JOIN therapists t ON u.id = t.user_id
    WHERE u.email = $1
  `, [email]);

  if (result.rows.length === 0) {
    throw new AuthenticationError('Email ou senha inválidos');
  }

  const user = result.rows[0];

  // Verificar se conta está bloqueada
  if (user.locked_until && new Date() < user.locked_until) {
    const unlockTime = new Date(user.locked_until).toLocaleString('pt-BR');
    throw new AuthenticationError(`Conta bloqueada até ${unlockTime}`);
  }

  // Verificar senha
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    // Incrementar tentativas de login
    const newAttempts = (user.login_attempts || 0) + 1;
    const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null; // 30 min

    await executeQuery(`
      UPDATE users 
      SET login_attempts = $1, locked_until = $2
      WHERE id = $3
    `, [newAttempts, lockUntil, user.id]);

    logHelpers.security('FAILED_LOGIN', {
      email,
      attempts: newAttempts,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    throw new AuthenticationError('Email ou senha inválidos');
  }

  // Verificar se conta está ativa
  if (!user.is_active) {
    throw new AuthenticationError('Conta desativada');
  }

  // Reset login attempts e atualizar last_login
  await executeQuery(`
    UPDATE users 
    SET login_attempts = 0, locked_until = NULL, last_login = NOW()
    WHERE id = $1
  `, [user.id]);

  // Gerar tokens
  const { accessToken, refreshToken } = generateTokens(user);

  // Preparar dados do usuário
  const userData = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    isActive: user.is_active,
    emailVerified: user.email_verified,
    profileImage: user.profile_image,
    createdAt: user.created_at
  };

  // Adicionar dados específicos do role
  if (user.role === 'affiliate' && user.affiliate_code) {
    userData.affiliate = {
      code: user.affiliate_code,
      status: user.affiliate_status
    };
  }

  if (user.role === 'therapist' && user.specialty) {
    userData.therapist = {
      specialty: user.specialty,
      status: user.therapist_status
    };
  }

  // Log do login
  logHelpers.auth('LOGIN', user, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent') 
  });

  res.json({
    success: true,
    message: 'Login realizado com sucesso',
    data: {
      user: userData,
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  });
}));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AuthenticationError('Refresh token requerido');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Token inválido');
    }

    // Buscar usuário
    const result = await executeQuery(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Usuário não encontrado');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AuthenticationError('Conta desativada');
    }

    // Gerar novos tokens
    const tokens = generateTokens(user);

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      data: tokens
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token inválido ou expirado');
    }
    throw error;
  }
}));

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Email inválido');
  }

  const { email } = req.body;

  // Buscar usuário
  const result = await executeQuery(
    'SELECT id, name FROM users WHERE email = $1 AND is_active = true',
    [email]
  );

  // Sempre retornar sucesso para não revelar se email existe
  if (result.rows.length === 0) {
    return res.json({
      success: true,
      message: 'Se o email existir, você receberá instruções para redefinir sua senha'
    });
  }

  const user = result.rows[0];

  // Gerar token de reset
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  // Salvar token
  await executeQuery(`
    UPDATE users 
    SET password_reset_token = $1, password_reset_expires = $2
    WHERE id = $3
  `, [resetToken, resetExpires, user.id]);

  // Enviar email
  try {
    await emailService.sendPasswordReset(email, {
      name: user.name,
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
    });
  } catch (error) {
    logger.warn('Erro ao enviar email de reset:', error);
  }

  // Log da ação
  logHelpers.auth('PASSWORD_RESET_REQUEST', user, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent') 
  });

  res.json({
    success: true,
    message: 'Se o email existir, você receberá instruções para redefinir sua senha'
  });
}));

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token é obrigatório'),
  body('password')
    .isLength({ min: 6 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve ter pelo menos 6 caracteres com maiúscula, minúscula e número')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Dados inválidos', errors.array());
  }

  const { token, password } = req.body;

  // Buscar usuário pelo token
  const result = await executeQuery(`
    SELECT id, email, name 
    FROM users 
    WHERE password_reset_token = $1 
    AND password_reset_expires > NOW()
    AND is_active = true
  `, [token]);

  if (result.rows.length === 0) {
    throw new AuthenticationError('Token inválido ou expirado');
  }

  const user = result.rows[0];

  // Hash da nova senha
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Atualizar senha e limpar token
  await executeQuery(`
    UPDATE users 
    SET password_hash = $1, 
        password_reset_token = NULL, 
        password_reset_expires = NULL,
        login_attempts = 0,
        locked_until = NULL
    WHERE id = $2
  `, [passwordHash, user.id]);

  // Log da ação
  logHelpers.auth('PASSWORD_RESET', user, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent') 
  });

  res.json({
    success: true,
    message: 'Senha redefinida com sucesso'
  });
}));

// POST /api/auth/verify-email
router.post('/verify-email', [
  body('token').notEmpty().withMessage('Token é obrigatório')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Token é obrigatório');
  }

  const { token } = req.body;

  // Buscar usuário pelo token
  const result = await executeQuery(`
    SELECT id, email, name, role
    FROM users 
    WHERE email_verification_token = $1
    AND is_active = true
  `, [token]);

  if (result.rows.length === 0) {
    throw new AuthenticationError('Token de verificação inválido');
  }

  const user = result.rows[0];

  // Marcar email como verificado
  await executeQuery(`
    UPDATE users 
    SET email_verified = true, email_verification_token = NULL
    WHERE id = $1
  `, [user.id]);

  // Enviar email de boas-vindas
  try {
    await emailService.sendWelcomeEmail(user.email, {
      name: user.name,
      role: user.role
    });
  } catch (error) {
    logger.warn('Erro ao enviar email de boas-vindas:', error);
  }

  // Log da ação
  logHelpers.auth('EMAIL_VERIFIED', user, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent') 
  });

  res.json({
    success: true,
    message: 'Email verificado com sucesso'
  });
}));

// GET /api/auth/me
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Buscar dados completos do usuário
  const result = await executeQuery(`
    SELECT u.*, 
           a.affiliate_code, a.commission_rate as affiliate_commission, 
           a.total_referrals, a.total_earnings, a.current_balance,
           a.status as affiliate_status,
           t.specialty, t.license_number, t.hourly_rate, 
           t.commission_rate as therapist_commission, t.rating, 
           t.total_appointments, t.status as therapist_status
    FROM users u
    LEFT JOIN affiliates a ON u.id = a.user_id
    LEFT JOIN therapists t ON u.id = t.user_id
    WHERE u.id = $1
  `, [userId]);

  const user = result.rows[0];

  const userData = {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.is_active,
    emailVerified: user.email_verified,
    profileImage: user.profile_image,
    timezone: user.timezone,
    language: user.language,
    lastLogin: user.last_login,
    createdAt: user.created_at
  };

  // Adicionar dados específicos
  if (user.role === 'affiliate') {
    userData.affiliate = {
      code: user.affiliate_code,
      commissionRate: user.affiliate_commission,
      totalReferrals: user.total_referrals,
      totalEarnings: user.total_earnings,
      currentBalance: user.current_balance,
      status: user.affiliate_status
    };
  }

  if (user.role === 'therapist') {
    userData.therapist = {
      specialty: user.specialty,
      licenseNumber: user.license_number,
      hourlyRate: user.hourly_rate,
      commissionRate: user.therapist_commission,
      rating: user.rating,
      totalAppointments: user.total_appointments,
      status: user.therapist_status
    };
  }

  res.json({
    success: true,
    data: { user: userData }
  });
}));

// POST /api/auth/logout
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // Log da ação
  logHelpers.auth('LOGOUT', req.user, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent') 
  });

  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
}));

module.exports = { router, authenticateToken };
```
