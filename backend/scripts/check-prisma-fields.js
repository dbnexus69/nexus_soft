/**
 * Valida el uso de Prisma en todo el backend contra el DMMF.
 *
 *   pnpm check:prisma
 *
 * Comprueba dos cosas en cada llamada `prisma.<modelo>.<metodo>({ ... })`:
 *   1. que el modelo exista;
 *   2. que las claves de where/data/select/include/orderBy sean campos de ESE
 *      modelo.
 *
 * Existe porque el mismo error apareció seis veces en este repo: escribir los
 * campos en camelCase cuando el schema los declara en snake_case. Prisma no
 * avisa al escribir el código — falla en ejecución, y solo si esa rama se
 * ejecuta. Así quedaron rotos durante meses createSale con productos,
 * los 45 endpoints de producto, getClientById, updatePermissions, listPayments,
 * sendVoucher y getResponsableById.
 *
 * Sale con código 1 si encuentra algo, para poder usarlo en CI.
 */
const { Prisma } = require('@prisma/client');
const fs = require('fs');
const { execSync } = require('child_process');

const modelos = new Map();
for (const m of Prisma.dmmf.datamodel.models) {
  modelos.set(m.name, {
    campos: new Set(m.fields.map(f => f.name)),
    relaciones: new Set(m.fields.filter(f => f.kind === 'object').map(f => f.name)),
    porRelacion: new Map(m.fields.filter(f => f.kind === 'object').map(f => [f.name, f.type])),
  });
}

const METODOS = 'findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany|count|aggregate|groupBy';
// Palabras del propio lenguaje de Prisma, no campos del modelo.
const OPERADORES = new Set([
  'AND','OR','NOT','some','every','none','is','isNot','equals','not','in','notIn',
  'lt','lte','gt','gte','contains','startsWith','endsWith','mode','set','connect',
  'disconnect','create','createMany','update','updateMany','upsert','delete','deleteMany',
  'connectOrCreate','increment','decrement','multiply','divide','push','_count','_sum',
  '_avg','_min','_max','_all','select','include','where','data','orderBy','take','skip',
  'cursor','distinct','by','having','omit','sort','nulls',
]);

/** Devuelve el bloque {...} que empieza en `desde`, balanceando llaves. */
function bloque(src, desde) {
  let prof = 0;
  for (let i = desde; i < src.length; i++) {
    if (src[i] === '{') prof++;
    else if (src[i] === '}') { prof--; if (prof === 0) return src.slice(desde, i + 1); }
  }
  return null;
}

/** Claves de primer nivel de un literal de objeto, carácter a carácter. */
function clavesDe(txt) {
  const claves = [];
  let prof = 0, i = 0, enCadena = null;
  while (i < txt.length) {
    const c = txt[i];
    if (enCadena) {
      if (c === '\\') { i += 2; continue; }
      if (c === enCadena) enCadena = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { enCadena = c; i++; continue; }
    if (c === '{' || c === '[') { prof++; i++; continue; }
    if (c === '}' || c === ']') { prof--; i++; continue; }
    if (prof === 1) {
      const resto = txt.slice(i);
      const m = resto.match(/^([A-Za-z_$][\w$]*)\s*:/);
      if (m && (i === 0 || /[{,\s]/.test(txt[i - 1]))) {
        claves.push(m[1]);
        i += m[0].length;
        continue;
      }
    }
    i++;
  }
  return claves;
}

const hallazgos = [];
const archivos = execSync('find src -name "*.js"').toString().trim().split('\n');

for (const f of archivos) {
  const src = fs.readFileSync(f, 'utf8');
  const re = new RegExp(`\\b(?:prisma|tx)\\.([a-zA-Z_][\\w]*)\\.(${METODOS})\\s*\\(\\s*\\{`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, modelo] = m;
    const info = modelos.get(modelo);
    if (!info) continue; // los modelos inválidos ya se detectan aparte
    const inicio = src.indexOf('{', m.index + m[0].length - 1);
    const arg = bloque(src, inicio);
    if (!arg) continue;

    // Secciones que contienen campos del modelo
    for (const seccion of ['where', 'data', 'select', 'orderBy', 'include']) {
      const re2 = new RegExp(`\\b${seccion}\\s*:\\s*\\{`);
      const m2 = arg.match(re2);
      if (!m2) continue;
      const ini = arg.indexOf('{', arg.indexOf(m2[0]) + m2[0].length - 1);
      const sub = bloque(arg, ini);
      if (!sub) continue;
      for (const clave of clavesDe(sub)) {
        if (OPERADORES.has(clave)) continue;
        if (info.campos.has(clave)) continue;
        const linea = src.slice(0, m.index).split('\n').length;
        hallazgos.push({ f, linea, modelo, seccion, clave });
      }
    }
  }
}

// 1. Modelos inexistentes
const modelosMalos = [];
for (const f of archivos) {
  const src = fs.readFileSync(f, 'utf8');
  src.split('\n').forEach((linea, i) => {
    for (const m of linea.matchAll(new RegExp(`\\b(?:prisma|tx)\\.([a-zA-Z_][\\w]*)\\.(?:${METODOS})\\b`, 'g'))) {
      if (!modelos.has(m[1])) modelosMalos.push({ f, linea: i + 1, modelo: m[1] });
    }
  });
}
console.log('=== modelos que no existen ===');
if (!modelosMalos.length) console.log('  ninguno');
modelosMalos.forEach(x => console.log(`  ${x.f}:${x.linea}  prisma.${x.modelo}`));

console.log('\n=== campos que no existen en su modelo ===');
if (!hallazgos.length) console.log('  ninguno');
const porArchivo = {};
for (const h of hallazgos) (porArchivo[h.f] ||= []).push(h);
for (const [f, lista] of Object.entries(porArchivo)) {
  console.log('\n  ' + f);
  const vistos = new Set();
  for (const h of lista) {
    const k = `${h.modelo}.${h.clave}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const snake = h.clave.replace(/([A-Z])/g, '_$1').toLowerCase();
    const info = modelos.get(h.modelo);
    const sug = info.campos.has(snake) ? `  -> ${snake}` : '  (sin pareja evidente)';
    console.log(`    L${String(h.linea).padEnd(5)} ${h.modelo}.${h.clave}${sug}`);
  }
}
console.log(`\n  total: ${hallazgos.length} usos, ${new Set(hallazgos.map(h => h.modelo + '.' + h.clave)).size} campos distintos`);

// ── Objetos construidos aparte y pasados por variable ──────────────────────
// El escáner de arriba solo ve literales dentro de la llamada. Los transforms
// de products.controller.js construyen el objeto en una función y lo pasan como
// variable, así que se validan por separado: ahí se escaparon aerolineaId y
// plan_equipaje_id.
const transformesMalos = [];
{
  const f = 'src/controllers/products.controller.js';
  if (fs.existsSync(f)) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /H\('([a-z]+)', '(prod_\w+)', \(d, detalleId\) => \(\{([\s\S]*?)\}\)\)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const [, cat, modelo, cuerpo] = m;
      const info = modelos.get(modelo);
      if (!info) continue;
      for (const c of [...cuerpo.matchAll(/^\s*([a-zA-Z_][\w]*)\s*:/gm)].map(x => x[1])) {
        if (!info.campos.has(c)) transformesMalos.push({ cat, modelo, clave: c });
      }
    }
  }
}
console.log('\n=== transforms de producto ===');
if (!transformesMalos.length) console.log('  ninguno');
transformesMalos.forEach(t => console.log(`  ${t.cat.padEnd(12)} ${t.modelo}.${t.clave}`));


if (hallazgos.length || modelosMalos.length || transformesMalos.length) {
  console.log('\n  Corrige estos usos: fallarían en ejecución con PrismaClientValidationError.');
  process.exit(1);
}
console.log('  Sin problemas.');
