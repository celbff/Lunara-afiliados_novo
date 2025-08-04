// routes/auth.js
// Rotas de autenticação - Lunara Afiliados

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

const { pool, transaction } = require('../config/database');
const { sendEmail } = require('../config/email');
const { authenticate, authorize } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { validateUserRegistration, validateLogin } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// =============================================
// VALIDAÇÕES
// =============================================

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token é obrigatório'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nova senha deve conter ao menos: 1 letra minúscula, 1 maiúscula e 1 número')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido')
];

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

// Gerar JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Gerar refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// Criar sessão no banco
const createSession = async (userId, token, refreshToken, req) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

  await pool.query(`
    INSERT INTO sessions (user_id, token_hash, refresh_token_hash, expires_at, user_agent, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, token, refreshToken, expiresAt, req.get('User-Agent'), req.ip]);
};

// =============================================
// ROTAS
// =============================================

// POST /api/auth/register - Registro de usuário
router.post('/register', registerLimiter, validateUserRegistration, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { name, email, password, role = 'cliente', phone } = req.body;

    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email já está em uso'
      });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 12);

    // Criar usuário em transação
    const result = await transaction(async (client) => {
      // Inserir usuário
      const userResult = await client.query(`
        INSERT INTO users (name, email, password_hash, role, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, phone, created_at
      `, [name, email, passwordHash, role, phone]);

      const user = userResult.rows[0];

      // Criar perfil específico baseado no role
      if (role === 'terapeuta') {
        await client.query(`
          INSERT INTO profiles (user_id, bio, specializations, experience_years)
          VALUES ($1, '', '{}', 0)
        `, [user.id]);
      } else if (role === 'afiliado') {
        // Gerar código único para afiliado
        const affiliateCode = `AF${user.id}${Date.now().toString().slice(-4)}`;
        
        await client.query(`
          INSERT INTO affiliates (user_id, affiliate_code, commission_rate)
          VALUES ($1, $2, $3)
        `, [user.id, affiliateCode, 15.00]);
      }

      return user;
    });

    // Gerar tokens
    const token = generateToken(result);
    const refreshToken = generateRefreshToken();

    // Criar sessão
    await createSession(result.id, token, refreshToken, req);

    // Enviar email de boas-vindas (se configurado)
    try {
      await sendEmail({
        to: email,
        subject: 'Bem-vindo ao Lunara Afiliados',
        template: 'welcome',
        data: {
          name,
          email,
          loginUrl: `${process.env.FRONTEND_URL}/login`
        }
      });
    } catch (emailError) {
      logger.error('Erro ao enviar email de boas-vindas:', emailError);
    }

    logger.info(`Novo usuário registrado: ${email} (${role})`);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          role: result.role,
          phone: result.phone,
          created_at: result.created_at
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - Login
router.post('/login', loginLimiter, validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Buscar usuário
    const userResult = await pool.query(`
      SELECT u.*, p.bio, p.specializations, p.experience_years,
             a.affiliate_code, a.commission_rate, a.total_earnings
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN affiliates a ON u.id = a.user_id
      WHERE u.email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    const user = userResult.rows[0];

    // Verificar se usuário está ativo
    if (user.status !== 'ativo') {
      return res.status(401).json({
        success: false,
        message: 'Conta inativa. Entre em contato com o suporte.'
      });
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Gerar tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken();

    // Criar sessão
    await createSession(user.id, token, refreshToken, req);

    // Atualizar último login
    await pool.query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info(`Login realizado: ${email}`);

    // Remover dados sensíveis
    const { password_hash, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: safeUser,
        token,
        refreshToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout - Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const token = req.token;

    // Remover sessão
    await pool.query(
      'DELETE FROM sessions WHERE user_id = $1 AND token_hash = $2',
      [userId, token]
    );

    logger.info(`Logout realizado: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh - Renovar token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token é obrigatório'
      });
    }

    // Buscar sessão
    const sessionResult = await pool.query(`
      SELECT s.*, u.id, u.email, u.role, u.status
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.refresh_token_hash = $1 AND s.expires_at > NOW()
    `, [refreshToken]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido ou expirado'
      });
    }

    const session = sessionResult.rows[0];

    // Verificar se usuário ainda está ativo
    if (session.status !== 'ativo') {
      await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]);
      return res.status(401).json({
        success: false,
        message: 'Conta inativa'
      });
    }

    // Gerar novos tokens
    const newToken = generateToken({
      id: session.user_id,
      email: session.email,
      role: session.role
    });
    const newRefreshToken = generateRefreshToken();

    // Atualizar sessão
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(`
      UPDATE sessions 
      SET token_hash = $1, refresh_token_hash = $2, expires_at = $3, last_used_at = NOW()
      WHERE id = $4
    `, [newToken, newRefreshToken, expiresAt, session.id]);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password - Esqueci minha senha
router.post('/forgot-password', forgotPasswordValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Buscar usuário
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1 AND status = $2',
      [email, 'ativo']
    );

    // Sempre retornar sucesso por segurança
    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.'
      });
    }

    const user = userResult.rows[0];

    // Gerar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salvar token no banco
    await pool.query(`
      UPDATE users 
      SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW()
      WHERE id = $3
    `, [resetTokenHash, resetExpires, user.id]);

    // Enviar email
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      await sendEmail({
        to: email,
        subject: 'Redefinir senha - Lunara Afiliados',
        template: 'password-reset',
        data: {
          name: user.name,
          resetUrl
        }
      });

      logger.info(`Email de reset de senha enviado para: ${email}`);
    } catch (emailError) {
      logger.error('Erro ao enviar email de reset:', emailError);
      
      // Limpar token se email falhou
      await pool.query(
        'UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1',
        [user.id]
      );

      return res.status(500).json({
        success: false,
        message: 'Erro ao enviar email. Tente novamente.'
      });
    }

    res.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.'
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password - Redefinir senha
router.post('/reset-password', resetPasswordValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { token, newPassword } = req.body;

    // Hash do token para comparação
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar usuário pelo token
    const userResult = await pool.query(`
      SELECT id, name, email 
      FROM users 
      WHERE password_reset_token = $1 
        AND password_reset_expires > NOW()
        AND status = 'ativo'
    `, [resetTokenHash]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    const user = userResult.rows[0];

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Atualizar senha e limpar token
    await pool.query(`
      UPDATE users 
      SET password_hash = $1, 
          password_reset_token = NULL, 
          password_reset_expires = NULL,
          updated_at = NOW()
      WHERE id = $2
    `, [passwordHash, user.id]);

    // Invalidar todas as sessões existentes
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

    logger.info(`Senha redefinida para: ${user.email}`);

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso. Faça login com sua nova senha.'
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Obter dados do usuário logado
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Buscar dados completos do usuário
    const userResult = await pool.query(`
      SELECT u.*, p.bio, p.specializations, p.experience_years, p.license_number,
             a.affiliate_code, a.commission_rate, a.total_earnings, a.total_referrals
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN affiliates a ON u.id = a.user_id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const user = userResult.rows[0];
    
    // Remover dados sensíveis
    const { password_hash, password_reset_token, password_reset_expires, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify-token - Verificar se token é válido
router.post('/verify-token', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token é obrigatório'
      });
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar se sessão existe no banco
    const sessionResult = await pool.query(`
      SELECT s.id, u.id as user_id, u.email, u.role, u.status
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
    `, [token]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    const session = sessionResult.rows[0];

    if (session.status !== 'ativo') {
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo'
      });
    }

    res.json({
      success: true,
      message: 'Token válido',
      data: {
        user: {
          id: session.user_id,
          email: session.email,
          role: session.role
        }
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    next(error);
  }
});

module.exports = router;