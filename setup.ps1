# setup.ps1
# Script de instalação para Windows - Lunara Afiliados

Write-Host "🚀 Instalando Lunara Afiliados - Sistema Integrado" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Verificar se Node.js está instalado
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js não encontrado. Instale Node.js 16+ primeiro." -ForegroundColor Red
    Write-Host "Download: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Node.js encontrado: $nodeVersion" -ForegroundColor Green

# Verificar se PostgreSQL está instalado
$psqlVersion = psql --version 2>$null
if (-not $psqlVersion) {
    Write-Host "⚠️  PostgreSQL não encontrado. Você pode:" -ForegroundColor Yellow
    Write-Host "   1. Instalar PostgreSQL localmente" -ForegroundColor White
    Write-Host "   2. Usar PostgreSQL em nuvem (Supabase, Railway, etc.)" -ForegroundColor White
}

# Instalar dependências do backend
Write-Host "📦 Instalando dependências do backend..." -ForegroundColor Blue
npm install

# Criar estrutura do frontend se não existir
if (-not (Test-Path "frontend-lunara")) {
    Write-Host "📁 Criando estrutura do frontend..." -ForegroundColor Blue
    npx create-react-app frontend-lunara
}

# Instalar dependências do frontend
Write-Host "📦 Instalando dependências do frontend..." -ForegroundColor Blue
Set-Location frontend-lunara
npm install axios react-router-dom moment

# Instalar Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Configurar Tailwind
$tailwindConfig = @"
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
"@

$tailwindConfig | Out-File -FilePath "tailwind.config.js" -Encoding UTF8

Set-Location ..

# Criar arquivo .env se não existir
if (-not (Test-Path ".env")) {
    Write-Host "📝 Criando arquivo .env..." -ForegroundColor Blue
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  Configure as variáveis de ambiente no arquivo .env" -ForegroundColor Yellow
}

# Executar setup inicial
Write-Host "⚙️  Executando setup inicial..." -ForegroundColor Blue
node scripts/setup.js

Write-Host ""
Write-Host "🎉 Instalação concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Configure o banco PostgreSQL" -ForegroundColor White
Write-Host "2. Configure as variáveis no arquivo .env" -ForegroundColor White
Write-Host "3. Execute: npm run setup (para configurar banco)" -ForegroundColor White
Write-Host "4. Execute: npm run seed (para dados de exemplo)" -ForegroundColor White
Write-Host "5. Execute: npm run dev (para desenvolvimento)" -ForegroundColor White
Write-Host "6. Execute: npm run build && npm start (para produção)" -ForegroundColor White
Write-Host ""
Write-Host "🌐 URLs após iniciar:" -ForegroundColor Cyan
Write-Host "   Backend API: http://localhost:5000" -ForegroundColor White
Write-Host "   Frontend: http://localhost:3000 (dev)" -ForegroundColor White
Write-Host "   Health Check: http://localhost:5000/health" -ForegroundColor White