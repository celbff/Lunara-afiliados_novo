// middleware/errorHandler.js
// Middleware para tratamento centralizado de erros

const logger = require('../utils/logger');

// Middleware de tratamento de erros
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log do erro
  logger.error(`Erro: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Erro de validação do Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = {
      message: message.join(', '),
      statusCode: 400
    };
  }

  // Erro de cast do Mongoose (ID inválido)
  if (err.name === 'CastError') {
    const message = 'Recurso não encontrado';
    error = {
      message,
      statusCode: 404
    };
  }

  // Erro de duplicação (código 11000)
  if (err.code === 11000) {
    const message = 'Dados duplicados encontrados';
    error = {
      message,
      statusCode: 400
    };
  }

  // Erro de autenticação JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = {
      message,
      statusCode: 401
    };
  }

  // Erro de token expirado
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = {
      message,
      statusCode: 401
    };
  }

  // Erro do PostgreSQL
  if (err.code) {
    switch (err.code) {
      case '23505': // Violação de unicidade
        error = {
          message: 'Dados duplicados encontrados',
          statusCode: 400
        };
        break;
      case '23503': // Violação de chave estrangeira
        error = {
          message: 'Referência inválida',
          statusCode: 400
        };
        break;
      case '23502': // Violação de NOT NULL
        error = {
          message: 'Dados obrigatórios não fornecidos',
          statusCode: 400
        };
        break;
      case '42P01': // Tabela não existe
        error = {
          message: 'Recurso não encontrado',
          statusCode: 404
        };
        break;
    }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
};

// Middleware para capturar rotas não encontradas
const notFound = (req, res, next) => {
  const error = new Error(`Rota não encontrada - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Middleware para tratar erros assíncronos
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler
};