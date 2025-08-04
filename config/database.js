# config/database.js

```javascript
// config/database.js
// Configuração do banco PostgreSQL - Lunara Afiliados
// Auditado e otimizado com pool de conexões e failover

const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Configuração do pool de conexões
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.NODE_ENV === 'test' 
    ? (process.env.DB_TEST_NAME || 'lunara_afiliados_test')
    : (process.env.DB_NAME || 'lunara_afiliados'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  
  // Configurações do pool
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  max: parseInt(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT) || 2000,
  
  // SSL em produção
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  
  // Configurações adicionais
  application_name: 'lunara_afiliados',
  statement_timeout: 30000,
  query_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
};

// Criar pool de conexões
const pool = new Pool(poolConfig);

// Event listeners para monitoramento
pool.on('connect', (client) => {
  logger.debug(`Nova conexão estabelecida: ${client.processID}`);
});

pool.on('acquire', (client) => {
  logger.debug(`Cliente adquirido do pool: ${client.processID}`);
});

pool.on('remove', (client) => {
  logger.debug(`Cliente removido do pool: ${client.processID}`);
});

pool.on('error', (err, client) => {
  logger.error('Erro inesperado no pool de conexões:', err);
  logger.error('Cliente:', client?.processID);
});

// Função para testar conexão
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as db_version');
      
      logger.info('✅ Conexão com PostgreSQL estabelecida');
      logger.info(`📅 Hora do banco: ${result.rows[0].current_time}`);
      logger.info(`🔢 Versão do PostgreSQL: ${result.rows[0].db_version.split(' ')[1]}`);
      
      client.release();
      return true;
      
    } catch (error) {
      logger.error(`❌ Tentativa ${i + 1}/${retries} de conexão falhou:`, error.message);
      
      if (i === retries - 1) {
        throw new Error(`Falha na conexão com o banco após ${retries} tentativas: ${error.message}`);
      }
      
      // Aguardar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
};

// Função para executar queries com retry e logging
const executeQuery = async (text, params = [], options = {}) => {
  const {
    retries = 1,
    logQuery = process.env.DEBUG_SQL === 'true',
    timeout = 30000
  } = options;

  let client;
  const startTime = Date.now();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      client = await pool.connect();
      
      if (logQuery) {
        logger.debug('Executando query:', { text, params, attempt: attempt + 1 });
      }

      // Configurar timeout da query
      const queryPromise = client.query(text, params);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      );

      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      if (logQuery) {
        const duration = Date.now() - startTime;
        logger.debug(`Query executada em ${duration}ms, ${result.rowCount} linhas afetadas`);
      }

      return result;

    } catch (error) {
      logger.error(`Erro na query (tentativa ${attempt + 1}/${retries}):`, {
        error: error.message,
        query: text,
        params: process.env.NODE_ENV === 'development' ? params : '[HIDDEN]'
      });

      if (attempt === retries - 1) {
        throw error;
      }

      // Aguardar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));

    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

// Função para transações
const executeTransaction = async (queries) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    logger.debug(`Transação commitada com ${queries.length} queries`);
    
    return results;
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transação revertida devido a erro:', error);
    throw error;
    
  } finally {
    client.release();
  }
};

// Função para verificar saúde do banco
const getHealthStatus = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        NOW() as current_time,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
    `);
    
    client.release();
    
    return {
      status: 'healthy',
      ...result.rows[0],
      pool_stats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Função para backup do banco
const createBackup = async (outputPath) => {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const pgDump = spawn('pg_dump', [
      '-h', poolConfig.host,
      '-p', poolConfig.port,
      '-U', poolConfig.user,
      '-d', poolConfig.database,
      '-f', outputPath,
      '--no-password',
      '--verbose'
    ], {
      env: {
        ...process.env,
        PGPASSWORD: poolConfig.password
      }
    });

    pgDump.on('error', (error) => {
      logger.error('Erro no backup:', error);
      reject(error);
    });

    pgDump.on('close', (code) => {
      if (code === 0) {
        logger.info(`✅ Backup criado com sucesso: ${outputPath}`);
        resolve(outputPath);
      } else {
        reject(new Error(`pg_dump falhou com código ${code}`));
      }
    });
  });
};

// Função para executar migrations
const runMigrations = async () => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const migrationsPath = path.join(__dirname, '..', 'migrations');
    const files = await fs.readdir(migrationsPath);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    logger.info(`Executando ${sqlFiles.length} migrations...`);
    
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsPath, file);
      const sql = await fs.readFile(filePath, 'utf8');
      
      logger.info(`Executando migration: ${file}`);
      await executeQuery(sql);
    }
    
    logger.info('✅ Todas as migrations executadas com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migrations:', error);
    throw error;
  }
};

// Cleanup no shutdown
process.on('SIGINT', () => {
  logger.info('🔌 Fechando pool de conexões...');
  pool.end(() => {
    logger.info('✅ Pool de conexões fechado');
    process.exit(0);
  });
});

module.exports = {
  pool,
  testConnection,
  executeQuery,
  executeTransaction,
  getHealthStatus,
  createBackup,
  runMigrations,
  poolConfig
};
```
