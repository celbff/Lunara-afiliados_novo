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
