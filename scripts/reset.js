// scripts/reset.js
// Script para limpar/resetar o banco de dados

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

// SQL para remover todas as tabelas
const dropTables = `
-- Remover todas as tabelas (ordem importante por causa das foreign keys)
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS consultation_types CASCADE;
DROP TABLE IF EXISTS affiliates CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- Remover função de trigger
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
`;

async function resetDatabase() {
  let client;
  
  try {
    console.log('🧹 Iniciando reset do banco de dados...');
    console.log('⚠️  ATENÇÃO: Todos os dados serão removidos!');
    
    // Aguardar confirmação em ambiente de desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('⏳ Aguardando 3 segundos para cancelar se necessário...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    // Executar remoção das tabelas
    console.log('🗑️ Removendo tabelas existentes...');
    await client.query(dropTables);
    console.log('✅ Tabelas removidas com sucesso');
    
    // Verificar se todas foram removidas
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    const remainingTables = result.rows.map(r => r.table_name);
    
    if (remainingTables.length === 0) {
      console.log('✅ Banco de dados completamente limpo');
    } else {
      console.log('⚠️ Tabelas restantes:', remainingTables);
    }
    
    console.log('\n🎉 Reset do banco de dados concluído!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Execute: npm run setup (recriar tabelas)');
    console.log('   2. Execute: npm run seed (inserir dados de exemplo)');
    
  } catch (error) {
    console.error('❌ Erro durante reset:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('✅ Reset finalizado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha no reset:', error);
      process.exit(1);
    });
}

module.exports = {
  resetDatabase,
  dropTables
};