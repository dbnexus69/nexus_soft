/**
 * Datos de desarrollo para la base local (spec 038): dos agencias y un superadministrador. Sin datos reales.
 *
 * Las agencias salen del alta real (`companies.service.js::create`), con sus roles, permisos, métodos de pago y
 * proveedores. Son dos porque el superadministrador no puede suplantar la agencia donde vive su fila.
 *
 * Solo corre contra el docker-compose. Idempotente: lo que ya existe no se toca. Lo llama `pnpm local:preparar`.
 */
require('dotenv').config();
const { exigirLocal } = require('../scripts/solo-local');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const companiesService = require('../src/services/companies.service');
const { sinEmpresa } = require('../src/config/tenant');
const prisma = require('../src/config/db');

const CLAVE = 'Local-nexus-1!';
const SUPERADMINS = [
  ['super@nexus.local', CLAVE, 'Super'],
  ['admin@nexus.local', 'Admin123*', 'Nexus'],
];
const TIPOS_DOCUMENTO = [
  ['CC', 'Cédula de Ciudadanía'], ['CE', 'Cédula de Extranjería'], ['TI', 'Tarjeta de Identidad'],
  ['Pasaporte', 'Pasaporte'], ['NIT', 'NIT'],
];

async function asegurarAgencia(admin, slug, nombre, correo) {
  if (!await admin.empresas.findFirst({ where: { slug } })) {
    await sinEmpresa(() => companiesService.create({
      slug, nombre, admin: { firstName: 'Admin', lastName: nombre, email: correo, password: CLAVE },
    }), { esSuperadmin: true });
    console.log(`  agencia creada: ${nombre}`);
  }
  return admin.empresas.findFirst({ where: { slug } });
}

async function main() {
  exigirLocal();
  const admin = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  try {
    // Catálogo global, sin `empresa_id`. Ninguna migración lo llena: en producción lo sembró el seed antiguo.
    for (const [abreviatura, nombre] of TIPOS_DOCUMENTO) {
      await admin.tipos_documento.upsert({ where: { abreviatura }, update: {}, create: { abreviatura, nombre } });
    }

    const casa = await asegurarAgencia(admin, 'nexus-casa', 'Nexus Casa', 'admin@casa.local');
    await asegurarAgencia(admin, 'agencia-demo', 'Agencia Demo', 'admin@demo.local');

    // El superadministrador es una fila normal de `usuarios`, en una agencia real, con el rol `superadmin`.
    for (const [correo, clave, nombres] of SUPERADMINS) {
      if (await admin.usuarios.findFirst({ where: { email: correo } })) continue;
      const rol = await admin.roles.findFirst({ where: { empresa_id: casa.id, nombre: 'superadmin' } })
        ?? await admin.roles.create({ data: { empresa_id: casa.id, nombre: 'superadmin' } });
      const persona = await admin.personas.create({
        data: { empresa_id: casa.id, nombres, apellidos: 'Admin', email: correo, status: 'active' },
      });
      await admin.usuarios.create({
        data: {
          empresa_id: casa.id, persona_id: persona.id, email: correo,
          password_hash: await bcrypt.hash(clave, 10), rol_id: rol.id, status: 'active',
        },
      });
      console.log(`  superadministrador creado: ${correo}`);
    }
    console.log('\n  Superadministradores:');
    for (const [correo, clave] of SUPERADMINS) console.log(`    ${correo}  /  ${clave}`);
    console.log(`  Administradores de agencia: admin@casa.local, admin@demo.local  /  ${CLAVE}\n`);
  } finally {
    await admin.$disconnect();
  }
}

main()
  .catch((err) => { console.error('[LOCAL_SEED_FAILED]', err.message || err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
