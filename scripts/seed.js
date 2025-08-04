// scripts/seed.js
// Script para inserir dados de exemplo no banco de dados

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

// Função para hash de senhas
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

// Dados de exemplo
const seedData = {
  users: [
    {
      name: 'Administrador Sistema',
      email: 'admin@lunara.com',
      password: '123456',
      role: 'admin',
      phone: '+55 11 99999-0001'
    },
    {
      name: 'Dra. Ana Silva',
      email: 'dra.ana@lunara.com',
      password: '123456',
      role: 'terapeuta',
      phone: '+55 11 99999-0002'
    },
    {
      name: 'João Afiliado',
      email: 'joao.afiliado@gmail.com',
      password: '123456',
      role: 'afiliado',
      phone: '+55 11 99999-0003'
    },
    {
      name: 'Maria Cliente',
      email: 'cliente1@gmail.com',
      password: '123456',
      role: 'cliente',
      phone: '+55 11 99999-0004'
    },
    {
      name: 'Pedro Silva',
      email: 'cliente2@gmail.com',
      password: '123456',
      role: 'cliente',
      phone: '+55 11 99999-0005'
    },
    {
      name: 'Ana Santos',
      email: 'cliente3@gmail.com',
      password: '123456',
      role: 'cliente',
      phone: '+55 11 99999-0006'
    }
  ],

  profiles: [
    {
      user_email: 'dra.ana@lunara.com',
      bio: 'Psicóloga clínica com 10 anos de experiência em terapia cognitivo-comportamental.',
      specializations: ['Ansiedade', 'Depressão', 'Relacionamentos', 'Autoestima'],
      experience_years: 10,
      license_number: 'CRP-01/12345'
    },
    {
      user_email: 'joao.afiliado@gmail.com',
      bio: 'Especialista em marketing digital e captação de clientes para área da saúde.',
      specializations: ['Marketing Digital', 'Vendas', 'Relacionamento'],
      experience_years: 5
    }
  ],

  affiliates: [
    {
      user_email: 'joao.afiliado@gmail.com',
      affiliate_code: 'JOAO2024',
      commission_rate: 15.00,
      bank_info: {
        bank: 'Banco do Brasil',
        agency: '1234-5',
        account: '67890-1',
        account_type: 'Corrente',
        holder_name: 'João Afiliado',
        holder_document: '123.456.789-00'
      }
    }
  ],

  consultation_types: [
    {
      name: 'Consulta Inicial',
      description: 'Primeira consulta para avaliação e anamnese completa',
      duration: 90,
      price: 180.00,
      color: '#3B82F6'
    },
    {
      name: 'Terapia Individual',
      description: 'Sessão de terapia individual',
      duration: 60,
      price: 150.00,
      color: '#10B981'
    },
    {
      name: 'Terapia de Casal',
      description: 'Sessão de terapia para casais',
      duration: 90,
      price: 220.00,
      color: '#F59E0B'
    },
    {
      name: 'Consulta de Retorno',
      description: 'Consulta de acompanhamento',
      duration: 45,
      price: 120.00,
      color: '#8B5CF6'
    },
    {
      name: 'Terapia Online',
      description: 'Sessão de terapia via videoconferência',
      duration: 60,
      price: 130.00,
      color: '#EF4444'
    }
  ]
};

async function seedDatabase() {
  let client;
  
  try {
    console.log('🌱 Iniciando inserção de dados de exemplo...');
    
    client = await pool.connect();
    await client.query('BEGIN');
    
    // 1. Inserir usuários
    console.log('👥 Inserindo usuários...');
    for (const user of seedData.users) {
      const hashedPassword = await hashPassword(user.password);
      
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, phone)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
      `, [user.name, user.email, hashedPassword, user.role, user.phone]);
    }
    
    // 2. Inserir perfis
    console.log('📋 Inserindo perfis...');
    for (const profile of seedData.profiles) {
      const userResult = await client.query('SELECT id FROM users WHERE email = $1', [profile.user_email]);
      
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        await client.query(`
          INSERT INTO profiles (user_id, bio, specializations, experience_years, license_number)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id) DO NOTHING
        `, [userId, profile.bio, profile.specializations, profile.experience_years, profile.license_number]);
      }
    }
    
    // 3. Inserir afiliados
    console.log('🤝 Inserindo afiliados...');
    for (const affiliate of seedData.affiliates) {
      const userResult = await client.query('SELECT id FROM users WHERE email = $1', [affiliate.user_email]);
      
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        await client.query(`
          INSERT INTO affiliates (user_id, affiliate_code, commission_rate, bank_info)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (affiliate_code) DO NOTHING
        `, [userId, affiliate.affiliate_code, affiliate.commission_rate, JSON.stringify(affiliate.bank_info)]);
      }
    }
    
    // 4. Inserir tipos de consulta
    console.log('🏥 Inserindo tipos de consulta...');
    for (const type of seedData.consultation_types) {
      await client.query(`
        INSERT INTO consultation_types (name, description, duration, price, color)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO NOTHING
      `, [type.name, type.description, type.duration, type.price, type.color]);
    }
    
    // 5. Inserir alguns agendamentos de exemplo
    console.log('📅 Inserindo agendamentos de exemplo...');
    
    // Buscar IDs necessários
    const therapistResult = await client.query('SELECT id FROM users WHERE email = $1', ['dra.ana@lunara.com']);
    const patientResult = await client.query('SELECT id FROM users WHERE email = $1', ['cliente1@gmail.com']);
    const affiliateResult = await client.query('SELECT id FROM affiliates WHERE affiliate_code = $1', ['JOAO2024']);
    const consultationResult = await client.query('SELECT id, price FROM consultation_types WHERE name = $1', ['Terapia Individual']);
    
    if (therapistResult.rows.length > 0 && patientResult.rows.length > 0 && consultationResult.rows.length > 0) {
      const therapistId = therapistResult.rows[0].id;
      const patientId = patientResult.rows[0].id;
      const affiliateId = affiliateResult.rows.length > 0 ? affiliateResult.rows[0].id : null;
      const consultationPrice = consultationResult.rows[0].price;
      
      // Agendamentos para os próximos dias
      const appointments = [
        {
          date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Amanhã
          type: 'Terapia Individual',
          status: 'agendado',
          notes: 'Primeira sessão agendada via sistema de afiliados'
        },
        {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Próxima semana
          type: 'Consulta de Retorno',
          status: 'agendado',
          notes: 'Retorno para acompanhamento'
        },
        {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Semana passada
          type: 'Terapia Individual',
          status: 'concluido',
          notes: 'Sessão concluída com sucesso'
        }
      ];
      
      for (const apt of appointments) {
        await client.query(`
          INSERT INTO appointments (patient_id, therapist_id, affiliate_id, appointment_date, type, status, notes, price)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [patientId, therapistId, affiliateId, apt.date, apt.type, apt.status, apt.notes, consultationPrice]);
      }
    }
    
    await client.query('COMMIT');
    
    // 6. Exibir resumo
    console.log('\n📊 RESUMO DOS DADOS INSERIDOS:');
    
    const summaryQueries = [
      { name: 'Usuários', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'Terapeutas', query: "SELECT COUNT(*) as count FROM users WHERE role = 'terapeuta'" },
      { name: 'Afiliados', query: 'SELECT COUNT(*) as count FROM affiliates' },
      { name: 'Clientes', query: "SELECT COUNT(*) as count FROM users WHERE role = 'cliente'" },
      { name: 'Tipos de Consulta', query: 'SELECT COUNT(*) as count FROM consultation_types' },
      { name: 'Agendamentos', query: 'SELECT COUNT(*) as count FROM appointments' }
    ];
    
    for (const summary of summaryQueries) {
      const result = await client.query(summary.query);
      const count = result.rows[0].count;
      console.log(`   ${summary.name}: ${count}`);
    }
    
    console.log('\n👥 USUÁRIOS DE TESTE (senha: 123456):');
    console.log('   📧 admin@lunara.com (Administrador)');
    console.log('   📧 dra.ana@lunara.com (Terapeuta)');
    console.log('   📧 joao.afiliado@gmail.com (Afiliado - código: JOAO2024)');
    console.log('   📧 cliente1@gmail.com (Cliente)');
    console.log('   📧 cliente2@gmail.com (Cliente)');
    console.log('   📧 cliente3@gmail.com (Cliente)');
    
    console.log('\n🎉 Dados de exemplo inseridos com sucesso!');
    console.log('\n📋 Próximo passo:');
    console.log('   Execute: npm run dev');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro durante seed:', error);
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
  seedDatabase()
    .then(() => {
      console.log('✅ Seed finalizado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha no seed:', error);
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
  seedData
};
