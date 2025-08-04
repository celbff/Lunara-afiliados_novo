// server.js
// Servidor principal - Lunara Afiliados + Agenda 2.0
// Auditado e otimizado por desenvolvedor sênior

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Carregar variáveis de ambiente
require('dotenv').config();

// Importar configurações e middlewares
const { pool, testConnection } = require('./config/database');
const { logger } = require('./utils/logger');
const { 
  errorHandler, 
  notFoundHandler, 
  correlationIdMiddleware,
  asyncHandler 
} = require('./middleware/errorHandler');

// Importar rotas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const affiliateRoutes = require('./routes/affiliates');
const therapistRoutes = require('./routes/therapists');
const serviceRoutes = require('./routes/services');
const bookingRoutes = require('./routes/bookings');
const dashboardRoutes = require('./routes/dashboard');
const commissionRoutes = require('./routes/commissions');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARES DE SEGURANÇA =====
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Muitas tentativas. Tente novamente em alguns minutos.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configurado
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    
    // Permitir requests sem origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
};

app.use(cors(corsOptions));

// ===== MIDDLEWARES GERAIS =====
app.use(compression());
app.use(correlationIdMiddleware);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Parsers
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ===== HEALTH CHECK =====
app.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {}
  };

  try {
    // Testar conexão com banco
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    health.services.database = {
      status: 'OK',
      responseTime: `${Date.now() - dbStart}ms`
    };
  } catch (error) {
    health.services.database = {
      status: 'ERROR',
      error: error.message
    };
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
}));

// ===== ROTAS DA API =====
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/therapists', therapistRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// Rota para servir o frontend em produção
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, 'frontend-lunara', 'build');
  
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }
}

// ===== MIDDLEWARES DE ERRO =====
app.use(notFoundHandler);
app.use(errorHandler);

// ===== INICIALIZAÇÃO DO SERVIDOR =====
const startServer = async () => {
  try {
    // Testar conexão com banco
    await testConnection();
    logger.info('✅ Conexão com banco de dados estabelecida');

    // Criar diretórios necessários
    const directories = ['uploads', 'logs', 'backups'];
    directories.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`📁 Diretório criado: ${dir}`);
      }
    });

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor Lunara Afiliados rodando na porta ${PORT}`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`🔧 API Base: http://localhost:${PORT}/api`);
        logger.info(`📋 Frontend: ${process.env.FRONTEND_URL}`);
      }
    });

    // Configurar shutdown graceful
    const gracefulShutdown = (signal) => {
      logger.info(`📴 Recebido sinal ${signal}. Iniciando shutdown graceful...`);
      
      server.close(() => {
        logger.info('🔌 Servidor HTTP fechado');
        
        pool.end(() => {
          logger.info('🔌 Pool de conexões do banco fechado');
          process.exit(0);
        });
      });

      // Forçar saída após 30 segundos
      setTimeout(() => {
        logger.error('❌ Força saída após timeout de shutdown');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;

  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Inicializar apenas se não estiver em teste
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };