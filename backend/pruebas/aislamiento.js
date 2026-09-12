#!/usr/bin/env node
/**
 * La prueba que valida el multi-tenant. `pnpm test:aislamiento`
 *
 * Comprueba que una agencia no puede ver ni tocar los datos de otra, y lo hace
 * sobre la base de verdad, con dos empresas y datos en las dos.
 *
 * **Por qué esta prueba y no otra.** El aislamiento es lo único de este sistema
 * que, cuando se rompe, no avisa: una consulta mal hecha devuelve datos de más y
 * responde 200. Todo lo demás falla ruidosamente. Así que esto tiene que correr
 * solo, en cada despliegue, y no depender de que alguien se acuerde de mirar.
 *
 * **Qué la haría fallar de verdad**, por si algún día se pone en rojo:
 * - Que `DATABASE_URL` apunte a `postgres` en vez de a `app_nexus`. Ese rol
 *   tiene BYPASSRLS y se salta las políticas sin dar un solo error. Es el fallo
 *   más probable de todos, y por eso es la primera comprobación.
 * - Que una tabla nueva se cree sin su política.
 * - Que alguien toque la extensión de Prisma que fija el contexto.
 *
 * No usa ningún marco de pruebas a propósito: es el primer test del repo y no
 * parecía el momento de meter una dependencia para ejecutar un archivo.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/config/db');
const { conEmpresa, sinEmpresa } = require('../src/config/tenant');

// El escenario se monta con el rol que administra, porque crear una empresa y
// sembrarla es justo lo que la aplicación no debe poder hacer sola.
const admin = new PrismaClient({
  datasourceUrl: (process.env.DIRECT_URL || process.env.DATABASE_URL || '').split('?')[0],
});

const SLUG = 'prueba-aislamiento-automatica';
let fallos = 0;

function comprobar(descripcion, condicion, detalle = '') {
  const ok = Boolean(condicion);
  if (!ok) fallos++;
  console.log(`  ${ok ? '✓' : '✗'} ${descripcion}${detalle ? `  → ${detalle}` : ''}`);
}

/** Deja la base como estaba, pase lo que pase. */
async function desmontar() {
  const e = await admin.empresas.findFirst({ where: { slug: SLUG } });
  if (!e) return;
  await admin.suplantaciones.deleteMany({ where: { empresa_id: e.id } });
  await admin.pagos_venta.deleteMany({ where: { empresa_id: e.id } });
  await admin.detalle_venta.deleteMany({ where: { empresa_id: e.id } });
  await admin.ventas.deleteMany({ where: { empresa_id: e.id } });
  await admin.clientes.deleteMany({ where: { empresa_id: e.id } });
  await admin.permisos_rol.deleteMany({ where: { empresa_id: e.id } });
  await admin.sesiones.deleteMany({ where: { empresa_id: e.id } });
  await admin.logs_usuarios.deleteMany({ where: { empresa_id: e.id } });
  await admin.usuarios.deleteMany({ where: { empresa_id: e.id } });
  await admin.roles.deleteMany({ where: { empresa_id: e.id } });
  await admin.personas.deleteMany({ where: { empresa_id: e.id } });
  await admin.empresas.delete({ where: { id: e.id } });
}

async function main() {
  console.log('\nAislamiento entre empresas\n');

  // ── 0. El rol de la aplicación. Si esto falla, lo demás da igual.
  const [rol] = await prisma.$queryRawUnsafe(
    `SELECT current_user AS usuario,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS ignora_rls`,
  );
  comprobar(
    'la aplicación NO conecta con un rol que se salte las políticas',
    rol.ignora_rls === false,
    `rol "${rol.usuario}", bypassrls=${rol.ignora_rls}`,
  );
  if (rol.ignora_rls) {
    console.log('\n  Con ese rol las políticas se aplican sin error y no filtran nada.');
    console.log('  DATABASE_URL tiene que apuntar a app_nexus.\n');
    return;
  }

  await desmontar();

  // ── 1. Una segunda agencia con datos propios
  const otra = await admin.empresas.create({ data: { slug: SLUG, nombre: 'Agencia de Prueba' } });
  // Su propio rol, no el de la empresa 1: desde que las claves ajenas llevan
  // la empresa dentro, un usuario no puede colgar de un rol ajeno.
  const rolAsesor = await admin.roles.create({ data: { empresa_id: otra.id, nombre: 'asesor' } });
  const perU = await admin.personas.create({ data: { empresa_id: otra.id, nombres: 'Usuaria', apellidos: 'Ajena', documento: `pa-${otra.id}-u`, status: 'active' } });
  const usr = await admin.usuarios.create({ data: { empresa_id: otra.id, persona_id: perU.id, email: `ajena-${otra.id}@prueba.local`, password_hash: 'x', rol_id: rolAsesor.id } });
  const perC = await admin.personas.create({ data: { empresa_id: otra.id, nombres: 'Cliente', apellidos: 'Ajeno', documento: `pa-${otra.id}-c`, status: 'active' } });
  const cli = await admin.clientes.create({ data: { empresa_id: otra.id, persona_id: perC.id, creado_por_id: usr.id } });
  const venta = await admin.ventas.create({ data: { empresa_id: otra.id, cliente_id: cli.id, usuario_id: usr.id, monto_total: 999999, numero: 1 } });

  const propias = await admin.ventas.count({ where: { empresa_id: 1 } });
  const totales = await admin.ventas.count();

  // ── 2. Cada empresa ve lo suyo, por Prisma y por SQL crudo
  const mirar = (empresaId) => conEmpresa(empresaId, async () => ({
    prisma: await prisma.ventas.count(),
    crudo: Number((await prisma.$queryRawUnsafe('SELECT count(*)::int AS n FROM ventas'))[0].n),
    clientes: await prisma.clientes.count(),
  }));
  const a = await mirar(1);
  const b = await mirar(otra.id);

  comprobar('la empresa 1 ve solo sus ventas', a.prisma === propias, `${a.prisma} de ${totales}`);
  comprobar('la otra empresa ve solo la suya', b.prisma === 1, `${b.prisma} de ${totales}`);
  comprobar(
    'un SELECT count(*) SIN WHERE tampoco cruza (la barrera no está en el código)',
    a.crudo === propias && b.crudo === 1,
    `${a.crudo} y ${b.crudo}`,
  );
  comprobar('lo mismo con los clientes', b.clientes === 1);

  // ── 3. Leer por id un registro ajeno
  const ajena = await conEmpresa(1, () => prisma.ventas.findFirst({ where: { id: venta.id } }));
  comprobar('pedir por id la venta de otra empresa no devuelve nada', ajena === null);

  // ── 4. Escribir en la empresa ajena
  const escritura = await conEmpresa(1, async () => {
    try {
      await prisma.$executeRawUnsafe(
        'INSERT INTO ventas (cliente_id, usuario_id, monto_total, empresa_id, numero) VALUES ($1,$2,0,$3,999)',
        cli.id, usr.id, otra.id,
      );
      return 'pasó';
    } catch { return 'rechazado'; }
  });
  comprobar('insertar una fila con el empresa_id de otra queda rechazado', escritura === 'rechazado');

  // ── 4b. Colgar una fila propia de un padre ajeno
  //
  // Esta es la que no se ve venir: la fila se escribe en TU empresa, así que la
  // RLS la deja pasar; lo que es de otra agencia es el cliente al que apunta.
  // Sin las claves ajenas compuestas, la base la aceptaba y el listado —que
  // hace JOIN con clientes, filtrado por la RLS— no la mostraba nunca. Una
  // venta guardada e invisible, sin un solo error por ningún lado.
  const cruzada = await conEmpresa(1, async () => {
    try {
      await prisma.$executeRawUnsafe(
        'INSERT INTO ventas (cliente_id, usuario_id, monto_total, numero) VALUES ($1,$2,0,998)',
        cli.id, usr.id,
      );
      return 'pasó';
    } catch { return 'rechazado'; }
  });
  comprobar('colgar una venta propia de un cliente de otra empresa queda rechazado', cruzada === 'rechazado');

  // Y que las claves que lo impiden sigan puestas: un diff del schema que las
  // tirara dejaría las pruebas de arriba en verde igualmente, porque la RLS
  // seguiría filtrando. Lo único que avisa es contarlas.
  const [{ n: compuestas }] = await admin.$queryRawUnsafe(`
    SELECT count(*)::int AS n FROM pg_constraint
    WHERE contype = 'f' AND conname LIKE '%_empresa_fkey'`);
  comprobar('siguen las claves ajenas compuestas', compuestas === 53, `${compuestas} de 53`);

  // ── 5. Sin contexto: ni se ve ni se escribe
  const sin = await sinEmpresa(async () => {
    const visibles = await prisma.ventas.count();
    let inserto = 'rechazado';
    try {
      await prisma.proveedores.create({ data: { nombre: 'prueba-sin-contexto', status: 'active' } });
      inserto = 'pasó';
    } catch { /* esperado */ }
    return { visibles, inserto };
  });
  comprobar('sin empresa en el contexto no se ve ninguna fila', sin.visibles === 0, `${sin.visibles} visibles`);
  comprobar('sin empresa en el contexto no se puede insertar', sin.inserto === 'rechazado');

  await desmontar();
  const quedan = await admin.empresas.count({ where: { slug: SLUG } });
  comprobar('el escenario queda desmontado', quedan === 0);
}

main()
  .catch(async (e) => {
    fallos++;
    console.log(`\n  ✗ la prueba se cayó: ${String(e.message).split('\n')[0].slice(0, 200)}`);
    await desmontar().catch(() => {});
  })
  .finally(async () => {
    await admin.$disconnect().catch(() => {});
    console.log(fallos === 0 ? '\nTodo aislado.\n' : `\n${fallos} comprobación(es) en rojo.\n`);
    process.exit(fallos === 0 ? 0 : 1);
  });
