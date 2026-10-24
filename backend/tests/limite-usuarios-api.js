#!/usr/bin/env node
/**
 * Límite de usuarios por plan, por la API (spec 029). `pnpm test:limite-usuarios`
 *
 * Una agencia nueva nace en el plan base (4 usuarios, incluido el admin); el 5.º
 * usuario activo da 422; subir el límite desde `/companies` deja entrar al 5.º; dar
 * de baja a uno libera el cupo en el acto; y un límite nulo no tiene tope.
 *
 * Levanta su propio servidor en otro puerto (`TEST_PORT`, 3917 por defecto) con el rol
 * de la aplicación, monta dos agencias (la de prueba y la "casa" del superadministrador,
 * que no cuenta para el límite de la otra, como en producción) y al terminar lo
 * desmonta todo. Solo toca agencias cuyo slug empieza por `prueba-limite-`.
 */
const {
  admin, CLAVE, comprobar, pedir, entrar,
  levantarServidor, montarAgencia, montarSuperadmin, ejecutar,
} = require('./montaje');

const PREFIJO = 'prueba-limite-';

async function main() {
  const A = await montarAgencia(PREFIJO, 'a');
  const H = await montarAgencia(PREFIJO, 'casa');
  const correoSuper = await montarSuperadmin(H);
  await levantarServidor();

  const tokA = await entrar(A.correo);
  const tokSuper = await entrar(correoSuper);

  console.log('  Plan por defecto de una agencia nueva');
  const empresaA = await admin.empresas.findFirst({ where: { id: A.id } });
  comprobar('nace con límite 4', empresaA.limite_usuarios === 4, String(empresaA.limite_usuarios));
  comprobar('nace en Plan Base', empresaA.nombre_plan === 'Plan Base', empresaA.nombre_plan);
  comprobar('nace a 300000', empresaA.precio_plan === 300000, String(empresaA.precio_plan));

  const crearUsuario = (sufijo) => pedir('POST', '/users', tokA, {
    firstName: 'Usuario', lastName: 'Prueba', email: `${A.slug}-${sufijo}@prueba.local`, password: CLAVE, role: 'asesor',
  });
  const campos = (r) => (r.json?.error?.details || []).map(d => d.field);

  console.log('\n  Tope del plan base (el admin ya cuenta como 1 de 4)');
  const u1 = await crearUsuario('u1');
  const u2 = await crearUsuario('u2');
  const u3 = await crearUsuario('u3');
  comprobar('el 2.º usuario entra', u1.status === 201, `HTTP ${u1.status}`);
  comprobar('el 3.º usuario entra', u2.status === 201, `HTTP ${u2.status}`);
  comprobar('el 4.º usuario entra', u3.status === 201, `HTTP ${u3.status}`);

  const u4 = await crearUsuario('u4');
  comprobar('el 5.º usuario da 422', u4.status === 422, `HTTP ${u4.status}`, JSON.stringify(u4.json?.error));

  console.log('\n  El superadministrador sube el límite');
  const subir = await pedir('PATCH', `/companies/${A.id}`, tokSuper, { limiteUsuarios: 5 });
  comprobar('PATCH /companies sube el límite: 200', subir.status === 200, `HTTP ${subir.status}`);
  comprobar('la ficha devuelve el límite nuevo', subir.json?.data?.limiteUsuarios === 5);

  const u5 = await crearUsuario('u5');
  comprobar('con el límite en 5, el 5.º usuario entra', u5.status === 201, `HTTP ${u5.status}`);

  const u6 = await crearUsuario('u6');
  comprobar('el 6.º sigue dando 422, no se movió sin pedirlo', u6.status === 422 && campos(u6).length === 0, `HTTP ${u6.status}`);

  console.log('\n  Dar de baja libera un cupo de inmediato');
  const idU5 = u5.json?.data?.id;
  const baja = await pedir('DELETE', `/users/${idU5}`, tokA);
  comprobar('dar de baja: 200', baja.status === 200, `HTTP ${baja.status}`);
  const u7 = await crearUsuario('u7');
  comprobar('tras la baja, vuelve a entrar uno sin tocar el límite', u7.status === 201, `HTTP ${u7.status}`);

  console.log('\n  Límite nulo: plan Deluxe, sin tope');
  const sinLimite = await pedir('PATCH', `/companies/${A.id}`, tokSuper, { limiteUsuarios: null, nombrePlan: 'Plan Deluxe', precioPlan: 800000 });
  comprobar('PATCH a límite nulo: 200', sinLimite.status === 200, `HTTP ${sinLimite.status}`);
  const u8 = await crearUsuario('u8');
  const u9 = await crearUsuario('u9');
  comprobar('sin límite entran los que hagan falta', u8.status === 201 && u9.status === 201, `${u8.status} ${u9.status}`);
}

ejecutar('Límite de usuarios por plan', PREFIJO, main);
