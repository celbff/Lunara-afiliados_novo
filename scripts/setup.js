# Scripts e Configurações Finais

## scripts/setup.js

```javascript
// scripts/setup.js
// Script de setup inicial do sistema

const { runMigrations, testConnection } = require('../config/database');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const setupSystem = async () => {
  try {
    logger.info('🚀 Iniciando setup do sistema Lunara Afiliados...');

    // 1. Verificar conexão com banco
    logger.info('📡 Testando conexão com banco de dados...');
    await testConnection();
    logger.info('✅ Conexão com banco estabelecida');

    // 2. Executar migrations
    logger.info('📊 Executando migrations...');
    await runMigrations();
    logger.info('✅ Migrations executadas com sucesso');

    // 3. Criar diretórios necessários
    const directories = [
      'uploads',
      'logs',
      'backups',
      'public/assets',
      'frontend-lunara/build'
    ];

    for (const dir of directories) {
      const dirPath = path.join(__dirname, '..', dir);
      try {
        await fs.access(dirPath);
        logger.info(`📁 Diretório já existe: ${dir}`);
      } catch {
        await fs.mkdir(dirPath, { recursive: true });
        logger.info(`📁 Diretório criado: ${dir}`);
      }
    }

    // 4. Verificar variáveis de ambiente essenciais
    const requiredEnvVars = [
      'JWT_SECRET',
      'DB_HOST',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.warn(`⚠️  Variáveis de ambiente ausentes: ${missingVars.join(', ')}`);
      logger.warn('📋 Configure o arquivo .env baseado no .env.example');
    } else {
      logger.info('✅ Todas as variáveis de ambiente essenciais configuradas');
    }

    // 5. Criar arquivo de configuração do frontend se não existir
    const frontendConfigPath = path.join(__dirname, '..', 'frontend-lunara', '.env');
    try {
      await fs.access(frontendConfigPath);
    } catch {
      const frontendConfig = `
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_APP_NAME=Lunara Afiliados
REACT_APP_VERSION=1.0.0
`;
      await fs.writeFile(frontendConfigPath, frontendConfig.trim());
      logger.info('📝 Arquivo .env do frontend criado');
    }

    logger.info('🎉 Setup concluído com sucesso!');
    logger.info('');
    logger.info('📋 Próximos passos:');
    logger.info('1. Configure as variáveis de ambiente no arquivo .env');
    logger.info('2. Execute: npm run build:frontend');
    logger.info('3. Execute: npm start');
    
  } catch (error) {
    logger.error('❌ Erro no setup:', error);
    process.exit(1);
  }
};

// Executar setup
if (require.main === module) {
  setupSystem();
}

module.exports = { setupSystem };
```

## scripts/seed.js

```javascript
// scripts/seed.js
// Script para popular banco com dados de exemplo

const bcrypt = require('bcrypt');
const { executeQuery, executeTransaction } = require('../config/database');
const { logger } = require('../utils/logger');

const seedData = async () => {
  try {
    logger.info('🌱 Iniciando seed de dados...');

    // Verificar se já existem dados
    const userCount = await executeQuery('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 1) {
      logger.info('ℹ️  Dados já existem, pulando seed');
      return;
    }

    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash('123456', saltRounds);

    const seedQueries = [
      // Usuários de exemplo
      {
        text: `INSERT INTO users (email, password_hash, name, phone, role, is_active, email_verified) VALUES 
               ('admin@lunara.com', $1, 'Administrador Sistema', '11999999999', 'admin', true, true),
               ('dra.ana@lunara.com', $1, 'Dra. Ana Carolina', '11988888888', 'therapist', true, true),
               ('dr.carlos@lunara.com', $1, 'Dr. Carlos Silva', '11977777777', 'therapist', true, true),
               ('joao.afiliado@gmail.com', $1, 'João Afiliado', '11966666666', 'affiliate', true, true),
               ('maria.afiliada@gmail.com', $1, 'Maria Afiliada', '11955555555', 'affiliate', true, true),
               ('cliente1@gmail.com', $1, 'Cliente Teste 1', '11944444444', 'client', true, true),
               ('cliente2@gmail.com', $1, 'Cliente Teste 2', '11933333333', 'client', true, true)`,
        params: [defaultPassword]
      }
    ];

    // Executar em transação
    await executeTransaction(seedQueries);

    // Buscar IDs dos usuários criados
    const users = await executeQuery(`
      SELECT id, email, role FROM users 
      WHERE email IN ('dra.ana@lunara.com', 'dr.carlos@lunara.com', 'joao.afiliado@gmail.com', 'maria.afiliada@gmail.com')
    `);

    const userMap = {};
    users.rows.forEach(user => {
      userMap[user.email] = user;
    });

    // Criar terapeutas
    await executeQuery(`
      INSERT INTO therapists (user_id, specialty, license_number, bio, hourly_rate, commission_rate, status, approved_at)
      VALUES 
        ($1, 'Psicologia Clínica', 'CRP 06/123456', 'Especialista em terapia cognitiva comportamental com 10 anos de experiência', 150.00, 30.00, 'active', NOW()),
        ($2, 'Psiquiatria', 'CRM 12345', 'Psiquiatra com foco em transtornos de ansiedade e depressão', 200.00, 35.00, 'active', NOW())
    `, [userMap['dra.ana@lunara.com'].id, userMap['dr.carlos@lunara.com'].id]);

    // Criar afiliados
    await executeQuery(`
      INSERT INTO affiliates (user_id, affiliate_code, commission_rate, status, approved_at)
      VALUES 
        ($1, 'JOAO2024', 20.00, 'active', NOW()),
        ($2, 'MARIA2024', 25.00, 'active', NOW())
    `, [userMap['joao.afiliado@gmail.com'].id, userMap['maria.afiliada@gmail.com'].id]);

    // Buscar IDs dos terapeutas
    const therapists = await executeQuery(`
      SELECT t.id, u.email FROM therapists t
      JOIN users u ON t.user_id = u.id
      WHERE u.email IN ('dra.ana@lunara.com', 'dr.carlos@lunara.com')
    `);

    const therapistMap = {};
    therapists.rows.forEach(therapist => {
      therapistMap[therapist.email] = therapist.id;
    });

    // Criar serviços
    await executeQuery(`
      INSERT INTO services (therapist_id, name, description, duration, price, category, is_active)
      VALUES 
        ($1, 'Consulta Psicológica Individual', 'Sessão individual de terapia cognitiva comportamental', 60, 150.00, 'Psicologia', true),
        ($1, 'Terapia Online', 'Sessão de terapia via videoconferência', 60, 130.00, 'Psicologia', true),
        ($1, 'Avaliação Psicológica', 'Avaliação psicológica completa', 90, 200.00, 'Psicologia', true),
        ($2, 'Consulta Psiquiátrica', 'Consulta para diagnóstico e prescrição', 45, 200.00, 'Psiquiatria', true),
        ($2, 'Retorno Psiquiátrico', 'Consulta de retorno e ajuste medicamentoso', 30, 150.00, 'Psiquiatria', true)
    `, [
      therapistMap['dra.ana@lunara.com'],
      therapistMap['dr.carlos@lunara.com']
    ]);

    // Inserir configurações do sistema
    await executeQuery(`
      INSERT INTO settings (key, value, description, is_public) VALUES
        ('welcome_message', '"Bem-vindo ao Lunara Afiliados"', 'Mensagem de boas-vindas', true),
        ('support_email', '"suporte@lunara.com"', 'Email de suporte', true),
        ('max_booking_advance_days', '30', 'Máximo de dias para agendamento antecipado', false),
        ('default_session_duration', '60', 'Duração padrão das sessões em minutos', false)
      ON CONFLICT (key) DO NOTHING
    `);

    logger.info('✅ Seed de dados concluído com sucesso!');
    logger.info('');
    logger.info('👥 Usuários criados:');
    logger.info('📧 admin@lunara.com (senha: 123456) - Administrador');
    logger.info('📧 dra.ana@lunara.com (senha: 123456) - Terapeuta');
    logger.info('📧 dr.carlos@lunara.com (senha: 123456) - Terapeuta');
    logger.info('📧 joao.afiliado@gmail.com (senha: 123456) - Afiliado (código: JOAO2024)');
    logger.info('📧 maria.afiliada@gmail.com (senha: 123456) - Afiliada (código: MARIA2024)');
    logger.info('📧 cliente1@gmail.com (senha: 123456) - Cliente');
    logger.info('📧 cliente2@gmail.com (senha: 123456) - Cliente');

  } catch (error) {
    logger.error('❌ Erro no seed:', error);
    throw error;
  }
};

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedData };
```

## frontend-lunara/package.json

```json
{
  "name": "lunara-afiliados-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@testing-library/jest-dom": "^5.16.4",
    "@testing-library/react": "^13.3.0",
    "@testing-library/user-event": "^13.5.0",
    "axios": "^1.4.0",
    "moment": "^2.29.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.11.0",
    "react-scripts": "5.0.1",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "proxy": "http://localhost:5000"
}
```

## frontend-lunara/src/index.css

```css
/* frontend-lunara/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

/* Estilos customizados para o sistema */
.btn {
  @apply px-4 py-2 rounded-md font-medium transition-colors duration-200;
}

.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

.btn-secondary {
  @apply bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2;
}

.btn-success {
  @apply bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2;
}

.btn-danger {
  @apply bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2;
}

.card {
  @apply bg-white rounded-lg shadow-sm border border-gray-200 p-6;
}

.form-input {
  @apply block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500;
}

.form-label {
  @apply block text-sm font-medium text-gray-700 mb-1;
}

/* Animações customizadas */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

/* Scrollbar customizada */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Responsividade customizada */
@media (max-width: 640px) {
  .container-mobile {
    @apply px-4 py-2;
  }
}
```

## Comandos de instalação e setup

### install.sh

```bash
#!/bin/bash

# install.sh
# Script de instalação completa do sistema Lunara Afiliados

echo "🚀 Instalando Lunara Afiliados - Sistema Integrado"
echo "=================================================="

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 16+ primeiro."
    exit 1
fi

# Verificar se PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL não encontrado. Instale PostgreSQL primeiro."
    exit 1
fi

echo "✅ Dependências básicas verificadas"

# Instalar dependências do backend
echo "📦 Instalando dependências do backend..."
npm install

# Criar diretório do frontend se não existir
if [ ! -d "frontend-lunara" ]; then
    echo "📁 Criando estrutura do frontend..."
    npx create-react-app frontend-lunara
fi

# Instalar dependências do frontend
echo "📦 Instalando dependências do frontend..."
cd frontend-lunara
npm install axios react-router-dom moment

# Instalar Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Configurar Tailwind
cat > tailwind.config.js << EOF
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
EOF

cd ..

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "⚠️  Configure as variáveis de ambiente no arquivo .env"
fi

# Executar setup inicial
echo "⚙️  Executando setup inicial..."
node scripts/setup.js

echo ""
echo "🎉 Instalação concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o banco PostgreSQL"
echo "2. Configure as variáveis no arquivo .env"
echo "3. Execute: npm run setup (para configurar banco)"
echo "4. Execute: npm run seed (para dados de exemplo)"
echo "5. Execute: npm run dev (para desenvolvimento)"
echo "6. Execute: npm run build && npm start (para produção)"
echo ""
echo "🌐 URLs após iniciar:"
echo "   Backend API: http://localhost:5000"
echo "   Frontend: http://localhost:3000 (dev) ou http://localhost:5000 (prod)"
echo "   Health Check: http://localhost:5000/health"
echo ""
echo "👥 Usuários de exemplo (senha: 123456):"
echo "   admin@lunara.com (Administrador)"
echo "   dra.ana@lunara.com (Terapeuta)"
echo "   joao.afiliado@gmail.com (Afiliado - código: JOAO2024)"
```

### Comandos npm adicionais para package.json

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "setup": "node scripts/setup.js",
    "seed": "node scripts/seed.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .js",
    "lint:fix": "eslint . --ext .js --fix",
    "build": "npm run build:frontend",
    "build:frontend": "cd frontend-lunara && npm run build",
    "install:all": "npm install && cd frontend-lunara && npm install",
    "dev:frontend": "cd frontend-lunara && npm start",
    "dev:full": "concurrently \"npm run dev\" \"npm run dev:frontend\"",
    "db:reset": "node scripts/reset.js && npm run setup && npm run seed",
    "logs": "tail -f logs/app.log",
    "backup": "node scripts/backup.js"
  }
}
```
