// config/email.js
// Configuração de email para o sistema

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configuração do transportador de email
let transporter = null;

const createTransporter = () => {
  try {
    // Configuração baseada no provedor
    if (process.env.EMAIL_PROVIDER === 'gmail') {
      transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else if (process.env.EMAIL_PROVIDER === 'outlook') {
      transporter = nodemailer.createTransporter({
        service: 'hotmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else if (process.env.EMAIL_PROVIDER === 'smtp') {
      transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else {
      // Configuração padrão para desenvolvimento (Ethereal)
      transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        }
      });
    }

    logger.info('Transportador de email configurado');
    return transporter;
  } catch (error) {
    logger.error('Erro ao configurar transportador de email:', error);
    return null;
  }
};

// Função para enviar email
const sendEmail = async (options) => {
  try {
    if (!transporter) {
      transporter = createTransporter();
    }

    if (!transporter) {
      throw new Error('Transportador de email não configurado');
    }

    const {
      to,
      subject,
      text = '',
      html = '',
      template = null,
      data = {}
    } = options;

    let emailHtml = html;
    let emailText = text;

    // Se um template foi especificado, usar template HTML
    if (template) {
      const templateResult = getEmailTemplate(template, data);
      emailHtml = templateResult.html;
      emailText = templateResult.text;
    }

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'Lunara Afiliados'} <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: emailText,
      html: emailHtml
    };

    const result = await transporter.sendMail(mailOptions);
    
    logger.info(`Email enviado para ${to}`, {
      messageId: result.messageId,
      subject
    });

    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    logger.error('Erro ao enviar email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Função para obter templates de email
const getEmailTemplate = (templateName, data) => {
  const templates = {
    'welcome': {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Bem-vindo ao Lunara Afiliados!</h2>
          <p>Olá ${data.name},</p>
          <p>Sua conta foi criada com sucesso. Você pode fazer login usando o email: <strong>${data.email}</strong></p>
          <div style="margin: 20px 0;">
            <a href="${data.loginUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Fazer Login</a>
          </div>
          <p>Atenciosamente,<br>Equipe Lunara Afiliados</p>
        </div>
      `,
      text: `Bem-vindo ao Lunara Afiliados! Olá ${data.name}, sua conta foi criada com sucesso. Email: ${data.email}. Acesse: ${data.loginUrl}`
    },

    'password-reset': {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Redefinir Senha</h2>
          <p>Olá ${data.name},</p>
          <p>Você solicitou a redefinição de sua senha. Clique no botão abaixo para criar uma nova senha:</p>
          <div style="margin: 20px 0;">
            <a href="${data.resetUrl}" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
          </div>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou esta redefinição, ignore este email.</p>
          <p>Atenciosamente,<br>Equipe Lunara Afiliados</p>
        </div>
      `,
      text: `Redefinir Senha - Olá ${data.name}, clique no link para redefinir sua senha: ${data.resetUrl}`
    },

    'appointment-confirmation': {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Agendamento Confirmado</h2>
          <p>Olá ${data.patientName},</p>
          <p>Seu agendamento foi confirmado:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Terapeuta:</strong> ${data.therapistName}</p>
            <p><strong>Data:</strong> ${data.appointmentDate}</p>
            <p><strong>Horário:</strong> ${data.appointmentTime}</p>
            <p><strong>Tipo:</strong> ${data.appointmentType}</p>
            <p><strong>Valor:</strong> R$ ${data.price}</p>
          </div>
          <p>Em caso de dúvidas, entre em contato conosco.</p>
          <p>Atenciosamente,<br>Equipe Lunara Afiliados</p>
        </div>
      `,
      text: `Agendamento Confirmado - ${data.patientName}, seu agendamento com ${data.therapistName} em ${data.appointmentDate} às ${data.appointmentTime} foi confirmado.`
    },

    'commission-payment': {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Comissão Paga</h2>
          <p>Olá ${data.affiliateName},</p>
          <p>Sua comissão foi processada e paga:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Valor:</strong> R$ ${data.commissionAmount}</p>
            <p><strong>Agendamento:</strong> ${data.appointmentDate}</p>
            <p><strong>Cliente:</strong> ${data.patientName}</p>
          </div>
          <p>O valor foi creditado em sua conta.</p>
          <p>Atenciosamente,<br>Equipe Lunara Afiliados</p>
        </div>
      `,
      text: `Comissão Paga - ${data.affiliateName}, sua comissão de R$ ${data.commissionAmount} foi paga.`
    },

    'appointment-reminder': {
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Lembrete de Agendamento</h2>
          <p>Olá ${data.patientName},</p>
          <p>Este é um lembrete sobre seu agendamento:</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Terapeuta:</strong> ${data.therapistName}</p>
            <p><strong>Data:</strong> ${data.appointmentDate}</p>
            <p><strong>Horário:</strong> ${data.appointmentTime}</p>
            <p><strong>Local:</strong> ${data.location || 'Online'}</p>
          </div>
          <p>Não esqueça de comparecer!</p>
          <p>Atenciosamente,<br>Equipe Lunara Afiliados</p>
        </div>
      `,
      text: `Lembrete - ${data.patientName}, você tem um agendamento com ${data.therapistName} em ${data.appointmentDate} às ${data.appointmentTime}.`
    }
  };

  return templates[templateName] || {
    html: '<p>Template não encontrado</p>',
    text: 'Template não encontrado'
  };
};

// Função para testar configuração de email
const testEmailConfiguration = async () => {
  try {
    if (!transporter) {
      transporter = createTransporter();
    }

    if (!transporter) {
      return { success: false, error: 'Transportador não configurado' };
    }

    await transporter.verify();
    
    logger.info('Configuração de email testada com sucesso');
    return { success: true };
    
  } catch (error) {
    logger.error('Erro no teste de configuração de email:', error);
    return { success: false, error: error.message };
  }
};

// Inicializar transportador
if (process.env.EMAIL_ENABLED === 'true') {
  createTransporter();
}

module.exports = {
  sendEmail,
  testEmailConfiguration,
  getEmailTemplate
};