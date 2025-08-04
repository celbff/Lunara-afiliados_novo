// scripts/backup.js
// Script para backup do banco de dados

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

// Função para criar diretório de backup
const createBackupDir = () => {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
};

// Função para backup completo usando pg_dump
async function createFullBackup() {
  try {
    console.log('💾 Iniciando backup completo do banco de dados...');
    
    const backupDir = createBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `lunara_backup_${timestamp}.sql`);
    
    // Comando pg_dump
    const pgDumpCommand = `pg_dump -h ${process.env.DB_HOST} -p ${process.env.DB_PORT} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} --no-password --clean --if-exists --create`;
    
    console.log('🔄 Executando pg_dump...');
    
    // Configurar variável de ambiente para senha
    const env = {
      ...process.env,
      PGPASSWORD: process.env.DB_PASSWORD
    };
    
    const { stdout, stderr } = await execAsync(pgDumpCommand, { env });
    
    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('⚠️ Avisos durante backup:', stderr);
    }
    
    // Salvar arquivo
    fs.writeFileSync(backupFile, stdout);
    
    const stats = fs.statSync(backupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Backup criado com sucesso:`);
    console.log(`   📁 Arquivo: ${backupFile}`);
    console.log(`   📏 Tamanho: ${fileSizeInMB} MB`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Erro durante backup completo:', error);
    throw error;
  }
}

// Função para backup dos dados (somente dados, sem estrutura)
async function createDataBackup() {
  let client;
  
  try {
    console.log('📊 Criando backup dos dados...');
    
    client = await pool.connect();
    const backupDir = createBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataFile = path.join(backupDir, `lunara_data_${timestamp}.json`);
    
    // Buscar dados de todas as tabelas principais
    const tables = [
      'users',
      'profiles', 
      'affiliates',
      'appointments',
      'consultation_types',
      'commissions',
      'system_settings'
    ];
    
    const backup = {
      created_at: new Date().toISOString(),
      database: process.env.DB_NAME,
      version: '1.0.0',
      tables: {}
    };
    
    for (const table of tables) {
      console.log(`   📋 Extraindo dados de ${table}...`);
      
      try {
        const result = await client.query(`SELECT * FROM ${table} ORDER BY id`);
        backup.tables[table] = result.rows;
        console.log(`      ✅ ${result.rows.length} registros`);
      } catch (error) {
        console.log(`      ⚠️ Tabela ${table} não encontrada ou erro: ${error.message}`);
        backup.tables[table] = [];
      }
    }
    
    // Salvar arquivo JSON
    fs.writeFileSync(dataFile, JSON.stringify(backup, null, 2), 'utf8');
    
    const stats = fs.statSync(dataFile);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    
    console.log(`✅ Backup de dados criado:`);
    console.log(`   📁 Arquivo: ${dataFile}`);
    console.log(`   📏 Tamanho: ${fileSizeInKB} KB`);
    
    return dataFile;
    
  } catch (error) {
    console.error('❌ Erro durante backup de dados:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Função para limpar backups antigos
async function cleanOldBackups(keepDays = 30) {
  try {
    console.log(`🧹 Limpando backups com mais de ${keepDays} dias...`);
    
    const backupDir = createBackupDir();
    const files = fs.readdirSync(backupDir);
    const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
    
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        removedCount++;
        console.log(`   🗑️ Removido: ${file}`);
      }
    }
    
    console.log(`✅ ${removedCount} backup(s) antigo(s) removido(s)`);
    
  } catch (error) {
    console.error('❌ Erro ao limpar backups antigos:', error);
  }
}

// Função principal de backup
async function performBackup(type = 'full') {
  try {
    console.log('🚀 Iniciando processo de backup...');
    console.log(`📋 Tipo: ${type}`);
    
    let backupFile;
    
    if (type === 'full') {
      backupFile = await createFullBackup();
    } else if (type === 'data') {
      backupFile = await createDataBackup();
    } else {
      throw new Error('Tipo de backup inválido. Use "full" ou "data"');
    }
    
    // Limpar backups antigos
    await cleanOldBackups(30);
    
    console.log('\n🎉 Processo de backup concluído!');
    console.log(`📁 Arquivo: ${backupFile}`);
    
    return backupFile;
    
  } catch (error) {
    console.error('❌ Falha no backup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  const type = process.argv[2] || 'full'; // full ou data
  
  performBackup(type)
    .then((file) => {
      console.log(`✅ Backup ${type} finalizado: ${file}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha no backup:', error);
      process.exit(1);
    });
}

module.exports = {
  performBackup,
  createFullBackup,
  createDataBackup,
  cleanOldBackups
};