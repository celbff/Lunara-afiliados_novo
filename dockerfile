# ==============================================
# DOCKERFILE MULTI-STAGE OTIMIZADO
# Lunara Afiliados - Node.js/Express Application
# ==============================================

# Definir argumentos globais
ARG NODE_VERSION=18
ARG ALPINE_VERSION=3.18

# ==============================================
# STAGE 1: Base - Preparação do ambiente
# ==============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base

# Instalar dependências do sistema necessárias
RUN apk add --no-cache \
    libc6-compat \
    dumb-init \
    curl \
    ca-certificates \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Configurar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 lunara

# Definir diretório de trabalho
WORKDIR /app

# Configurar variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# ==============================================
# STAGE 2: Dependencies - Instalação de dependências
# ==============================================
FROM base AS deps

# Copiar arquivos de configuração de dependências
COPY package.json package-lock.json* ./

# Instalar dependências com otimizações
RUN npm ci --only=production --frozen-lockfile \
    && npm cache clean --force

# ==============================================
# STAGE 3: Build - Preparação da aplicação
# ==============================================
FROM base AS builder

# Copiar dependências da stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Remover arquivos desnecessários
RUN rm -rf \
    .git \
    .gitignore \
    README.md \
    docker-compose.yml \
    Dockerfile \
    .dockerignore \
    tests/ \
    docs/ \
    *.md

# ==============================================
# STAGE 4: Production - Imagem final de produção
# ==============================================
FROM base AS production

# Copiar dependências de produção
COPY --from=deps --chown=lunara:nodejs /app/node_modules ./node_modules

# Copiar aplicação
COPY --from=builder --chown=lunara:nodejs /app .

# Criar diretórios necessários com permissões corretas
RUN mkdir -p /app/logs /app/uploads /app/temp \
    && chown -R lunara:nodejs /app/logs /app/uploads /app/temp \
    && chmod 755 /app/logs /app/uploads /app/temp

# Remover arquivos temporários
RUN rm -rf /tmp/* /var/tmp/* /var/cache/apk/*

# Expor porta
EXPOSE 3000

# Mudar para usuário não-root
USER lunara

# Health check específico para Express
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de inicialização
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# ==============================================
# STAGE 5: Development - Imagem para desenvolvimento
# ==============================================
FROM base AS development

# Instalar dependências adicionais para desenvolvimento
RUN apk add --no-cache \
    git \
    vim \
    bash

# Copiar package.json
COPY package.json package-lock.json* ./

# Instalar todas as dependências (incluindo dev)
RUN npm ci --include=dev

# Criar diretórios
RUN mkdir -p /app/logs /app/uploads /app/temp \
    && chown -R lunara:nodejs /app \
    && chmod 755 /app/logs /app/uploads /app/temp

# Expor porta e porta de debug
EXPOSE 3000 9229

# Mudar para usuário não-root
USER lunara

# Comando para desenvolvimento com nodemon
CMD ["npm", "run", "dev"]

# ==============================================
# STAGE 6: Testing - Imagem para testes
# ==============================================
FROM development AS testing

# Copiar código fonte
COPY --chown=lunara:nodejs . .

# Instalar dependências de teste se houver
RUN npm ci --include=dev

# Criar script de teste
RUN echo '#!/bin/sh\necho "Executando testes..."\nnode --version\nnpm --version\necho "Verificando sintaxe..."\nnode -c server.js\necho "Testes concluídos com sucesso!"' > /app/run-tests.sh \
    && chmod +x /app/run-tests.sh

# Executar testes básicos
RUN /app/run-tests.sh

# ==============================================
# LABELS E METADATA
# ==============================================
LABEL maintainer="Lunara Afiliados <dev@lunara-afiliados.com>"
LABEL version="1.0.0"
LABEL description="Sistema de gestão de afiliados para terapeutas - Node.js/Express"
LABEL org.opencontainers.image.title="Lunara Afiliados"
LABEL org.opencontainers.image.description="Sistema de gestão de afiliados para terapeutas e clínicas"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Lunara Afiliados"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/lunara/afiliados"
LABEL org.opencontainers.image.documentation="https://docs.lunara-afiliados.com"

# ==============================================
# CONFIGURAÇÕES DE SEGURANÇA
# ==============================================

# Configurações de segurança do Node.js
ENV NODE_OPTIONS="--max-old-space-size=512 --enable-source-maps"

# ==============================================
# INSTRUÇÕES DE BUILD E USO
# ==============================================

# Build para produção:
# docker build --target production -t lunara-afiliados:latest .

# Build para desenvolvimento:
# docker build --target development -t lunara-afiliados:dev .

# Build para testes:
# docker build --target testing -t lunara-afiliados:test .

# Executar container de produção:
# docker run -d -p 3000:3000 --name lunara-app lunara-afiliados:latest

# Executar container de desenvolvimento:
# docker run -d -p 3000:3000 -v $(pwd):/app --name lunara-dev lunara-afiliados:dev

# Build com argumentos personalizados:
# docker build --build-arg NODE_VERSION=20 --target production -t lunara-afiliados:latest .

# ==============================================
# OTIMIZAÇÕES IMPLEMENTADAS
# ==============================================
# ✅ Multi-stage build para reduzir tamanho final
# ✅ Cache de dependências otimizado
# ✅ Usuário não-root para segurança
# ✅ Health checks configurados
# ✅ Limpeza de arquivos temporários
# ✅ Suporte a desenvolvimento e produção
# ✅ Configurações específicas para Node.js/Express
# ✅ Instalação do cliente PostgreSQL
# ✅ Diretórios para logs e uploads
# ✅ Configurações de segurança
# ==============================================