const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// ── Helpers idempotentes ──────────────────────────────────────────
async function upsertByUnique(model, where, data) {
  return prisma[model].upsert({ where, update: {}, create: data });
}

async function upsertByUniqueWithData(model, where, data) {
  return prisma[model].upsert({ where, update: data, create: data });
}

async function createIfNotExists(model, where, data) {
  const existing = await prisma[model].findFirst({ where });
  if (existing) return existing;
  return prisma[model].create({ data });
}

async function main() {
  console.log('🌱 Iniciando seed...');
  const SALT = await bcrypt.genSalt(SALT_ROUNDS);

  // =========================================================
  // 1. CATÁLOGOS BASE
  // =========================================================

  const tipoCC   = await upsertByUnique('tiposDocumento', { abreviatura: 'CC' }, { nombre: 'Cédula de Ciudadanía', abreviatura: 'CC' });
  const tipoCE   = await upsertByUnique('tiposDocumento', { abreviatura: 'CE' }, { nombre: 'Cédula de Extranjería', abreviatura: 'CE' });
  const tipoPasaporte = await upsertByUnique('tiposDocumento', { abreviatura: 'Pasaporte' }, { nombre: 'Pasaporte', abreviatura: 'Pasaporte' });
  const tipoNIT  = await upsertByUnique('tiposDocumento', { abreviatura: 'NIT' }, { nombre: 'NIT', abreviatura: 'NIT' });
  console.log('  ✓ Tipos de documento');

  const mpEfectivo       = await upsertByUnique('metodosPago', { nombre: 'Efectivo' }, { nombre: 'Efectivo' });
  const mpTransferencia  = await upsertByUnique('metodosPago', { nombre: 'Transferencia' }, { nombre: 'Transferencia' });
  const mpTarjetaCredito = await upsertByUnique('metodosPago', { nombre: 'Tarjeta de Crédito' }, { nombre: 'Tarjeta de Crédito' });
  const mpTarjetaDebito  = await upsertByUnique('metodosPago', { nombre: 'Tarjeta Débito' }, { nombre: 'Tarjeta Débito' });
  const mpPSE            = await upsertByUnique('metodosPago', { nombre: 'PSE' }, { nombre: 'PSE' });
  const mpConsignacion   = await upsertByUnique('metodosPago', { nombre: 'Consignación' }, { nombre: 'Consignación' });
  console.log('  ✓ Métodos de pago');

  const rolAdmin      = await upsertByUnique('roles', { nombre: 'admin' }, { nombre: 'admin', descripcion: 'Administrador del sistema' });
  const rolAsesor     = await upsertByUnique('roles', { nombre: 'asesor' }, { nombre: 'asesor', descripcion: 'Asesor de ventas' });
  const rolFreelancer = await upsertByUnique('roles', { nombre: 'freelancer' }, { nombre: 'freelancer', descripcion: 'Vendedor independiente' });
  console.log('  ✓ Roles');

  // =========================================================
  // 2. PERMISOS
  // =========================================================

  const modulos = ['dashboard', 'sales', 'clients', 'itineraries', 'users', 'config'];
  const acciones = ['view', 'create', 'edit', 'delete'];
  const permisosCreados = [];

  for (const modulo of modulos) {
    for (const accion of acciones) {
      const permiso = await createIfNotExists(
        'permisos',
        { modulo, accion },
        { modulo, accion, descripcion: `${modulo} - ${accion}` }
      );
      permisosCreados.push(permiso);
    }
  }
  console.log('  ✓ Permisos');

  // Asignar todos los permisos a admin
  for (const permiso of permisosCreados) {
    await upsertByUnique('permisosRol', { rolId_permisoId: { rolId: rolAdmin.id, permisoId: permiso.id } }, { rolId: rolAdmin.id, permisoId: permiso.id });
  }
  console.log('  ✓ Permisos admin');

  // Permisos para asesor
  const asesorAcciones = {
    dashboard: ['view'],
    sales: ['view', 'create', 'edit'],
    clients: ['view', 'create'],
    itineraries: ['view'],
    users: [],
    config: []
  };
  for (const [modulo, accs] of Object.entries(asesorAcciones)) {
    for (const accion of accs) {
      const p = permisosCreados.find(p => p.modulo === modulo && p.accion === accion);
      if (p) {
        await upsertByUnique('permisosRol', { rolId_permisoId: { rolId: rolAsesor.id, permisoId: p.id } }, { rolId: rolAsesor.id, permisoId: p.id });
      }
    }
  }
  console.log('  ✓ Permisos asesor');

  // Permisos para freelancer
  const freelancerAcciones = {
    dashboard: ['view'],
    sales: ['view', 'create'],
    clients: ['view', 'create'],
    itineraries: [],
    users: [],
    config: []
  };
  for (const [modulo, accs] of Object.entries(freelancerAcciones)) {
    for (const accion of accs) {
      const p = permisosCreados.find(p => p.modulo === modulo && p.accion === accion);
      if (p) {
        await upsertByUnique('permisosRol', { rolId_permisoId: { rolId: rolFreelancer.id, permisoId: p.id } }, { rolId: rolFreelancer.id, permisoId: p.id });
      }
    }
  }
  console.log('  ✓ Permisos freelancer');

  // =========================================================
  // 3. AEROLÍNEAS
  // =========================================================

  const aerolineasData = [
    { nombre: 'Avianca', codigoIata: 'AV', tipo: 'Nacional', web: 'https://www.avianca.com' },
    { nombre: 'LATAM', codigoIata: 'LA', tipo: 'Internacional', web: 'https://www.latam.com' },
    { nombre: 'Copa Airlines', codigoIata: 'CM', tipo: 'Internacional', web: 'https://www.copaair.com' },
    { nombre: 'American Airlines', codigoIata: 'AA', tipo: 'Internacional', web: 'https://www.aa.com' },
    { nombre: 'Iberia', codigoIata: 'IB', tipo: 'Internacional', web: 'https://www.iberia.com' },
    { nombre: 'Delta', codigoIata: 'DL', tipo: 'Internacional', web: 'https://www.delta.com' },
    { nombre: 'United Airlines', codigoIata: 'UA', tipo: 'Internacional', web: 'https://www.united.com' },
    { nombre: 'Air France', codigoIata: 'AF', tipo: 'Internacional', web: 'https://www.airfrance.com' },
    { nombre: 'KLM', codigoIata: 'KL', tipo: 'Internacional', web: 'https://www.klm.com' },
    { nombre: 'JetBlue', codigoIata: 'B6', tipo: 'Internacional', web: 'https://www.jetblue.com' },
    { nombre: 'Spirit Airlines', codigoIata: 'NK', tipo: 'Internacional', web: 'https://www.spirit.com' },
    { nombre: 'Wingo', codigoIata: 'P5', tipo: 'Nacional', web: 'https://www.wingo.com' },
    { nombre: 'EasyFly', codigoIata: 'VE', tipo: 'Nacional', web: 'https://www.easyfly.com.co' },
    { nombre: 'Satena', codigoIata: '9R', tipo: 'Nacional', web: 'https://www.satena.com' },
    { nombre: 'Viva Air', codigoIata: 'VH', tipo: 'Nacional', web: null },
    { nombre: 'Emirates', codigoIata: 'EK', tipo: 'Internacional', web: 'https://www.emirates.com' },
    { nombre: 'Turkish Airlines', codigoIata: 'TK', tipo: 'Internacional', web: 'https://www.turkishairlines.com' },
    { nombre: 'Air Europa', codigoIata: 'UX', tipo: 'Internacional', web: 'https://www.aireuropa.com' },
  ];
  const aerolineasMap = {};
  for (const a of aerolineasData) {
    const aerolinea = await upsertByUnique('aerolineas', { codigoIata: a.codigoIata }, a);
    aerolineasMap[a.codigoIata] = aerolinea;
  }
  console.log('  ✓ Aerolíneas');

  // =========================================================
  // 4. AEROPUERTOS
  // =========================================================

  const aeropuertosData = [
    { nombre: 'El Dorado', codigoIata: 'BOG', ciudad: 'Bogotá', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'José María Córdova', codigoIata: 'MDE', ciudad: 'Medellín', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Olaya Herrera', codigoIata: 'EOH', ciudad: 'Medellín', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Rafael Núñez', codigoIata: 'CTG', ciudad: 'Cartagena', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Alfonso Bonilla Aragón', codigoIata: 'CLO', ciudad: 'Cali', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Gustavo Rojas Pinilla', codigoIata: 'ADZ', ciudad: 'San Andrés', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Ernesto Cortissoz', codigoIata: 'BAQ', ciudad: 'Barranquilla', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Matecaña', codigoIata: 'PEI', ciudad: 'Pereira', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Palonegro', codigoIata: 'BGA', ciudad: 'Bucaramanga', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Simón Bolívar', codigoIata: 'SMR', ciudad: 'Santa Marta', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El Edén', codigoIata: 'AXM', ciudad: 'Armenia', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'La Nubia', codigoIata: 'MZL', ciudad: 'Manizales', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Camilo Daza', codigoIata: 'CUC', ciudad: 'Cúcuta', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Almirante Padilla', codigoIata: 'RCH', ciudad: 'Riohacha', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Alfonso López Pumarejo', codigoIata: 'VUP', ciudad: 'Valledupar', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Los Garzones', codigoIata: 'MTR', ciudad: 'Montería', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Antonio Roldán Betancourt', codigoIata: 'APO', ciudad: 'Apartadó', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Las Brujas', codigoIata: 'CZU', ciudad: 'Sincelejo', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Perales', codigoIata: 'IBE', ciudad: 'Ibagué', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Benito Salas', codigoIata: 'NVA', ciudad: 'Neiva', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Guillermo León Valencia', codigoIata: 'PPN', ciudad: 'Popayán', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'San Luis', codigoIata: 'IPI', ciudad: 'Ipiales', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Antonio Nariño', codigoIata: 'PSO', ciudad: 'Pasto', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Vanguardia', codigoIata: 'VVC', ciudad: 'Villavicencio', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El Alcaraván', codigoIata: 'EYP', ciudad: 'Yopal', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Santiago Pérez Quiroz', codigoIata: 'AUC', ciudad: 'Arauca', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El Caraño', codigoIata: 'UIB', ciudad: 'Quibdó', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Yariguíes', codigoIata: 'EJA', ciudad: 'Barrancabermeja', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Reyes Murillo', codigoIata: 'NQU', ciudad: 'Nuquí', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'José Celestino Mutis', codigoIata: 'BSC', ciudad: 'Bahía Solano', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Germán Olano', codigoIata: 'PCR', ciudad: 'Puerto Carreño', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Fabio Alberto León Bentley', codigoIata: 'MVP', ciudad: 'Mitú', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Jorge Enrique González', codigoIata: 'SJE', ciudad: 'San José del Guaviare', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Tres de Mayo', codigoIata: 'PUU', ciudad: 'Puerto Asís', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Alfredo Vásquez Cobo', codigoIata: 'LET', ciudad: 'Leticia', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Golfo de Morrosquillo', codigoIata: 'TLU', ciudad: 'Tolú', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Gerardo Tobar López', codigoIata: 'BUN', ciudad: 'Buenaventura', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'San Bernardo', codigoIata: 'MMP', ciudad: 'Mompox', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Cacique Aramare', codigoIata: 'PDA', ciudad: 'Puerto Inírida', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'La Florida', codigoIata: 'TCO', ciudad: 'Tumaco', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Eduardo Falla Solano', codigoIata: 'SVI', ciudad: 'San Vicente del Caguán', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Gustavo Artunduaga', codigoIata: 'FLA', ciudad: 'Florencia', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Contador', codigoIata: 'PTX', ciudad: 'Pitalito', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Mandinga', codigoIata: 'COG', ciudad: 'Condoto', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Capurganá', codigoIata: 'CPB', ciudad: 'Capurganá', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Alcides Fernández', codigoIata: 'ACD', ciudad: 'Acandí', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Jorge Isaacs', codigoIata: 'MCJ', ciudad: 'Maicao', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Los Colonizadores', codigoIata: 'RVE', ciudad: 'Saravena', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Miami', codigoIata: 'MIA', ciudad: 'Miami', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'John F. Kennedy', codigoIata: 'JFK', ciudad: 'New York', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'Adolfo Suárez Madrid-Barajas', codigoIata: 'MAD', ciudad: 'Madrid', pais: 'España', tipo: 'Internacional' },
    { nombre: 'Charles de Gaulle', codigoIata: 'CDG', ciudad: 'París', pais: 'Francia', tipo: 'Internacional' },
    { nombre: 'Tocumen', codigoIata: 'PTY', ciudad: 'Ciudad de Panamá', pais: 'Panamá', tipo: 'Internacional' },
    { nombre: 'Benito Juárez', codigoIata: 'MEX', ciudad: 'Ciudad de México', pais: 'México', tipo: 'Internacional' },
    { nombre: 'Jorge Chávez', codigoIata: 'LIM', ciudad: 'Lima', pais: 'Perú', tipo: 'Internacional' },
    { nombre: 'Dubai', codigoIata: 'DXB', ciudad: 'Dubai', pais: 'Emiratos Árabes Unidos', tipo: 'Internacional' },
    { nombre: 'Estambul', codigoIata: 'IST', ciudad: 'Estambul', pais: 'Turquía', tipo: 'Internacional' },
  ];
  const aeropuertosMap = {};
  for (const a of aeropuertosData) {
    const aeropuerto = await upsertByUnique('aeropuertos', { codigoIata: a.codigoIata }, a);
    aeropuertosMap[a.codigoIata] = aeropuerto;
  }
  console.log('  ✓ Aeropuertos');

  // =========================================================
  // 5. POLÍTICAS DE EQUIPAJE
  // =========================================================

  const equipajeData = [
    { aerolineaId: aerolineasMap['CM'].id, tipoTarifa: 'Basic', articuloPersonal: '1 bolso (43x32x22 cm)', equipajeMano: 'No incluido', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['CM'].id, tipoTarifa: 'Classic / Economy', articuloPersonal: '1 bolso (43x32x22 cm)', equipajeMano: '1 maleta hasta 10kg (56x36x26 cm)', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['CM'].id, tipoTarifa: 'Business', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta hasta 10kg', equipajeBodega: '2 maletas hasta 32kg c/u' },
    { aerolineaId: aerolineasMap['AA'].id, tipoTarifa: 'Basic Economy', articuloPersonal: '1 bolso (45x35x20 cm)', equipajeMano: '1 maleta (56x36x23 cm)', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['AA'].id, tipoTarifa: 'Main Cabin', articuloPersonal: '1 bolso', equipajeMano: '1 maleta de mano', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['IB'].id, tipoTarifa: 'Básica', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta hasta 10kg (56x40x25 cm)', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['IB'].id, tipoTarifa: 'Óptima', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta hasta 10kg', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['DL'].id, tipoTarifa: 'Basic Economy', articuloPersonal: '1 artículo personal', equipajeMano: '1 maleta de mano', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['DL'].id, tipoTarifa: 'Main Cabin', articuloPersonal: '1 artículo personal', equipajeMano: '1 maleta de mano', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['UA'].id, tipoTarifa: 'Basic Economy', articuloPersonal: '1 bolso (43x25x22 cm)', equipajeMano: 'No incluido', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['UA'].id, tipoTarifa: 'Economy', articuloPersonal: '1 bolso', equipajeMano: '1 maleta de mano', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['AF'].id, tipoTarifa: 'Light', articuloPersonal: '1 bolso (40x30x15 cm)', equipajeMano: '1 maleta hasta 12kg (55x35x25 cm)', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['AF'].id, tipoTarifa: 'Standard', articuloPersonal: '1 bolso', equipajeMano: '1 maleta hasta 12kg', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['KL'].id, tipoTarifa: 'Light', articuloPersonal: '1 accesorio pequeño', equipajeMano: '1 maleta (total máx. 12kg)', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['KL'].id, tipoTarifa: 'Standard', articuloPersonal: '1 accesorio pequeño', equipajeMano: '1 maleta de mano', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['B6'].id, tipoTarifa: 'Blue Basic', articuloPersonal: '1 bolso personal (43x33x20 cm)', equipajeMano: '1 maleta de mano', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['B6'].id, tipoTarifa: 'Blue', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta de mano', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['NK'].id, tipoTarifa: 'Standard', articuloPersonal: '1 bolso personal (45x35x20 cm)', equipajeMano: 'No incluido', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['P5'].id, tipoTarifa: 'Go Basic', articuloPersonal: '1 bolso personal (40x30x20 cm)', equipajeMano: 'No incluido', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['P5'].id, tipoTarifa: 'Go Plus', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta de mano hasta 12kg', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['VE'].id, tipoTarifa: 'Económica', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta hasta 5kg', equipajeBodega: '1 maleta hasta 15kg' },
    { aerolineaId: aerolineasMap['9R'].id, tipoTarifa: 'Básica', articuloPersonal: '1 bolso personal', equipajeMano: '1 equipaje hasta 5kg', equipajeBodega: '1 maleta hasta 15kg' },
    { aerolineaId: aerolineasMap['EK'].id, tipoTarifa: 'Economy Special', articuloPersonal: '1 bolso', equipajeMano: '1 pieza hasta 7kg', equipajeBodega: '1 maleta hasta 20kg' },
    { aerolineaId: aerolineasMap['EK'].id, tipoTarifa: 'Economy Flex', articuloPersonal: '1 bolso', equipajeMano: '1 pieza hasta 7kg', equipajeBodega: 'Hasta 30kg' },
    { aerolineaId: aerolineasMap['TK'].id, tipoTarifa: 'EcoFly', articuloPersonal: '1 accesorio personal', equipajeMano: '1 pieza hasta 8kg', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['UX'].id, tipoTarifa: 'Lite', articuloPersonal: '1 accesorio (20x35x30 cm)', equipajeMano: '1 maleta hasta 10kg', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['UX'].id, tipoTarifa: 'Standard', articuloPersonal: '1 accesorio', equipajeMano: '1 maleta hasta 10kg', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['AV'].id, tipoTarifa: 'Basic / XS', articuloPersonal: '1 bolso personal (45x35x20 cm)', equipajeMano: 'No incluido', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['AV'].id, tipoTarifa: 'Classic / M', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta hasta 10kg (55x35x25 cm)', equipajeBodega: '1 maleta hasta 23kg' },
    { aerolineaId: aerolineasMap['LA'].id, tipoTarifa: 'Basic', articuloPersonal: '1 bolso personal (45x35x20 cm)', equipajeMano: 'No incluido', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['LA'].id, tipoTarifa: 'Light', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta hasta 10kg (55x35x25 cm)', equipajeBodega: 'No incluido' },
    { aerolineaId: aerolineasMap['LA'].id, tipoTarifa: 'Plus', articuloPersonal: '1 bolso personal', equipajeMano: '1 maleta hasta 10kg', equipajeBodega: '1 maleta hasta 23kg' },
  ];
  const equipajeMap = {};
  for (const e of equipajeData) {
    const eq = await createIfNotExists(
      'politicasEquipaje',
      { aerolineaId: e.aerolineaId, tipoTarifa: e.tipoTarifa },
      e
    );
    const key = `${e.aerolineaId}-${e.tipoTarifa}`;
    equipajeMap[key] = eq;
  }
  console.log('  ✓ Políticas de equipaje');

  // =========================================================
  // 6. PROVEEDORES
  // =========================================================

  const proveedoresData = [
    { nombre: 'Decameron Hotels', tipo: 'Hotel', emailContacto: 'reservas@decameron.com', telefono: '+5712345678', web: 'https://www.decameron.com' },
    { nombre: 'Dann Carlton', tipo: 'Hotel', emailContacto: 'reservas@danncarlton.com', telefono: '+5723456789', web: 'https://www.danncarlton.com' },
    { nombre: 'Despegar', tipo: 'Proveedor', emailContacto: 'ventas@despegar.com', telefono: '+5734567890', web: 'https://www.despegar.com' },
    { nombre: 'Hotel Estelar', tipo: 'Hotel', emailContacto: 'reservas@hotelestelar.com', telefono: '+5745678901', web: 'https://www.hotelestelar.com' },
    { nombre: 'GHL Hotels', tipo: 'Hotel', emailContacto: 'reservas@ghlhoteles.com', telefono: '+5756789012', web: 'https://www.ghlhoteles.com' },
    { nombre: 'Viajes Falabella', tipo: 'Proveedor', emailContacto: 'ventas@viajesfalabella.com', telefono: '+5767890123', web: 'https://www.viajesfalabella.com' },
  ];
  for (const p of proveedoresData) {
    await createIfNotExists('proveedores', { nombre: p.nombre }, p);
  }
  console.log('  ✓ Proveedores');

  // =========================================================
  // 7. TARJETAS DE AGENCIA
  // =========================================================

  const tarjetasData = [
    { nombre: 'Bancolombia Principal', metodoPagoId: mpTransferencia.id, ultimosCuatro: '1234', status: 'active' },
    { nombre: 'Davivienda Empresarial', metodoPagoId: mpTransferencia.id, ultimosCuatro: '5678', status: 'active' },
    { nombre: 'Visa Corporativa', metodoPagoId: mpTarjetaCredito.id, ultimosCuatro: '9012', status: 'active' },
    { nombre: 'Mastercard Negocios', metodoPagoId: mpTarjetaCredito.id, ultimosCuatro: '3456', status: 'active' },
    { nombre: 'Nequi Empresarial', metodoPagoId: mpTransferencia.id, ultimosCuatro: '7890', status: 'active' },
  ];
  for (const t of tarjetasData) {
    await createIfNotExists('tarjetasAgencia', { nombre: t.nombre }, t);
  }
  console.log('  ✓ Tarjetas de agencia');

  // =========================================================
  // 8. PERSONAS + USUARIOS
  // =========================================================

  const usuariosData = [
    {
      nombres: 'Admin', apellidos: 'iTea', tipoDocumentoId: tipoCC.id, documento: '123456789',
      email: 'admin@itea.com', telefono: '3001234567', birthDate: new Date('1990-01-15'),
      role: 'admin', password: 'Admin123'
    },
    {
      nombres: 'Juan', apellidos: 'Perez', tipoDocumentoId: tipoCC.id, documento: '987654321',
      email: 'juan@itea.com', telefono: '3002345678', birthDate: new Date('1985-06-20'),
      role: 'asesor', password: 'Vendor123'
    },
    {
      nombres: 'Maria', apellidos: 'Garcia', tipoDocumentoId: tipoCE.id, documento: '5555555',
      email: 'maria@itea.com', telefono: '3003456789', birthDate: new Date('1992-03-10'),
      role: 'asesor', password: 'Vendor123'
    },
    {
      nombres: 'Carlos', apellidos: 'Lopez', tipoDocumentoId: tipoPasaporte.id, documento: 'XY789654',
      email: 'carlos@itea.com', telefono: '3004567890', birthDate: new Date('1988-11-25'),
      role: 'asesor', password: 'Vendor123', status: 'inactive'
    },
  ];

  const usuariosMap = {};
  for (const u of usuariosData) {
    const persona = await upsertByUnique(
      'personas',
      { documento: u.documento },
      {
        nombres: u.nombres, apellidos: u.apellidos,
        tipoDocumentoId: u.tipoDocumentoId, documento: u.documento,
        email: u.email, telefono: u.telefono, birthDate: u.birthDate,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.nombres}`,
        status: u.status || 'active'
      }
    );
    const rol = u.role === 'admin' ? rolAdmin : (u.role === 'freelancer' ? rolFreelancer : rolAsesor);
    const usuario = await upsertByUnique(
      'usuarios',
      { email: u.email },
      {
        personaId: persona.id, email: u.email,
        passwordHash: await bcrypt.hash(u.password, SALT),
        rolId: rol.id, status: u.status || 'active'
      }
    );
    usuariosMap[u.email] = usuario;
  }
  console.log('  ✓ Usuarios');

  // =========================================================
  // 9. PERSONAS + CLIENTES
  // =========================================================

  const clientesData = [
    { nombres: 'Ana Maria', apellidos: 'Torres', tipoDocumentoId: tipoCC.id, documento: '12345678', email: 'ana@email.com', telefono: '3001234567', birthDate: new Date('1992-05-15') },
    { nombres: 'Roberto', apellidos: 'Sanchez', tipoDocumentoId: tipoCC.id, documento: '87654321', email: 'roberto@email.com', telefono: '3002345678', birthDate: new Date('1988-08-20') },
    { nombres: 'Laura', apellidos: 'Martinez', tipoDocumentoId: tipoPasaporte.id, documento: 'AB123456', email: 'laura@email.com', telefono: '3003456789', birthDate: new Date('1995-03-10') },
    { nombres: 'Miguel Angel', apellidos: 'Rodriguez', tipoDocumentoId: tipoCC.id, documento: '11223344', email: 'miguel@email.com', telefono: '3004567890', birthDate: new Date('1990-11-25') },
    { nombres: 'Sofia', apellidos: 'Hernandez', tipoDocumentoId: tipoCE.id, documento: 'CE5555555', email: 'sofia@email.com', telefono: '3005678901', birthDate: new Date('1993-07-01') },
    { nombres: 'Diego', apellidos: 'Fernandez', tipoDocumentoId: tipoCC.id, documento: '99887766', email: 'diego@email.com', telefono: '3006789012', birthDate: new Date('1987-04-15') },
    { nombres: 'Carmen', apellidos: 'Lopez', tipoDocumentoId: tipoPasaporte.id, documento: 'PAS-XY789654', email: 'carmen@email.com', telefono: '3007890123', birthDate: new Date('1991-12-01') },
    { nombres: 'Jose Manuel', apellidos: 'Gil', tipoDocumentoId: tipoCC.id, documento: '44556677', email: 'jose@email.com', telefono: '3008901234', birthDate: new Date('1989-09-20') },
    { nombres: 'Isabella', apellidos: 'Diaz', tipoDocumentoId: tipoCC.id, documento: '66778899', email: 'isabella@email.com', telefono: '3009012345', birthDate: new Date('1994-06-05') },
    { nombres: 'Fernando', apellidos: 'Morales', tipoDocumentoId: tipoCE.id, documento: '1234888', email: 'fernando@email.com', telefono: '3010123456', birthDate: new Date('1986-06-18') },
    { nombres: 'Patricia', apellidos: 'Ruiz', tipoDocumentoId: tipoPasaporte.id, documento: 'ZZ555555', email: 'patricia@email.com', telefono: '3011234567', birthDate: new Date('1997-07-01') },
    { nombres: 'Alejandro', apellidos: 'Castro', tipoDocumentoId: tipoCC.id, documento: '33445566', email: 'alejandro@email.com', telefono: '3012345678', birthDate: new Date('1991-07-15') },
    { nombres: 'Carlos Eduardo', apellidos: 'Gomez', tipoDocumentoId: tipoCC.id, documento: '10101010', email: 'carlos.gomez@email.com', telefono: '3000000001', birthDate: new Date('1990-01-01') },
    { nombres: 'Maria Fernanda', apellidos: 'Lopez', tipoDocumentoId: tipoCC.id, documento: '20202020', email: 'maria.lopez@email.com', telefono: '3000000002', birthDate: new Date('1990-02-02') },
    { nombres: 'Pedro Antonio', apellidos: 'Ruiz', tipoDocumentoId: tipoCC.id, documento: '30303030', email: 'pedro.ruiz@email.com', telefono: '3000000003', birthDate: new Date('1990-03-03') },
    { nombres: 'Lucia Daniela', apellidos: 'Peña', tipoDocumentoId: tipoCC.id, documento: '40404040', email: 'lucia.pena@email.com', telefono: '3000000004', birthDate: new Date('1990-04-04') },
    { nombres: 'Andres Felipe', apellidos: 'Castro', tipoDocumentoId: tipoCC.id, documento: '50505050', email: 'andres.castro@email.com', telefono: '3000000005', birthDate: new Date('1990-05-05') },
  ];
  const clientesMap = {};
  for (const c of clientesData) {
    const persona = await upsertByUnique(
      'personas',
      { documento: c.documento },
      {
        nombres: c.nombres, apellidos: c.apellidos,
        tipoDocumentoId: c.tipoDocumentoId, documento: c.documento,
        email: c.email, telefono: c.telefono, birthDate: c.birthDate,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.nombres.split(' ')[0]}`
      }
    );
    const cliente = await upsertByUnique(
      'clientes',
      { personaId: persona.id },
      { personaId: persona.id, creadoPorId: usuariosMap['admin@itea.com'].id }
    );
    clientesMap[`${c.nombres} ${c.apellidos}`] = cliente;
  }
  console.log('  ✓ Clientes');

  // =========================================================
  // 10. COMISIONISTAS
  // =========================================================

  const comisionistasData = [
    { nombres: 'Agencia', apellidos: 'Viajes Plus', tipoDocumentoId: tipoNIT.id, documento: '900123456', tipo: 'Agencia Externa' },
    { nombres: 'Asesor', apellidos: 'Independiente', tipoDocumentoId: tipoCC.id, documento: '111111111', tipo: 'Comisionista' },
    { nombres: 'Global Travel', apellidos: 'Solutions', tipoDocumentoId: tipoNIT.id, documento: '900789012', tipo: 'Empresa' },
    { nombres: 'Beatriz', apellidos: 'Herrera', tipoDocumentoId: tipoCC.id, documento: '222222222', tipo: 'Comisionista' },
  ];
  const comisionistasMap = {};
  for (const c of comisionistasData) {
    const persona = await upsertByUnique(
      'personas',
      { documento: c.documento },
      {
        nombres: c.nombres, apellidos: c.apellidos,
        tipoDocumentoId: c.tipoDocumentoId, documento: c.documento
      }
    );
    const comisionista = await upsertByUnique(
      'comisionistas',
      { personaId: persona.id },
      { personaId: persona.id, tipo: c.tipo, umbralPago: 500000, acumulado: 0, status: 'Activo' }
    );
    comisionistasMap[c.documento] = comisionista;
  }
  console.log('  ✓ Comisionistas');

  // =========================================================
  // 11. PAQUETES TURÍSTICOS
  // =========================================================

  const paquetesData = [
    {
      nombre: 'San Andrés All Inclusive', destino: 'San Andrés', status: 'activo',
      serviciosIncluidos: 'Vuelo ida y vuelta, Hotel 5 estrellas, Alimentación completa, Tour Acuario, Tour Jhonny Cay, Seguro de viaje',
      noIncluido: 'Gastos personales, Compras, Excursiones adicionales',
      hotelNombre: 'Decameron San Andrés', tipoHotel: 'resort', regimen: 'todo_incluido', noches: 4,
      aerolineaIata: 'AV', nroVuelo: 'AV204', modoVuelo: 'round_trip',
      tarifaAdulto: 2500000, tarifaMenor: 1800000,
      coberturaUsd: 50000, diasCobertura: 7
    },
    {
      nombre: 'Cartagena Boutique', destino: 'Cartagena', status: 'activo',
      serviciosIncluidos: 'Vuelo ida y vuelta, Hotel Boutique, Desayunos, City Tour, Tour Castillo San Felipe',
      noIncluido: 'Almuerzos y cenas, Gastos personales, Propinas',
      hotelNombre: 'Dann Carlton Cartagena', tipoHotel: 'boutique', regimen: 'solo_desayuno', noches: 3,
      aerolineaIata: 'LA', nroVuelo: 'LA123', modoVuelo: 'round_trip',
      tarifaAdulto: 1800000, tarifaMenor: 1300000,
      coberturaUsd: 30000, diasCobertura: 5
    },
    {
      nombre: 'Medellín Aventura', destino: 'Medellín', status: 'activo',
      serviciosIncluidos: 'Vuelo ida y vuelta, Hotel, Tour Comuna 13, Tour Guatapé, Seguro de viaje',
      noIncluido: 'Alimentación, Gastos personales',
      hotelNombre: 'Hotel Estelar', tipoHotel: 'hotel', regimen: 'sin_alimentacion', noches: 3,
      aerolineaIata: 'AV', nroVuelo: 'AV412', modoVuelo: 'round_trip',
      tarifaAdulto: 1200000, tarifaMenor: 900000,
      coberturaUsd: 25000, diasCobertura: 4
    },
  ];

  for (const p of paquetesData) {
    const paquete = await createIfNotExists(
      'paquetes',
      { nombre: p.nombre, destino: p.destino },
      {
        nombre: p.nombre, destino: p.destino, status: p.status,
        serviciosIncluidos: p.serviciosIncluidos, noIncluido: p.noIncluido,
        creadoPorId: usuariosMap['admin@itea.com'].id
      }
    );
    // Solo crear relaciones si el paquete es nuevo (no existía)
    const existingVuelo = await prisma.paqueteVuelo.findFirst({ where: { paqueteId: paquete.id } });
    if (!existingVuelo) {
      await prisma.paqueteVuelo.create({
        data: {
          paqueteId: paquete.id, aerolineaId: aerolineasMap[p.aerolineaIata].id,
          nroVuelo: p.nroVuelo, modoVuelo: p.modoVuelo
        }
      });
    }

    const existingHotel = await prisma.paqueteHotel.findFirst({ where: { paqueteId: paquete.id } });
    if (!existingHotel) {
      await prisma.paqueteHotel.create({
        data: {
          paqueteId: paquete.id, hotelNombre: p.hotelNombre,
          tipoHotel: p.tipoHotel, regimen: p.regimen, noches: p.noches
        }
      });
    }

    const existingTarifa = await prisma.paqueteTarifas.findFirst({ where: { paqueteId: paquete.id } });
    if (!existingTarifa) {
      await prisma.paqueteTarifas.create({
        data: {
          paqueteId: paquete.id, tarifaAdulto: p.tarifaAdulto, tarifaMenor: p.tarifaMenor
        }
      });
    }

    const existingAsistencia = await prisma.paqueteAsistenciaMedica.findFirst({ where: { paqueteId: paquete.id } });
    if (!existingAsistencia) {
      await prisma.paqueteAsistenciaMedica.create({
        data: {
          paqueteId: paquete.id, coberturaUsd: p.coberturaUsd, diasCobertura: p.diasCobertura
        }
      });
    }
  }
  console.log('  ✓ Paquetes turísticos');

  // =========================================================
  // 12. VENTAS DE EJEMPLO
  // =========================================================

  const adminUser = usuariosMap['admin@itea.com'];
  const juanUser = usuariosMap['juan@itea.com'];
  const mariaUser = usuariosMap['maria@itea.com'];
  const clientes = await prisma.clientes.findMany({ include: { persona: true } });
  const getCliente = (index) => clientes[index % clientes.length];

  const allProveedores = await prisma.proveedores.findMany();

  const ventasEjemplo = [
    {
      clienteIndex: 0, asesorId: adminUser.id, montoTotal: 2500000, status: 'pagado',
      metodoPagoId: mpTarjetaCredito.id, comisionistaDoc: '900123456',
      montoComisionBruto: 150000, porcentajeRetencion: 0, montoComisionNeto: 150000,
      costoProveedor: 2100000, observaciones: 'Reserva de hotel en Santa Marta\n- 4 noches, 3 días\n- Incluye desayunos\n- Habitación con vista al mar.',
      categoria: 'hoteleria', hotelNombre: 'Decameron Santa Marta', destino: 'Santa Marta',
      fechaInicio: new Date('2026-05-01'), fechaFin: new Date('2026-05-04')
    },
    {
      clienteIndex: 1, asesorId: juanUser.id, montoTotal: 800000, status: 'credito',
      metodoPagoId: mpTransferencia.id, comisionistaDoc: '111111111',
      montoComisionBruto: 20000, porcentajeRetencion: 0, montoComisionNeto: 20000,
      costoProveedor: 730000, observaciones: 'Vuelo redondo Bogotá - Medellín\n- Ida: 10AM (Avianca)\n- Regreso: 6PM (Avianca)\n- Equipaje de mano de 10kg.',
      categoria: 'tiqueteria',
      esCredito: true, fechaVenceCredito: new Date('2026-06-15')
    },
    {
      clienteIndex: 2, asesorId: adminUser.id, montoTotal: 4500000, status: 'abonado',
      metodoPagoId: mpEfectivo.id, comisionistaDoc: '222222222',
      montoComisionBruto: 300000, porcentajeRetencion: 0, montoComisionNeto: 300000,
      costoProveedor: 3700000, observaciones: 'Paquete turístico a San Andrés (Vuelo + Hotel + Tours)\n- 5 Días / 4 Noches\n- Vuelo directo\n- Hotel All Inclusive\n- Tour Acuario y Jhonny Cay.',
      categoria: 'planes',
      esCredito: true, fechaVenceCredito: new Date('2026-07-15'), montoPagadoCredito: 2000000
    },
    {
      clienteIndex: 3, asesorId: mariaUser.id, montoTotal: 1200000, status: 'pagado',
      metodoPagoId: mpPSE.id, comisionistaDoc: '900789012',
      montoComisionBruto: 85000, porcentajeRetencion: 0, montoComisionNeto: 85000,
      costoProveedor: 950000, observaciones: 'Seguro de viaje internacional cobertura 100k USD.',
      categoria: 'seguros_viaje'
    },
  ];

  for (const v of ventasEjemplo) {
    const cliente = getCliente(v.clienteIndex);
    const comisionista = comisionistasMap[v.comisionistaDoc];

    const venta = await createIfNotExists(
      'ventas',
      {
        clienteId: cliente.id,
        usuarioId: v.asesorId,
        montoTotal: v.montoTotal,
        status: v.status
      },
      {
        clienteId: cliente.id,
        usuarioId: v.asesorId,
        montoTotal: v.montoTotal,
        costoProveedorTotal: v.costoProveedor || 0,
        taTotal: v.montoTotal - (v.costoProveedor || 0),
        comisionistaId: comisionista?.id,
        montoComisionBruto: v.montoComisionBruto,
        porcentajeRetencionComision: v.porcentajeRetencion,
        montoComisionNeto: v.montoComisionNeto,
        metodoPagoPrincipalId: v.metodoPagoId,
        status: v.status,
        esCredito: v.esCredito || false,
        fechaVenceCredito: v.fechaVenceCredito || null,
        montoPagadoCredito: v.montoPagadoCredito || 0,
        observaciones: v.observaciones || ''
      }
    );

    const existingDetalle = await prisma.detalleVenta.findFirst({ where: { ventaId: venta.id } });
    if (!existingDetalle) {
      const detalle = await prisma.detalleVenta.create({
        data: {
          ventaId: venta.id,
          categoria: v.categoria,
          nombreServicio: v.hotelNombre || `Servicio de ${v.categoria}`,
          subtotal: v.costoProveedor,
          ta: v.montoTotal - v.costoProveedor,
          costoProveedor: v.costoProveedor || 0,
          proveedorId: allProveedores[0]?.id,
          fechaInicioViaje: v.fechaInicio,
          fechaFinViaje: v.fechaFin,
          origen: v.categoria === 'tiqueteria' ? 'Bogotá' : null,
          destino: v.destino || null
        }
      });

      switch (v.categoria) {
        case 'hoteleria':
          await prisma.prodHoteleria.create({
            data: {
              detalleVentaId: detalle.id,
              hotelNombre: v.hotelNombre,
              destino: v.destino,
              tipoHotel: 'hotel',
              fechaEntrada: v.fechaInicio,
              fechaSalida: v.fechaFin
            }
          });
          break;
        case 'tiqueteria': {
          const prodTicket = await prisma.prodTiqueteria.create({
            data: {
              detalleVentaId: detalle.id,
              aerolineaId: aerolineasMap['AV'].id,
              nroReserva: `RES-${venta.id}`,
              nroVuelo: `AV${100 + venta.id}`,
              modoVuelo: 'round_trip',
              planEquipajeId: equipajeMap[`${aerolineasMap['AV'].id}-Económica`]?.id
            }
          });
          await prisma.tramosVuelo.create({
            data: {
              prodTiqueteriaId: prodTicket.id,
              aeropuertoOrigenId: aeropuertosMap['BOG'].id,
              aeropuertoDestinoId: aeropuertosMap['MDE'].id,
              salida: new Date('2026-05-15T10:00:00'),
              llegada: new Date('2026-05-15T11:00:00'),
              nroVueloTramo: `AV${100 + venta.id}`,
              orden: 1
            }
          });
          break;
        }
        case 'planes':
          await prisma.prodPlanes.create({
            data: {
              detalleVentaId: detalle.id,
              nombrePlan: 'Plan San Andrés',
              aerolineaId: aerolineasMap['AV'].id,
              adultosCount: 2, menoresCount: 0,
              fechaViajeInicio: new Date('2026-06-01'),
              fechaViajeFin: new Date('2026-06-05')
            }
          });
          break;
        case 'seguros_viaje':
          await prisma.prodSeguros.create({
            data: {
              detalleVentaId: detalle.id,
              tipoSeguro: 'todo_riesgo',
              coberturaUsd: 100000,
              diasCobertura: 15,
              contactoEmergencia: 'Contacto de emergencia',
              telefonoEmergencia: '3000000000'
            }
          });
          break;
      }
    }
  }
  console.log('  ✓ Ventas de ejemplo');

  // =========================================================
  // 13. VENTAS MENSUALES (historial para stats)
  // =========================================================

  const seasonality = {
    1: 2.2, 2: 0.7, 3: 1.1, 4: 0.65, 5: 0.7, 6: 1.3,
    7: 2.5, 8: 2.3, 9: 0.8, 10: 0.9, 11: 1.2, 12: 2.8
  };
  const baseRevenue = 8500000;
  const years = [2025, 2026];

  for (const year of years) {
    for (let month = 1; month <= 12; month++) {
      const factor = seasonality[month] * (year === 2026 ? 1.2 : 1);
      const variance = 0.85 + Math.random() * 0.3;
      const total = Math.round(baseRevenue * factor * variance);
      const count = Math.round(8 * factor * variance);
      const hotelShare = 0.32, flightShare = 0.28, packageShare = 0.22, insuranceShare = 0.1, transferShare = 0.08;

      await upsertByUniqueWithData(
        'ventasMensuales',
        { year_month: { year, month } },
        {
          year, month, total, count,
          hoteles: Math.round(total * hotelShare),
          vuelos: Math.round(total * flightShare),
          paquetes: Math.round(total * packageShare),
          seguros: Math.round(total * insuranceShare),
          transferencias: Math.round(total * transferShare)
        }
      );
    }
  }
  console.log('  ✓ Ventas mensuales (historial)');

  console.log('\n✅ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
