# utils/logger.js

```javascript
// utils/logger.js
// Sistema de logging avançado - Lunara Afiliados
// Winston com rotação de arquivos e diferentes níveis

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuração de cores para o console
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Formato customizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Formato para console (mais legível)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Adicionar metadados se existirem
    if (Object.keys(meta).length > 0) {
      log += '\n' + JSON.stringify(meta, null, 2);
    }
    
    return log;
  })
);

// Configuração de transports
const transports = [];

// Console transport (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info'
    })
  );
}

// File transport com rotação diária para logs gerais
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    format: logFormat,
    level: 'info'
  })
);

// File transport separado para erros
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '30d',
    format: logFormat,
    level: 'error'
  })
);

// File transport para debug (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'debug-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d',
      format: logFormat,
      level: 'debug'
    })
  );
}

// File transport para auditoria
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'audit-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '50m',
    maxFiles: '90d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    level: 'info'
  })
);

// Criar logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  
  // Configurações adicionais
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test' && process.env.SUPPRESS_TEST_LOGS === 'true'
});

// Logger específico para auditoria
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '50m',
      maxFiles: '90d'
    })
  ]
});

// Logger específico para performance
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d'
    })
  ]
});

// Funções auxiliares para logging estruturado
const logHelpers = {
  // Log de auditoria para ações críticas
  audit: (action, details) => {
    auditLogger.info('AUDIT', {
      action,
      timestamp: new Date().toISOString(),
      ...details
    });
  },

  // Log de performance
  performance: (operation, duration, details = {}) => {
    performanceLogger.info('PERFORMANCE', {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...details
    });
  },

  // Log de autenticação
  auth: (event, user, details = {}) => {
    logger.info('AUTH', {
      event,
      user: user?.email || user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
      ...details
    });
  },

  // Log de API
  api: (method, url, status, duration, user = null) => {
    logger.info('API', {
      method,
      url,
      status,
      duration,
      user: user?.email || 'anonymous',
      timestamp: new Date().toISOString()
    });
  },

  // Log de database
  db: (operation, table, duration, rowsAffected = 0) => {
    logger.debug('DATABASE', {
      operation,
      table,
      duration,
      rowsAffected,
      timestamp: new Date().toISOString()
    });
  },

  // Log de erro estruturado
  error: (error, context = {}) => {
    logger.error('ERROR', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      timestamp: new Date().toISOString(),
      ...context
    });
  },

  // Log de segurança
  security: (event, details) => {
    logger.warn('SECURITY', {
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
};

// Middleware para logging de requisições
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Override do res.end para capturar o fim da requisição
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    logHelpers.api(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      req.user
    );
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Middleware para capturar erros não tratados
const errorLogger = (error, req, res, next) => {
  logHelpers.error(error, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user?.email || 'anonymous',
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    correlationId: req.correlationId
  });
  
  next(error);
};

// Função para limpar logs antigos manualmente
const cleanOldLogs = async (daysToKeep = 30) => {
  const fs = require('fs').promises;
  
  try {
    const files = await fs.readdir(logsDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }
    
    logger.info(`🧹 Limpeza de logs concluída: ${deletedCount} arquivos removidos`);
    
  } catch (error) {
    logger.error('Erro na limpeza de logs:', error);
  }
};

// Função para compactar logs antigos
const compressOldLogs = async () => {
  const zlib = require('zlib');
  const fs = require('fs').promises;
  
  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.endsWith('.log') && !f.includes(new Date().toISOString().split('T')[0]));
    
    for (const file of logFiles) {
      const filePath = path.join(logsDir, file);
      const compressedPath = `${filePath}.gz`;
      
      // Verificar se já está compactado
      if (await fs.access(compressedPath).then(() => true).catch(() => false)) {
        continue;
      }
      
      const fileContent = await fs.readFile(filePath);
      const compressed = zlib.gzipSync(fileContent);
      
      await fs.writeFile(compressedPath, compressed);
      await fs.unlink(filePath);
      
      logger.debug(`📦 Log compactado: ${file}`);
    }
    
  } catch (error) {
    logger.error('Erro na compactação de logs:', error);
  }
};

// Configurar limpeza automática de logs
if (process.env.NODE_ENV === 'production') {
  // Limpar logs a cada 24 horas
  setInterval(() => {
    cleanOldLogs(30);
    compressOldLogs();
  }, 24 * 60 * 60 * 1000);
}

// Event listeners para monitoramento
logger.on('error', (error) => {
  console.error('Erro no sistema de logging:', error);
});

// Handle do processo para capturar logs de shutdown
process.on('exit', () => {
  logger.info('🛑 Processo sendo finalizado');
});

process.on('beforeExit', () => {
  logger.info('📋 Finalizando logs antes da saída');
});

module.exports = {
  logger,
  auditLogger,
  performanceLogger,
  logHelpers,
  requestLogger,
  errorLogger,
  cleanOldLogs,
  compressOldLogs
};
```
