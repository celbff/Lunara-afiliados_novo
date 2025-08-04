// middleware/rateLimiter.js
// Middleware para limitação de taxa de requisições

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Configuração padrão do rate limiter
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requisições por windowMs
    message: {
      success: false,
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      retryAfter: Math.ceil(options.windowMs / 1000) || 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit excedido para IP ${req.ip}`, {
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json(options.message || defaultOptions.message);
    },
    skip: (req) => {
      // Pular rate limiting para IPs whitelistados
      const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
      return whitelist.includes(req.ip);
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

// Rate limiter para login (mais restritivo)
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de login por IP
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    retryAfter: 900
  }
});

// Rate limiter para registro de usuários
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por IP por hora
  message: {
    success: false,
    message: 'Muitas tentativas de registro. Tente novamente em 1 hora.',
    retryAfter: 3600
  }
});

// Rate limiter para API geral
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Limite de requisições excedido. Tente novamente em alguns minutos.',
    retryAfter: 900
  }
});

// Rate limiter para recuperação de senha
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 tentativas por hora
  message: {
    success: false,
    message: 'Muitas tentativas de recuperação de senha. Tente novamente em 1 hora.',
    retryAfter: 3600
  }
});

// Rate limiter para criação de agendamentos
const appointmentLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 10, // máximo 10 agendamentos por 10 minutos
  message: {
    success: false,
    message: 'Muitos agendamentos criados. Aguarde alguns minutos.',
    retryAfter: 600
  }
});

// Rate limiter flexível baseado no usuário
const createUserBasedLimiter = (options = {}) => {
  const store = new Map();
  
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 100;
    
    if (!store.has(key)) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userData = store.get(key);
    
    if (now > userData.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (userData.count >= max) {
      logger.warn(`Rate limit excedido para usuário/IP ${key}`, {
        key,
        count: userData.count,
        url: req.originalUrl
      });
      
      return res.status(429).json({
        success: false,
        message: 'Limite de requisições excedido',
        retryAfter: Math.ceil((userData.resetTime - now) / 1000)
      });
    }
    
    userData.count++;
    store.set(key, userData);
    next();
  };
};

// Limpar dados antigos do store periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (now > data.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000); // Limpar a cada 5 minutos

module.exports = {
  createRateLimiter,
  loginLimiter,
  registerLimiter,
  apiLimiter,
  passwordResetLimiter,
  appointmentLimiter,
  createUserBasedLimiter
};