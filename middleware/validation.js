// middleware/validation.js
// Middleware para validação de dados de entrada

const logger = require('../utils/logger');

// Função auxiliar para validar email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Função auxiliar para validar telefone brasileiro
const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9]?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/;
  return phoneRegex.test(phone);
};

// Função auxiliar para validar senha
const isValidPassword = (password) => {
  return password && password.length >= 6;
};

// Validação para registro de usuário
const validateUserRegistration = (req, res, next) => {
  const { name, email, password, role, phone } = req.body;
  const errors = [];

  // Validar nome
  if (!name || name.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres');
  }

  // Validar email
  if (!email || !isValidEmail(email)) {
    errors.push('Email inválido');
  }

  // Validar senha
  if (!password || !isValidPassword(password)) {
    errors.push('Senha deve ter pelo menos 6 caracteres');
  }

  // Validar papel
  const validRoles = ['admin', 'terapeuta', 'afiliado', 'cliente'];
  if (role && !validRoles.includes(role)) {
    errors.push('Papel inválido');
  }

  // Validar telefone (opcional)
  if (phone && !isValidPhone(phone)) {
    errors.push('Telefone inválido');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors
    });
  }

  next();
};

// Validação para login
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !isValidEmail(email)) {
    errors.push('Email inválido');
  }

  if (!password) {
    errors.push('Senha é obrigatória');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors
    });
  }

  next();
};

// Validação para criação de agendamento
const validateAppointment = (req, res, next) => {
  const { therapist_id, appointment_date, type, duration } = req.body;
  const errors = [];

  // Validar terapeuta
  if (!therapist_id || isNaN(parseInt(therapist_id))) {
    errors.push('ID do terapeuta inválido');
  }

  // Validar data
  if (!appointment_date) {
    errors.push('Data do agendamento é obrigatória');
  } else {
    const appointmentDate = new Date(appointment_date);
    const now = new Date();
    
    if (isNaN(appointmentDate.getTime())) {
      errors.push('Data do agendamento inválida');
    } else if (appointmentDate <= now) {
      errors.push('Data do agendamento deve ser no futuro');
    }
  }

  // Validar tipo
  if (!type || type.trim().length < 2) {
    errors.push('Tipo de consulta é obrigatório');
  }

  // Validar duração (opcional)
  if (duration && (isNaN(parseInt(duration)) || parseInt(duration) < 15 || parseInt(duration) > 180)) {
    errors.push('Duração deve estar entre 15 e 180 minutos');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors
    });
  }

  next();
};

// Validação para perfil de usuário
const validateProfile = (req, res, next) => {
  const { bio, specializations, experience_years, license_number } = req.body;
  const errors = [];

  // Validar bio (opcional)
  if (bio && bio.length > 1000) {
    errors.push('Biografia não pode exceder 1000 caracteres');
  }

  // Validar especializações (opcional)
  if (specializations && !Array.isArray(specializations)) {
    errors.push('Especializações devem ser uma lista');
  }

  // Validar anos de experiência (opcional)
  if (experience_years && (isNaN(parseInt(experience_years)) || parseInt(experience_years) < 0 || parseInt(experience_years) > 50)) {
    errors.push('Anos de experiência deve estar entre 0 e 50');
  }

  // Validar número de licença (opcional)
  if (license_number && license_number.length > 100) {
    errors.push('Número de licença não pode exceder 100 caracteres');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors
    });
  }

  next();
};

// Validação para afiliado
const validateAffiliate = (req, res, next) => {
  const { affiliate_code, commission_rate, bank_info } = req.body;
  const errors = [];

  // Validar código do afiliado
  if (!affiliate_code || affiliate_code.length < 3 || affiliate_code.length > 50) {
    errors.push('Código do afiliado deve ter entre 3 e 50 caracteres');
  }

  // Validar taxa de comissão (opcional)
  if (commission_rate && (isNaN(parseFloat(commission_rate)) || parseFloat(commission_rate) < 0 || parseFloat(commission_rate) > 50)) {
    errors.push('Taxa de comissão deve estar entre 0 e 50%');
  }

  // Validar informações bancárias (opcional)
  if (bank_info && typeof bank_info !== 'object') {
    errors.push('Informações bancárias devem ser um objeto');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors
    });
  }

  next();
};

// Validação para tipo de consulta
const validateConsultationType = (req, res, next) => {
  const { name, description, duration, price, color } = req.body;
  const errors = [];

  // Validar nome
  if (!name || name.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres');
  }

  // Validar descrição (opcional)
  if (description && description.length > 500) {
    errors.push('Descrição não pode exceder 500 caracteres');
  }

  // Validar duração
  if (!duration || isNaN(parseInt(duration)) || parseInt(duration) < 15 || parseInt(duration) > 300) {
    errors.push('Duração deve estar entre 15 e 300 minutos');
  }

  // Validar preço
  if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    errors.push('Preço deve ser um número positivo');
  }

  // Validar cor (opcional)
  if (color && !/^#([0-9A-F]{3}){1,2}$/i.test(color)) {
    errors.push('Cor deve ser um código hexadecimal válido');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors
    });
  }

  next();
};

// Middleware genérico para validação personalizada
const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      
      for (const rule of rules) {
        if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
          errors.push(`${field} é obrigatório`);
          break;
        }
        
        if (value && rule.type && typeof value !== rule.type) {
          errors.push(`${field} deve ser do tipo ${rule.type}`);
          break;
        }
        
        if (value && rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} deve ter pelo menos ${rule.minLength} caracteres`);
          break;
        }
        
        if (value && rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} não pode exceder ${rule.maxLength} caracteres`);
          break;
        }
        
        if (value && rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} tem formato inválido`);
          break;
        }
        
        if (value && rule.custom && !rule.custom(value)) {
          errors.push(rule.message || `${field} é inválido`);
          break;
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors
      });
    }
    
    next();
  };
};

module.exports = {
  validateUserRegistration,
  validateLogin,
  validateAppointment,
  validateProfile,
  validateAffiliate,
  validateConsultationType,
  validate,
  isValidEmail,
  isValidPhone,
  isValidPassword
};