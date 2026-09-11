const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_123');

/**
 * El remitente cuando no hay empresa en contexto, o cuando la que hay no ha
 * configurado el suyo.
 *
 * `onboarding@resend.dev` es el remitente de pruebas de Resend: funciona sin
 * verificar ningún dominio, que es justo donde está este proyecto. Cuando una
 * agencia quiera enviar desde su dominio habrá que verificarlo en Resend con su
 * SPF y su DKIM — eso es configuración por cliente, no código.
 */
const DIRECCION_POR_DEFECTO = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const NOMBRE_POR_DEFECTO = process.env.EMAIL_FROM_NAME || 'Nexus';

/**
 * De parte de quién sale un correo.
 *
 * Sale de la agencia en cuyo contexto se está trabajando, que es lo que espera
 * quien lo recibe: el cliente de una agencia no tiene por qué saber que hay un
 * software detrás, ni recibir un voucher firmado por otra marca. Antes había un
 * único remitente con el nombre escrito en el código.
 *
 * Se resuelve aquí y no en cada llamada para que los cuatro sitios que mandan
 * correo —bienvenida, voucher, código de recuperación y aviso de check-in— no
 * tengan que acordarse, y para que el que venga después tampoco.
 */
async function marcaDeCorreo() {
  try {
    // El require va dentro para no atar este módulo al cliente de base de datos
    // en el arranque: `sendEmail` se usa desde sitios muy distintos.
    const { empresaActual } = require('../config/tenant');
    const empresaId = empresaActual();
    if (!empresaId) return { direccion: DIRECCION_POR_DEFECTO, nombre: NOMBRE_POR_DEFECTO };

    const prisma = require('../config/db');
    const empresa = await prisma.empresas.findFirst({
      where: { id: empresaId },
      select: { email_remitente: true, email_nombre: true, nombre: true },
    });
    return {
      direccion: empresa?.email_remitente || DIRECCION_POR_DEFECTO,
      nombre: empresa?.email_nombre || empresa?.nombre || NOMBRE_POR_DEFECTO,
    };
  } catch {
    // Un fallo resolviendo la marca no puede impedir que salga el correo.
    return { direccion: DIRECCION_POR_DEFECTO, nombre: NOMBRE_POR_DEFECTO };
  }
}

/**
 * Enviar un correo electrónico usando Resend.
 *
 * @param {Object} options
 * @param {string} options.to Correo destino
 * @param {string} options.subject Asunto
 * @param {string} options.html Contenido HTML
 * @param {Array} [options.attachments] Adjuntos { filename, content }
 * @param {Object} [options.remitente] Para forzar uno; por defecto, el de la empresa activa
 * @returns {Promise<{success: boolean, data?: Object, error?: Object}>}
 */
const sendEmail = async ({ to, subject, html, attachments = [], remitente }) => {
  try {
    const marca = remitente || await marcaDeCorreo();

    const data = await resend.emails.send({
      from: `${marca.nombre} <${marca.direccion}>`,
      to,
      subject,
      html,
      attachments,
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
  sendEmail,
  marcaDeCorreo,
};
