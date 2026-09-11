const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const path = require('path');
const { CARPETA_LOGOS } = require('../middleware/uploadLogo');
const prisma = require('../config/db');
const { conEmpresa, empresaActual } = require('../config/tenant');
const { NotFoundError, BadRequestError } = require('../errors/AppError');
const { buildMeta } = require('../utils/paginationHelper');
const { ROLE_DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS } = require('../middleware/authorize');

/**
 * Las agencias clientes: alta, ficha y edición. Solo para el superadministrador.
 *
 * Nada de aquí toca datos de negocio de nadie. La política de `empresas` le
 * abre esta tabla y la de auditoría, y las 42 de negocio le siguen cerradas:
 * para ver una venta tiene que entrar en la empresa, y eso deja rastro.
 */

/**
 * Los roles que recibe una agencia nueva, con su matriz de permisos.
 *
 * Se leen de la misma plantilla que usa `authorize` para decidir, en vez de
 * copiarlos aquí: si un día se añade un módulo, la agencia número veinte lo
 * recibe sin que nadie se acuerde de este archivo.
 *
 * `superadmin` no está: es del sistema, no de ninguna agencia.
 */
const ROLES_DE_UNA_EMPRESA = {
  admin: ADMIN_PERMISSIONS,
  asesor: ROLE_DEFAULT_PERMISSIONS.asesor,
  freelancer: ROLE_DEFAULT_PERMISSIONS.freelancer,
};

/** Los permisos se guardan como texto: 'true'/'false' o el alcance. */
const comoTexto = (valor) => (typeof valor === 'boolean' ? String(valor) : String(valor));

const aFicha = (e) => ({
  id: e.id,
  slug: e.slug,
  nombre: e.nombre,
  nombreComercial: e.nombre_comercial,
  logoUrl: e.logo_url,
  colorPrimario: e.color_primario,
  colorAcento: e.color_acento,
  colorRealce: e.color_realce,
  emailRemitente: e.email_remitente,
  emailNombre: e.email_nombre,
  estado: e.estado,
  creadoAt: e.creado_at,
});

class CompaniesService {
  async list({ pagination, search, estado }) {
    const { page, perPage, skip } = pagination;
    const where = { deleted_at: null };
    if (estado) where.estado = estado;
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    // El count y las filas comparten el mismo `where`, como manda el repo.
    const [total, empresas] = await Promise.all([
      prisma.empresas.count({ where }),
      prisma.empresas.findMany({ where, skip, take: perPage, orderBy: [{ nombre: 'asc' }, { id: 'asc' }] }),
    ]);
    return { data: empresas.map(aFicha), meta: buildMeta(total, page, perPage) };
  }

  /**
   * La ficha, con cifras agregadas y **ni un registro de negocio**.
   *
   * Los recuentos se piden desde dentro de la empresa, que es la única forma de
   * que la política los deje contar. Es deliberado que sean números y no filas:
   * el superadministrador tiene que poder ver si una agencia está viva sin
   * abrir sus ventas.
   */
  async getById(id) {
    const empresa = await prisma.empresas.findFirst({ where: { id: Number(id), deleted_at: null } });
    if (!empresa) throw new NotFoundError('Empresa no encontrada');

    const uso = await conEmpresa(empresa.id, async () => ({
      usuarios: await prisma.usuarios.count(),
      clientes: await prisma.clientes.count({ where: { deleted_at: null } }),
      ventas: await prisma.ventas.count({ where: { deleted_at: null } }),
    }));
    return { ...aFicha(empresa), uso };
  }

  /**
   * Alta de una agencia: su ficha, sus tres roles con permisos y su primer
   * administrador, todo o nada.
   *
   * El primer usuario va en la misma operación porque una empresa en la que
   * nadie puede entrar no sirve para nada, y dejarlo para un segundo paso
   * obligaría al superadministrador a suplantar solo para crearlo.
   */
  async create(datos) {
    const yaExiste = await prisma.empresas.findFirst({ where: { slug: datos.slug } });
    if (yaExiste) throw new BadRequestError(`Ya hay una empresa con el identificador "${datos.slug}"`);

    // El correo es único en todo el sistema: un usuario pertenece a una sola
    // agencia, así que el choque se comprueba antes de crear nada.
    const [correoEnUso] = await prisma.$queryRaw`SELECT 1 AS x FROM app_identidad_por_correo(${datos.admin.email})`;
    if (correoEnUso) throw new BadRequestError('Ese correo ya tiene cuenta en el sistema');

    const passwordHash = await bcrypt.hash(datos.admin.password, 12);
    const permisos = await this._catalogoDePermisos();

    const empresa = await prisma.transaccion(async (tx) => {
      const creada = await tx.empresas.create({
        data: {
          slug: datos.slug,
          nombre: datos.nombre,
          nombre_comercial: datos.nombreComercial ?? datos.nombre,
          color_primario: datos.colorPrimario ?? null,
          color_acento: datos.colorAcento ?? null,
          color_realce: datos.colorRealce ?? null,
          email_remitente: datos.emailRemitente ?? null,
          email_nombre: datos.emailNombre ?? datos.nombre,
        },
      });

      // A partir de aquí se escribe DENTRO de la empresa nueva: sus roles y su
      // usuario son suyos, y la política solo los deja crear con su contexto.
      // Se cambia el contexto SOBRE la misma transacción, no abriendo otra: la
      // empresa todavía no está confirmada y desde otra conexión no existiría.
      await prisma.conEmpresaEnTransaccion(tx, creada.id, async () => {
        const rolesCreados = {};
        for (const [nombre, matriz] of Object.entries(ROLES_DE_UNA_EMPRESA)) {
          const rol = await tx.roles.create({ data: { nombre, empresa_id: creada.id } });
          rolesCreados[nombre] = rol;
          const filas = [];
          for (const [modulo, acciones] of Object.entries(matriz)) {
            for (const [accion, valor] of Object.entries(acciones)) {
              const permiso = permisos.get(`${modulo}.${accion}`);
              if (!permiso) continue;
              filas.push({ rol_id: rol.id, permiso_id: permiso.id, valor: comoTexto(valor), empresa_id: creada.id });
            }
          }
          if (filas.length) await tx.permisos_rol.createMany({ data: filas });
        }

        const persona = await tx.personas.create({
          data: {
            nombres: datos.admin.firstName,
            apellidos: datos.admin.lastName,
            email: datos.admin.email,
            status: 'active',
            empresa_id: creada.id,
          },
        });
        await tx.usuarios.create({
          data: {
            persona_id: persona.id,
            email: datos.admin.email,
            password_hash: passwordHash,
            rol_id: rolesCreados.admin.id,
            status: 'active',
            empresa_id: creada.id,
          },
        });
      });

      return creada;
    });

    return this.getById(empresa.id);
  }

  /** El catálogo de permisos es compartido; se lee una vez por alta. */
  async _catalogoDePermisos() {
    const todos = await prisma.permisos.findMany({ select: { id: true, modulo: true, accion: true } });
    return new Map(todos.map(p => [`${p.modulo}.${p.accion}`, p]));
  }

  /**
   * Edición parcial. El slug no está: es la dirección de la agencia y cambiarlo
   * rompería todos sus enlaces de golpe.
   */
  async update(id, datos) {
    const empresa = await prisma.empresas.findFirst({ where: { id: Number(id), deleted_at: null } });
    if (!empresa) throw new NotFoundError('Empresa no encontrada');

    const columnas = {
      nombre: 'nombre', nombreComercial: 'nombre_comercial',
      colorPrimario: 'color_primario', colorAcento: 'color_acento', colorRealce: 'color_realce',
      emailRemitente: 'email_remitente', emailNombre: 'email_nombre', estado: 'estado',
    };
    const data = {};
    for (const [clave, columna] of Object.entries(columnas)) {
      if (clave in datos) data[columna] = datos[clave];
    }

    await prisma.empresas.update({ where: { id: empresa.id }, data });

    // Suspender cierra las sesiones abiertas. Si no, quien ya estaba dentro
    // seguiría trabajando hasta que caducara su token, y suspender no
    // suspendería nada.
    if (data.estado === 'suspendida') {
      await conEmpresa(empresa.id, () => prisma.sesiones.deleteMany({}));
    }
    return this.getById(empresa.id);
  }

  /**
   * Guarda el logo y devuelve la ficha.
   *
   * El fichero anterior se borra: si no, cada cambio de logo dejaría el viejo
   * ocupando disco para siempre, y con el tiempo la carpeta sería un archivo de
   * todos los logos que una agencia ha tenido.
   */
  async setLogo(id, fichero) {
    if (!fichero) throw new BadRequestError('No llegó ningún archivo');
    const empresa = await prisma.empresas.findFirst({ where: { id: Number(id), deleted_at: null } });
    if (!empresa) throw new NotFoundError('Empresa no encontrada');

    const anterior = empresa.logo_url;
    await prisma.empresas.update({ where: { id: empresa.id }, data: { logo_url: `/uploads/logos/${fichero.filename}` } });

    if (anterior && anterior.startsWith('/uploads/logos/')) {
      // Que no se pueda borrar el anterior no es motivo para fallar: el logo
      // nuevo ya está guardado y es lo que importa.
      await fs.unlink(path.join(CARPETA_LOGOS, path.basename(anterior))).catch(() => {});
    }
    return this.getById(empresa.id);
  }

  /**
   * La marca de la empresa activa. La pide cualquiera que haya entrado.
   *
   * Sin id en la ruta a propósito: la empresa sale del token. Un
   * `/companies/:id/branding` invitaría a pedir la marca de otra, y aunque la
   * política lo impediría, el endpoint estaría preguntando algo que nadie debe
   * poder preguntar.
   */
  async brandingActual() {
    // Por id del contexto, no `findFirst` a secas: para un usuario normal la
    // política deja una sola fila y daría igual, pero el superadministrador las
    // ve todas y se llevaría la primera que saliera.
    const empresa = await prisma.empresas.findFirst({ where: { id: empresaActual(), deleted_at: null } });
    if (!empresa) throw new NotFoundError('Empresa no encontrada');
    return {
      slug: empresa.slug,
      nombre: empresa.nombre_comercial || empresa.nombre,
      logoUrl: empresa.logo_url,
      colores: {
        primario: empresa.color_primario,
        acento: empresa.color_acento,
        realce: empresa.color_realce,
      },
    };
  }
}

module.exports = new CompaniesService();
