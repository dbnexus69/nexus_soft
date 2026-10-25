/**
 * Siembra la lista de proveedores iniciales (spec 030) en las agencias que YA existen —
 * las que se creen de ahora en más la reciben solo con `companies.service.js::create`.
 *
 * `proveedores` es por agencia a propósito (no un catálogo global): cada fila es
 * copia propia de cada agencia, que puede editarla o borrarla sin afectar a otra.
 * Por eso este script entra en el contexto de CADA agencia por turno (`conEmpresa`,
 * con el rol de la aplicación, no el de administrador) y usa los mismos módulos que
 * usa el servidor — no una conexión aparte — para que la política de la base siga
 * siendo la que manda.
 *
 * Idempotente: si una agencia ya tiene un proveedor con ese nombre (lo trajo este
 * script antes, o lo escribió alguien a mano), no lo repite.
 *
 * `node prisma/seed-proveedores-iniciales.js`, desde `backend/`.
 */
require('dotenv').config();
const prisma = require('../src/config/db');
const { conEmpresa, sinEmpresa } = require('../src/config/tenant');
const { PROVEEDORES_INICIALES } = require('../src/services/companies.service');

async function main() {
  const agencias = await sinEmpresa(
    () => prisma.empresas.findMany({ where: { deleted_at: null }, select: { id: true, nombre: true } }),
    { esSuperadmin: true },
  );
  console.log(`${agencias.length} agencia(s) encontrada(s).`);

  for (const agencia of agencias) {
    await conEmpresa(agencia.id, async () => {
      const existentes = new Set(
        (await prisma.proveedores.findMany({ where: { status: 'active' }, select: { nombre: true } }))
          .map(p => p.nombre),
      );
      const faltantes = PROVEEDORES_INICIALES.filter(p => !existentes.has(p.nombre));
      if (!faltantes.length) {
        console.log(`  ${agencia.nombre}: ya los tenía todos.`);
        return;
      }
      await prisma.proveedores.createMany({ data: faltantes });
      console.log(`  ${agencia.nombre}: +${faltantes.length} proveedor(es).`);
    });
  }
  console.log('Listo.');
}

main()
  .catch((err) => { console.error('Error sembrando proveedores:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
