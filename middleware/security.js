// middleware/security.js
// Middleware de segurança adicional

const crypto = require('crypto');
const logger = require('../utils/logger');

// Middleware para sanitização de entrada
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/javascript:/gi, '') // Remove javascript:
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

// Middleware para logging de segurança
const securityLogger = (req, res, next) => {
  // Log requisições suspeitas
  const suspiciousPatterns = [
    /(<script|javascript:|on\w+=)/i,
    /(union|select|insert|delete|drop|create|alter)/i,
    /(\.\.|\/etc\/|\/bin\/)/i,
    /(eval\(|exec\(|system\()/i
  ];

  const checkString = JSON.stringify(req.body) + JSON.stringify(req.query) + req.originalUrl;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      logger.warn('Tentativa de ataque detectada', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        query: req.query,
        pattern: pattern.toString()
      });
      
      return res.status(400).json({
        success: false,
        message: 'Requisição inválida'
      });
    }
  }

  next();
};

// Middleware para detectar força bruta
const bruteForcePrevention = () => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutos
    const maxAttempts = 10;

    if (!attempts.has(key)) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    const userAttempts = attempts.get(key);
    
    // Reset se passou da janela de tempo
    if (now - userAttempts.firstAttempt > windowMs) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    // Incrementar tentativas
    userAttempts.count++;

    if (userAttempts.count > maxAttempts) {
      logger.warn(`Possível ataque de força bruta de ${key}`, {
        ip: req.ip,
        attempts: userAttempts.count,
        url: req.originalUrl
      });

      return res.status(429).json({
        success: false,
        message: 'Muitas tentativas. Tente novamente em 15 minutos.',
        retryAfter: Math.ceil((windowMs - (now - userAttempts.firstAttempt)) / 1000)
      });
    }

    attempts.set(key, userAttempts);
    next();
  };
};

// Middleware para validar CSRF token
const validateCSRF = (req, res, next) => {
  // Pular validação para métodos seguros
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    logger.warn('Tentativa de CSRF detectada', {
      ip: req.ip,
      url: req.originalUrl,
      providedToken: token,
      sessionToken: sessionToken
    });

    return res.status(403).json({
      success: false,
      message: 'Token CSRF inválido'
    });
  }

  next();
};

// Middleware para gerar token CSRF
const generateCSRF = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

// Middleware para headers de segurança
const securityHeaders = (req, res, next) => {
  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Forçar HTTPS em produção
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; '));
  
  next();
};

// Middleware para rate limiting baseado em IP
const ipRateLimit = () => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = 60; // 60 requisições por minuto

    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const ipData = requests.get(ip);
    
    if (now > ipData.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (ipData.count >= maxRequests) {
      logger.warn(`Rate limit excedido para IP ${ip}`, {
        ip,
        count: ipData.count,
        url: req.originalUrl
      });

      return res.status(429).json({
        success: false,
        message: 'Muitas requisições',
        retryAfter: Math.ceil((ipData.resetTime - now) / 1000)
      });
    }

    ipData.count++;
    requests.set(ip, ipData);
    next();
  };
};

// Limpar dados antigos dos maps
setInterval(() => {
  // Esta limpeza seria implementada conforme necessário
}, 5 * 60 * 1000);

module.exports = {
  sanitizeInput,
  securityLogger,
  bruteForcePrevention,
  validateCSRF,
  generateCSRF,
  securityHeaders,
  ipRateLimit
};