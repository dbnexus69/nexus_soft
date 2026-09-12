const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generateToken, getExpiryTime } = require('../utils/tokenUtils');
const { UnauthorizedError, NotFoundError, BadRequestError } = require('../errors/AppError');
const emailService = require('../utils/emailService');
const { olvidarToken, olvidarUsuario } = require('../middleware/authCache');
const { conEmpresa } = require('../config/tenant');
const crypto = require('crypto');

/**
 * Un hash con el que comparar cuando el correo no existe.
 *
 * Sin esto, un correo desconocido se resolvía sin llamar a bcrypt y respondía
 * en una fracción del tiempo que uno existente: la diferencia se mide desde
 * fuera, así que el login iba diciendo qué correos hay dados de alta aunque
 * el mensaje sea el mismo. Es el hash de una cadena aleatoria; nadie lo acierta.
 */
const HASH_SENUELO = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

/** Un mensaje, dos casos. Ver `login`. */
const CREDENCIALES_MAL = 'Correo o contraseña incorrectos';

const CODIGO_VIGENCIA_MIN = 15;
const CODIGO_MAX_INTENTOS = 5;

/**
 * El token de sesión se guarda hasheado.
 *
 * La columna se llama `token_hash` desde el principio, pero se guardaba el JWT
 * entero: cualquiera con acceso de lectura a `sesiones` —una copia de
 * seguridad, un panel de Supabase, una fuga— tenía la sesión de todo el que
 * hubiera entrado, lista para usar. Con el hash, la tabla sirve para
 * comprobar y revocar, y para nada más.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class AuthService {
  /**
   * Resuelve a qué empresa pertenece un correo.
   *
   * Es el único punto del sistema que mira a través de las empresas, y por eso
   * no lo hace con una consulta normal sino con `app_identidad_por_correo`, una
   * función de la base que corre con los permisos de su dueño y devuelve
   * exactamente dos números: el id del usuario y el de su empresa. Ni nombre,
   * ni correo, ni contraseña.
   *
   * Hace falta porque quien entra solo dice su correo: hasta resolverlo no se
   * sabe de qué agencia es, y sin empresa las políticas de la base no dejan ver
   * ninguna fila. La alternativa —dejar `usuarios` sin proteger— convertiría la
   * tabla de usuarios en la única sin aislamiento del sistema.
   */
  async _identidadPorCorreo(email) {
    const [fila] = await prisma.$queryRaw`SELECT * FROM app_identidad_por_correo(${email.toLowerCase()})`;
    return fila || null;
  }

  async login({ email, password, remember, userAgent }) {
    if (!email || !password) throw new BadRequestError('Correo y contraseña requeridos');

    const identidad = await this._identidadPorCorreo(email);

    // Todo lo demás ocurre ya dentro de la empresa de quien entra, incluida la
    // lectura del propio usuario: a partir de aquí manda la política.
    const usuario = identidad && await conEmpresa(identidad.empresa_id, () => prisma.usuarios.findFirst({
      where: { id: identidad.usuario_id },
      include: {
        personas: { include: { tipos_documento: true } },
        roles: { include: { permisos_rol: { include: { permisos: true } } } },
      }
    }));

    // Correo que no existe y contraseña que no es: el mismo error.
    //
    // Antes eran dos mensajes distintos, "Usuario no encontrado" y
    // "Contraseña incorrecta", así que el formulario de entrada valía como
    // buscador de correos dados de alta: se prueba una lista y los que
    // contestan lo segundo existen. Y con la contraseña de uno de ellos ya se
    // sabe a quién atacar.
    const valida = await bcrypt.compare(password, usuario?.password_hash || HASH_SENUELO);
    if (!usuario || !valida) throw new UnauthorizedError(CREDENCIALES_MAL);

    if (usuario.status === 'inactive') throw new UnauthorizedError('Usuario inactivo. Contacte al administrador');

    // Una agencia suspendida no deja entrar a nadie. Se comprueba después de la
    // contraseña a propósito: antes, el mensaje distinto convertiría el login en
    // un detector de qué agencias están suspendidas para quien solo prueba
    // correos.
    const empresa = await conEmpresa(usuario.empresa_id, () => prisma.empresas.findFirst({
      where: { id: usuario.empresa_id }, select: { estado: true, slug: true },
    }));
    if (!empresa || empresa.estado !== 'activa') {
      throw new UnauthorizedError('Esta agencia está suspendida. Contacte con el administrador del sistema');
    }

    const token = generateToken({ userId: usuario.id, role: usuario.roles.nombre, empresaId: usuario.empresa_id }, remember);
    const expiresAt = new Date(getExpiryTime(remember));

    await conEmpresa(usuario.empresa_id, async () => {
      await prisma.sesiones.create({
        data: { id: crypto.randomUUID(), usuario_id: usuario.id, token_hash: hashToken(token), expires_at: expiresAt, user_agent: userAgent || null }
      });
      await prisma.usuarios.update({
        where: { id: usuario.id },
        data: { ultimo_login: new Date() }
      });
    });

    return {
      token,
      user: {
        id: usuario.id,
        email: usuario.email,
        role: usuario.roles.nombre,
        firstName: usuario.personas.nombres,
        lastName: usuario.personas.apellidos,
        name: `${usuario.personas.nombres} ${usuario.personas.apellidos}`,
        docType: usuario.personas.tipos_documento?.abreviatura || null,
        docNumber: usuario.personas.documento,
        phone: usuario.personas.telefono,
        status: usuario.status,
        avatar: usuario.personas.avatar_url,
        birth_date: usuario.personas.birth_date,
        empresaId: usuario.empresa_id,
        // El identificador que va en la URL del navegador. Se manda aquí para
        // que la interfaz componga la dirección sin una segunda llamada.
        empresaSlug: empresa.slug,
      }
    };
  }

  /**
   * Cierra la sesión de verdad.
   *
   * `logout` respondía "Logout exitoso" con la llamada al servicio comentada:
   * la fila de `sesiones` se quedaba y el token seguía valiendo hasta caducar.
   * Ahora se borra la fila y se olvida la entrada de la caché de auth, que es
   * lo que hace que el middleware deje de aceptar ese token en el momento.
   */
  async logout(token) {
    if (!token) return { message: 'Sesión cerrada' };
    const hash = hashToken(token);
    await prisma.sesiones.deleteMany({ where: { token_hash: hash } });
    olvidarToken(hash);
    return { message: 'Sesión cerrada' };
  }

  /**
   * Paso 1 de recuperación: manda un código de seis cifras al correo.
   *
   * Devolvía 200 con "Instrucciones enviadas" sin mirar el cuerpo ni enviar
   * nada. Quien perdía la contraseña se quedaba esperando un correo que no
   * existía.
   *
   * La respuesta es la misma exista el correo o no, y también si el usuario
   * está inactivo. Si contestara distinto, este endpoint —que no pide
   * credenciales— sería un buscador de correos dados de alta.
   *
   * El código se guarda hasheado con bcrypt, no en claro: son seis cifras, o
   * sea un millón de posibilidades, que con un hash rápido se recorren en
   * segundos si la tabla se filtra. Los códigos anteriores que siguieran vivos
   * se invalidan, para que pedir uno nuevo no deje dos válidos a la vez.
   */
  async forgotPassword({ email }) {
    const generico = { message: 'Si el correo está registrado, recibirás un código para restablecer la contraseña' };

    // Igual que el login: el correo no dice de qué empresa es hasta resolverlo.
    const identidad = await this._identidadPorCorreo(email);
    if (!identidad) return generico;
    const usuario = await conEmpresa(identidad.empresa_id, () => prisma.usuarios.findFirst({
      where: { id: identidad.usuario_id },
      select: { id: true, status: true, personas: { select: { nombres: true } } },
    }));
    if (!usuario || usuario.status === 'inactive') return generico;

    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const expira = new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000);

    const codigoHash = await bcrypt.hash(codigo, 10);
    await conEmpresa(identidad.empresa_id, () => prisma.transaccion(async (tx) => {
      // Un solo código vivo por usuario.
      await tx.$executeRaw`UPDATE codigos_recuperacion
                              SET usado_at = NOW()
                            WHERE usuario_id = ${usuario.id} AND usado_at IS NULL`;
      await tx.$executeRaw`INSERT INTO codigos_recuperacion (id, usuario_id, codigo_hash, expires_at)
                           VALUES (${crypto.randomUUID()}, ${usuario.id}, ${codigoHash}, ${expira})`;
    }));

    // El envío va DENTRO del contexto de la empresa, no fuera: es de ahí de donde
    // `sendEmail` saca el remitente. Fuera, el correo saldría con la marca por
    // defecto y quien lo recibe no reconocería de quién es.
    const envio = await conEmpresa(identidad.empresa_id, async () => {
      const { nombre: agencia } = await emailService.marcaDeCorreo();
      return emailService.sendEmail({
        to: email,
        subject: `${agencia} · tu código para restablecer la contraseña: ${codigo}`,
        html: `
          <p>Hola ${usuario.personas?.nombres || ''},</p>
          <p>Tu código para restablecer la contraseña en ${agencia} es:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px">${codigo}</p>
          <p>Caduca en ${CODIGO_VIGENCIA_MIN} minutos y solo se puede usar una vez.</p>
          <p>Si no has pedido este cambio, ignora este correo: tu contraseña sigue siendo la misma.</p>`,
      });
    });
    // `sendEmail` no lanza, devuelve { success }. Si el correo falla se anota
    // en el log del servidor, pero la respuesta al cliente no cambia: decirle
    // "no se pudo enviar" también le confirmaría que el correo existe.
    if (!envio.success) console.error('No se pudo enviar el código de recuperación al usuario', usuario.id);

    return generico;
  }

  /**
   * Busca el código vivo de un correo y lo compara.
   *
   * Devuelve la fila o null, y cuenta el intento fallido. Sin ese contador,
   * seis cifras se adivinan a base de peticiones; con él, el código muere al
   * quinto fallo aunque siga en plazo.
   */
  async _codigoValido(email, code) {
    const identidad = await this._identidadPorCorreo(email);
    if (!identidad) return null;
    const usuario = await conEmpresa(identidad.empresa_id, () => prisma.usuarios.findFirst({
      where: { id: identidad.usuario_id },
      select: { id: true, status: true },
    }));
    if (!usuario || usuario.status === 'inactive') return null;

    // El código vive en la empresa del usuario, así que leerlo y quemarlo va
    // dentro de su contexto. Se devuelve la empresa para que `resetPassword`
    // escriba dentro de la misma.
    return conEmpresa(identidad.empresa_id, async () => {
      return transaccion(async (tx) => {
        const [fila] = await tx.$queryRaw`
          SELECT id, codigo_hash, intentos
            FROM codigos_recuperacion
           WHERE usuario_id = ${usuario.id}
             AND usado_at IS NULL
             AND expires_at > NOW()
           ORDER BY creado_at DESC
           LIMIT 1`;
        if (!fila) return null;
  
        if (await bcrypt.compare(code, fila.codigo_hash)) {
          return { usuarioId: usuario.id, codigoId: fila.id, empresaId: identidad.empresa_id };
        }
  
        const intentos = Number(fila.intentos) + 1;
        // Al llegar al tope el código se marca usado: quemarlo es más seguro que
        // dejarlo en plazo con un contador alto.
        await tx.$executeRaw`
          UPDATE codigos_recuperacion
             SET intentos = ${intentos},
                 usado_at = CASE WHEN ${intentos} >= ${CODIGO_MAX_INTENTOS} THEN NOW() ELSE NULL END
           WHERE id = ${fila.id}`;
        return null;
      });
    });
  }

  /**
   * Paso 2: comprueba el código sin gastarlo.
   *
   * No lo marca usado porque el paso 3 lo necesita: la pantalla verifica
   * primero y pide la contraseña nueva después. Devolvía "Código verificado"
   * a cualquier cosa, incluso a un cuerpo vacío.
   */
  async verifyCode({ email, code }) {
    const valido = await this._codigoValido(email, code);
    if (!valido) throw new BadRequestError('El código no es válido o ha caducado');
    return { message: 'Código verificado' };
  }

  /**
   * Paso 3: cambia la contraseña y cierra todas las sesiones.
   *
   * Devolvía "Contraseña actualizada" sin tocar nada, así que la recuperación
   * terminaba con un mensaje de éxito y la contraseña vieja intacta.
   *
   * Al cambiarla se borran las sesiones del usuario: si alguien había entrado
   * con la contraseña anterior, su token deja de valer. Es lo que espera quien
   * restablece la contraseña precisamente porque cree que se la han robado.
   */
  async resetPassword({ email, code, password }) {
    const valido = await this._codigoValido(email, code);
    if (!valido) throw new BadRequestError('El código no es válido o ha caducado');

    const password_hash = await bcrypt.hash(password, 10);
    await conEmpresa(valido.empresaId, () => prisma.transaccion(async (tx) => {
      await tx.usuarios.update({ where: { id: valido.usuarioId }, data: { password_hash } });
      await tx.$executeRaw`UPDATE codigos_recuperacion SET usado_at = NOW() WHERE id = ${valido.codigoId}`;
      await tx.sesiones.deleteMany({ where: { usuario_id: valido.usuarioId } });
    }));
    olvidarUsuario(valido.usuarioId);

    return { message: 'Contraseña actualizada. Ya puedes entrar con ella' };
  }

  async me(userId) {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        personas: { include: { tipos_documento: true } },
        roles: { include: { permisos_rol: { include: { permisos: true } } } },
      }
    });

    if (!usuario) throw new NotFoundError('Usuario no encontrado');

    return {
      user: {
        id: usuario.id,
        email: usuario.email,
        role: usuario.roles.nombre,
        firstName: usuario.personas.nombres,
        lastName: usuario.personas.apellidos,
        name: `${usuario.personas.nombres} ${usuario.personas.apellidos}`,
        docType: usuario.personas.tipos_documento?.abreviatura || null,
        docNumber: usuario.personas.documento,
        phone: usuario.personas.telefono,
        status: usuario.status,
        avatar: usuario.personas.avatar_url,
        birth_date: usuario.personas.birth_date
      }
    };
  }
}

module.exports = new AuthService();
