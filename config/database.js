// config/database.js
// Configuração do banco de dados PostgreSQL

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Configuração da conexão
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
});

// Event listeners para logging
pool.on('connect', (client) => {
  logger.debug('Nova conexão estabelecida no pool');
});

pool.on('error', (err, client) => {
  logger.error('Erro no pool de conexões:', err);
});

pool.on('acquire', (client) => {
  logger.debug('Cliente adquirido do pool');
});

pool.on('remove', (client) => {
  logger.debug('Cliente removido do pool');
});

// Função para executar transações
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Função para testar conexão
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    client.release();
    
    logger.info('Conexão com banco de dados testada com sucesso', {
      timestamp: result.rows[0].now,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
    });
    
    return { success: true, data: result.rows[0] };
  } catch (error) {
    logger.error('Erro ao testar conexão com banco:', error);
    return { success: false, error: error.message };
  }
};

// Função para obter estatísticas do pool
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
};

// Função para executar query com logging
const query = async (text, params = []) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Query executada', {
      duration: `${duration}ms`,
      rows: result.rowCount,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error('Erro na query', {
      duration: `${duration}ms`,
      error: error.message,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params
    });
    
    throw error;
  }
};

// Função para fechar todas as conexões
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Pool de conexões fechado');
  } catch (error) {
    logger.error('Erro ao fechar pool:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Recebido SIGINT, fechando pool de conexões...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Recebido SIGTERM, fechando pool de conexões...');
  await closePool();
  process.exit(0);
});

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  getPoolStats,
  closePool
};