const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Enviar un correo electrónico usando Resend
 * @param {Object} options Opciones del correo
 * @param {string} options.to Correo destino
 * @param {string} options.subject Asunto del correo
 * @param {string} options.html Contenido HTML del correo
 * @param {Array} [options.attachments] Arreglo de adjuntos { filename, content }
 * @returns {Promise<Object>} Resultado del envío
 */
const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    
    const data = await resend.emails.send({
      from: `iTea Travel <${fromEmail}>`,
      to,
      subject,
      html,
      attachments
    });

    if (data.error) {
      console.error('Error de Resend:', data.error);
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return { success: false, error };
  }
};

module.exports = {
  sendEmail
};
