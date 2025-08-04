// utils/logger.js
// Sistema de logging personalizado

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Formato personalizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Adicionar stack trace se houver erro
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    // Adicionar metadados se houver
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Formato para console (mais limpo)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // Adicionar metadados importantes no console
    if (meta.userId) logMessage += ` (User: ${meta.userId})`;
    if (meta.ip) logMessage += ` (IP: ${meta.ip})`;
    if (meta.duration) logMessage += ` (${meta.duration})`;
    
    return logMessage;
  })
);

// Configuração dos transportes
const transports = [
  // Console - sempre ativo
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
];

// Arquivos de log - apenas em produção ou se explicitamente habilitado
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Log geral
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: 'info',
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  );
  
  // Log de erros
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  );
  
  // Log de debug (apenas se DEBUG estiver habilitado)
  if (process.env.DEBUG === 'true') {
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'debug.log'),
        level: 'debug',
        format: customFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 3,
        tailable: true
      })
    );
  }
}

// Criar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
  exitOnError: false,
  
  // Capturar exceções não tratadas
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  
  // Capturar promises rejeitadas
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Funções de logging personalizadas
const logWithContext = (level, message, context = {}) => {
  const logContext = {
    ...context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    pid: process.pid
  };
  
  logger.log(level, message, logContext);
};

// Wrapper functions para facilitar uso
const info = (message, context) => logWithContext('info', message, context);
const error = (message, context) => logWithContext('error', message, context);
const warn = (message, context) => logWithContext('warn', message, context);
const debug = (message, context) => logWithContext('debug', message, context);

// Log específico para requisições HTTP
const logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous'
  };
  
  const level = res.statusCode >= 400 ? 'warn' : 'info';
  logWithContext(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, logData);
};

// Log específico para operações de banco
const logDatabase = (operation, table, duration, rowCount = 0) => {
  debug(`DB ${operation} on ${table}`, {
    operation,
    table,
    duration,
    rowCount
  });
};

// Log específico para autenticação
const logAuth = (action, email, success, reason = '') => {
  const logData = {
    action,
    email,
    success,
    reason
  };
  
  const level = success ? 'info' : 'warn';
  const message = `Auth ${action}: ${email} - ${success ? 'SUCCESS' : 'FAILED'}`;
  
  logWithContext(level, message, logData);
};

// Log específico para transações financeiras
const logTransaction = (type, amount, userId, details = {}) => {
  info(`Transaction ${type}: R$ ${amount}`, {
    type,
    amount,
    userId,
    ...details
  });
};

// Função para criar logs estruturados
const createStructuredLog = (category, action, data = {}) => {
  return {
    category,
    action,
    timestamp: new Date().toISOString(),
    data
  };
};

// Função para log de performance
const performanceLog = (operation, startTime, metadata = {}) => {
  const duration = Date.now() - startTime;
  debug(`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
};

// Stream para Morgan (middleware de log HTTP)
const stream = {
  write: (message) => {
    info(message.trim());
  }
};

// Função para rotacionar logs manualmente
const rotateLogs = () => {
  logger.info('Iniciando rotação manual de logs');
  
  // Winston já faz rotação automática, mas podemos implementar lógica adicional aqui
  const now = new Date();
  info(`Rotação de logs executada em ${now.toISOString()}`);
};

// Função para limpar logs antigos
const cleanOldLogs = (daysToKeep = 30) => {
  try {
    const files = fs.readdirSync(logsDir);
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        info(`Log antigo removido: ${file}`);
      }
    });
  } catch (error) {
    error('Erro ao limpar logs antigos:', { error: error.message });
  }
};

// Agendar limpeza automática de logs (se em produção)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    cleanOldLogs(30); // Manter logs por 30 dias
  }, 24 * 60 * 60 * 1000); // Executar diariamente
}

// Log de inicialização
info('Sistema de logging inicializado', {
  level: logger.level,
  environment: process.env.NODE_ENV,
  fileLogging: process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true'
});

module.exports = {
  logger,
  info,
  error,
  warn,
  debug,
  logRequest,
  logDatabase,
  logAuth,
  logTransaction,
  createStructuredLog,
  performanceLog,
  stream,
  rotateLogs,
  cleanOldLogs
};