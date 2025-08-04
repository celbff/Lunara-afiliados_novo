# migrations/001\_create\_tables.sql

```sql
-- migrations/001_create_tables.sql
-- Estrutura completa do banco - Lunara Afiliados + Agenda 2.0
-- Auditado e otimizado para performance e integridade

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'affiliate', 'therapist', 'client');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE commission_status AS ENUM ('pending', 'calculated', 'paid');
CREATE TYPE notification_type AS ENUM ('email', 'sms', 'push', 'system');

-- =============================================
-- TABELA: users (base para todos os usuários)
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'client',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    profile_image VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    language VARCHAR(10) DEFAULT 'pt-BR',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_metadata ON users USING gin(metadata);

-- =============================================
-- TABELA: affiliates (dados específicos dos afiliados)
-- =============================================
CREATE TABLE affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    affiliate_code VARCHAR(50) UNIQUE NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 20.00,
    total_referrals INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    payment_info JSONB DEFAULT '{}',
    bank_details JSONB DEFAULT '{}',
    pix_key VARCHAR(255),
    tax_document VARCHAR(20), -- CPF/CNPJ
    address JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    notes TEXT,
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para affiliates
CREATE UNIQUE INDEX idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX idx_affiliates_status ON affiliates(status);
CREATE INDEX idx_affiliates_commission_rate ON affiliates(commission_rate);

-- =============================================
-- TABELA: therapists (dados específicos dos terapeutas)
-- =============================================
CREATE TABLE therapists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(255) NOT NULL,
    license_number VARCHAR(100), -- CRP, CRM, etc.
    license_state VARCHAR(10),
    bio TEXT,
    experience_years INTEGER,
    hourly_rate DECIMAL(8,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 30.00,
    availability JSONB DEFAULT '{}', -- Horários disponíveis
    calendar_settings JSONB DEFAULT '{}',
    consultation_duration INTEGER DEFAULT 60, -- minutos
    max_daily_appointments INTEGER DEFAULT 8,
    advance_booking_days INTEGER DEFAULT 30,
    cancellation_policy TEXT,
    video_call_link VARCHAR(500),
    office_address JSONB DEFAULT '{}',
    certifications JSONB DEFAULT '[]',
    languages JSONB DEFAULT '["pt-BR"]',
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_reviews INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para therapists
CREATE INDEX idx_therapists_user_id ON therapists(user_id);
CREATE INDEX idx_therapists_specialty ON therapists(specialty);
CREATE INDEX idx_therapists_status ON therapists(status);
CREATE INDEX idx_therapists_hourly_rate ON therapists(hourly_rate);
CREATE INDEX idx_therapists_rating ON therapists(rating);

-- =============================================
-- TABELA: services (serviços oferecidos)
-- =============================================
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- minutos
    price DECIMAL(8,2) NOT NULL,
    category VARCHAR(100),
    is_online BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 1,
    preparation_time INTEGER DEFAULT 0, -- minutos antes
    cleanup_time INTEGER DEFAULT 0, -- minutos depois  
    booking_lead_time INTEGER DEFAULT 24, -- horas mínimas antecedência
    cancellation_lead_time INTEGER DEFAULT 24, -- horas para cancelar
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para services
CREATE INDEX idx_services_therapist_id ON services(therapist_id);
CREATE INDEX idx_services_active ON services(is_active);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_price ON services(price);

-- =============================================
-- TABELA: bookings (agendamentos - núcleo da Agenda 2.0)
-- =============================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id),
    therapist_id UUID NOT NULL REFERENCES therapists(id),
    client_id UUID REFERENCES users(id),
    affiliate_id UUID REFERENCES affiliates(id),
    
    -- Dados do cliente (podem não ter cadastro)
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    client_phone VARCHAR(20),
    
    -- Dados do agendamento
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    scheduled_end_time TIME,
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    
    -- Status e pagamento
    status booking_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    
    -- Valores
    service_price DECIMAL(8,2) NOT NULL,
    discount_amount DECIMAL(8,2) DEFAULT 0.00,
    total_amount DECIMAL(8,2) NOT NULL,
    affiliate_commission DECIMAL(8,2) DEFAULT 0.00,
    therapist_commission DECIMAL(8,2) DEFAULT 0.00,
    
    -- Detalhes
    notes TEXT,
    internal_notes TEXT,
    cancellation_reason TEXT,
    no_show_reason TEXT,
    
    -- Links e recursos
    meeting_link VARCHAR(500),
    meeting_id VARCHAR(100),
    recording_link VARCHAR(500),
    
    -- Datas importantes
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para bookings
CREATE INDEX idx_bookings_scheduled_date ON bookings(scheduled_date);
CREATE INDEX idx_bookings_therapist_date ON bookings(therapist_id, scheduled_date);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_affiliate_id ON bookings(affiliate_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
CREATE UNIQUE INDEX idx_bookings_therapist_datetime ON bookings(therapist_id, scheduled_date, scheduled_time) WHERE status != 'cancelled';

-- =============================================
-- TABELA: commissions (controle de comissões)
-- =============================================
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id),
    therapist_id UUID NOT NULL REFERENCES therapists(id),
    
    -- Valores
    booking_amount DECIMAL(8,2) NOT NULL,
    affiliate_rate DECIMAL(5,2) NOT NULL,
    affiliate_amount DECIMAL(8,2) NOT NULL,
    therapist_rate DECIMAL(5,2) NOT NULL,
    therapist_amount DECIMAL(8,2) NOT NULL,
    
    -- Status
    status commission_status DEFAULT 'pending',
    
    -- Datas
    calculated_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(255),
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para commissions
CREATE INDEX idx_commissions_booking_id ON commissions(booking_id);
CREATE INDEX idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX idx_commissions_therapist_id ON commissions(therapist_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_paid_at ON commissions(paid_at);

-- =============================================
-- TABELA: notifications (sistema de notificações)
-- =============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    
    -- Controle de envio
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Retry logic
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt TIMESTAMP WITH TIME ZONE,
    
    -- Referências
    booking_id UUID REFERENCES bookings(id),
    commission_id UUID REFERENCES commissions(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- =============================================
-- TABELA: audit_logs (logs de auditoria)
-- =============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    correlation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================
-- TABELA: settings (configurações do sistema)
-- =============================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para settings
CREATE UNIQUE INDEX idx_settings_key ON settings(key);

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON affiliates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_therapists_updated_at BEFORE UPDATE ON therapists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TRIGGERS PARA AUDITORIA
-- =============================================
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (action, table_name, record_id, new_data)
        VALUES ('INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
        VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (action, table_name, record_id, old_data)
        VALUES ('DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoria em tabelas críticas
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_commissions AFTER INSERT OR UPDATE OR DELETE ON commissions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =============================================
-- TRIGGER PARA ATUALIZAR COMISSÕES
-- =============================================
CREATE OR REPLACE FUNCTION calculate_commissions()
RETURNS TRIGGER AS $$
BEGIN
    -- Quando um booking é confirmado, calcular comissões
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        INSERT INTO commissions (
            booking_id,
            affiliate_id,
            therapist_id,
            booking_amount,
            affiliate_rate,
            affiliate_amount,
            therapist_rate,
            therapist_amount,
            calculated_at
        )
        SELECT 
            NEW.id,
            NEW.affiliate_id,
            NEW.therapist_id,
            NEW.total_amount,
            a.commission_rate,
            (NEW.total_amount * a.commission_rate / 100),
            t.commission_rate,
            (NEW.total_amount * t.commission_rate / 100),
            NOW()
        FROM affiliates a, therapists t
        WHERE a.id = NEW.affiliate_id 
        AND t.id = NEW.therapist_id
        AND NEW.affiliate_id IS NOT NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_commissions_trigger 
    AFTER UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION calculate_commissions();

-- =============================================
-- DADOS INICIAIS
-- =============================================
INSERT INTO settings (key, value, description, is_public) VALUES
('system_name', '"Lunara Afiliados"', 'Nome do sistema', true),
('system_version', '"1.0.0"', 'Versão do sistema', true),
('default_commission_rate', '20.00', 'Taxa de comissão padrão para afiliados', false),
('default_therapist_commission', '30.00', 'Taxa de comissão padrão para terapeutas', false),
('booking_advance_hours', '24', 'Horas mínimas de antecedência para agendamento', true),
('cancellation_hours', '24', 'Horas mínimas para cancelamento sem penalidade', true),
('reminder_hours', '[24, 2]', 'Horas para envio de lembretes', false),
('business_hours', '{"start": "08:00", "end": "18:00", "timezone": "America/Sao_Paulo"}', 'Horário de funcionamento', true),
('max_daily_bookings', '8', 'Máximo de agendamentos por dia por terapeuta', false),
('auto_confirm_bookings', 'false', 'Confirmar agendamentos automaticamente', false);

-- Criar usuário admin padrão (senha: admin123)
INSERT INTO users (email, password_hash, name, role, is_active, email_verified) VALUES
('admin@lunara-afiliados.com', '$2b$10$rQ8K7VQ3.5dJ4tX9wB8Z8.YqGv0jJx2J9qF8K7N6.8dX3B9jV5mQ6', 'Administrador', 'admin', true, true);

-- Criar exemplo de terapeuta
INSERT INTO users (email, password_hash, name, phone, role, is_active, email_verified) VALUES
('dra.silva@lunara.com', '$2b$10$rQ8K7VQ3.5dJ4tX9wB8Z8.YqGv0jJx2J9qF8K7N6.8dX3B9jV5mQ6', 'Dra. Ana Silva', '11999887766', 'therapist', true, true);

-- Dados do terapeuta
INSERT INTO therapists (user_id, specialty, license_number, bio, hourly_rate, commission_rate)
SELECT id, 'Psicologia', 'CRP 06/123456', 'Especialista em terapia cognitiva comportamental', 150.00, 30.00
FROM users WHERE email = 'dra.silva@lunara.com';

-- Criar exemplo de afiliado
INSERT INTO users (email, password_hash, name, phone, role, is_active, email_verified) VALUES
('joao@afiliado.com', '$2b$10$rQ8K7VQ3.5dJ4tX9wB8Z8.YqGv0jJx2J9qF8K7N6.8dX3B9jV5mQ6', 'João Afiliado', '11888776655', 'affiliate', true, true);

-- Dados do afiliado
INSERT INTO affiliates (user_id, affiliate_code, commission_rate, status, approved_at)
SELECT id, 'JOAO2024', 20.00, 'active', NOW()
FROM users WHERE email = 'joao@afiliado.com';

-- Criar serviços de exemplo
INSERT INTO services (therapist_id, name, description, duration, price, category)
SELECT t.id, 'Consulta Psicológica', 'Sessão individual de terapia', 60, 150.00, 'Psicologia'
FROM therapists t
JOIN users u ON t.user_id = u.id
WHERE u.email = 'dra.silva@lunara.com';

INSERT INTO services (therapist_id, name, description, duration, price, category, is_online)
SELECT t.id, 'Consulta Online', 'Sessão individual de terapia via videoconferência', 60, 130.00, 'Psicologia', true
FROM therapists t
JOIN users u ON t.user_id = u.id
WHERE u.email = 'dra.silva@lunara.com';

-- Comentários para documentação
COMMENT ON TABLE users IS 'Tabela base para todos os usuários do sistema';
COMMENT ON TABLE affiliates IS 'Dados específicos dos afiliados';
COMMENT ON TABLE therapists IS 'Dados específicos dos terapeutas';
COMMENT ON TABLE services IS 'Serviços oferecidos pelos terapeutas';
COMMENT ON TABLE bookings IS 'Agendamentos - núcleo da Agenda 2.0';
COMMENT ON TABLE commissions IS 'Controle de comissões para afiliados e terapeutas';
COMMENT ON TABLE notifications IS 'Sistema de notificações';
COMMENT ON TABLE audit_logs IS 'Logs de auditoria para todas as operações críticas';
COMMENT ON TABLE settings IS 'Configurações do sistema';

-- Verificar integridade
ANALYZE;

-- Exibir resumo das tabelas criadas
SELECT 
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```
