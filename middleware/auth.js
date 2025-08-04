// middleware/auth.js
// Middleware de autenticação e autorização

const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

// Middleware de autenticação
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') ||
                  req.cookies?.token ||
                  req.query?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso necessário'
      });
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuário no banco
    const client = await pool.connect();
    try {
      const userResult = await client.query(`
        SELECT u.*, p.bio, p.specializations, p.experience_years, p.license_number,
               a.affiliate_code, a.commission_rate, a.total_earnings
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        LEFT JOIN affiliates a ON u.id = a.user_id
        WHERE u.id = $1 AND u.status = 'ativo'
      `, [decoded.id]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não encontrado ou inativo'
        });
      }

      const user = userResult.rows[0];
      
      // Verificar se a sessão ainda é válida
      const sessionResult = await client.query(`
        SELECT * FROM sessions 
        WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()
      `, [user.id, token]);

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Sessão expirada ou inválida'
        });
      }

      // Atualizar último uso da sessão
      await client.query(`
        UPDATE sessions 
        SET last_used_at = NOW() 
        WHERE user_id = $1 AND token_hash = $2
      `, [user.id, token]);

      // Adicionar usuário à requisição
      req.user = user;
      req.token = token;
      
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Erro na autenticação:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware de autorização por papel
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Acesso negado. Papel necessário: ${roles.join(' ou ')}`
      });
    }

    next();
  };
};

// Middleware para verificar se é o próprio usuário ou admin
const authorizeOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado'
    });
  }

  const targetUserId = req.params.userId || req.params.id;
  
  if (req.user.role === 'admin' || req.user.id == targetUserId) {
    return next();
  }

  res.status(403).json({
    success: false,
    message: 'Acesso negado. Você só pode acessar seus próprios dados'
  });
};

// Middleware opcional de autenticação (não falha se não autenticado)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') ||
                  req.cookies?.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const client = await pool.connect();
      try {
        const userResult = await client.query(`
          SELECT * FROM users WHERE id = $1 AND status = 'ativo'
        `, [decoded.id]);

        if (userResult.rows.length > 0) {
          req.user = userResult.rows[0];
        }
      } finally {
        client.release();
      }
    }
  } catch (error) {
    // Ignora erros em autenticação opcional
    logger.debug('Erro na autenticação opcional:', error);
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  authorizeOwnerOrAdmin,
  optionalAuth
};