const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// Ã¢â€â‚¬Ã¢â€â‚¬ Helpers idempotentes Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  console.log('Ã°Å¸Å’Â± Iniciando seed...');
  const SALT = await bcrypt.genSalt(SALT_ROUNDS);

  // =========================================================
  // 1. CATÃƒÂLOGOS BASE
  // =========================================================

  const tipoCC   = await upsertByUnique('tipos_documento', { abreviatura: 'CC' }, { nombre: 'CÃƒÂ©dula de CiudadanÃƒÂ­a', abreviatura: 'CC' });
  const tipoCE   = await upsertByUnique('tipos_documento', { abreviatura: 'CE' }, { nombre: 'CÃƒÂ©dula de ExtranjerÃƒÂ­a', abreviatura: 'CE' });
  const tipoPasaporte = await upsertByUnique('tipos_documento', { abreviatura: 'Pasaporte' }, { nombre: 'Pasaporte', abreviatura: 'Pasaporte' });
  const tipoNIT  = await upsertByUnique('tipos_documento', { abreviatura: 'NIT' }, { nombre: 'NIT', abreviatura: 'NIT' });
  console.log('  Ã¢Å“â€œ Tipos de documento');

  const mpEfectivo       = await upsertByUnique('metodos_pago', { nombre: 'Efectivo' }, { nombre: 'Efectivo' });
  const mpTransferencia  = await upsertByUnique('metodos_pago', { nombre: 'Transferencia' }, { nombre: 'Transferencia' });
  const mpTarjetaCredito = await upsertByUnique('metodos_pago', { nombre: 'Tarjeta de CrÃƒÂ©dito' }, { nombre: 'Tarjeta de CrÃƒÂ©dito' });
  const mpTarjetaDebito  = await upsertByUnique('metodos_pago', { nombre: 'Tarjeta DÃƒÂ©bito' }, { nombre: 'Tarjeta DÃƒÂ©bito' });
  const mpPSE            = await upsertByUnique('metodos_pago', { nombre: 'PSE' }, { nombre: 'PSE' });
  const mpConsignacion   = await upsertByUnique('metodos_pago', { nombre: 'ConsignaciÃƒÂ³n' }, { nombre: 'ConsignaciÃƒÂ³n' });
  console.log('  Ã¢Å“â€œ MÃƒÂ©todos de pago');

  const rolAdmin      = await upsertByUnique('roles', { nombre: 'admin' }, { nombre: 'admin', descripcion: 'Administrador del sistema' });
  const rolAsesor     = await upsertByUnique('roles', { nombre: 'asesor' }, { nombre: 'asesor', descripcion: 'Asesor de ventas' });
  const rolFreelancer = await upsertByUnique('roles', { nombre: 'freelancer' }, { nombre: 'freelancer', descripcion: 'Vendedor independiente' });
  console.log('  Ã¢Å“â€œ Roles');

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
  console.log('  Ã¢Å“â€œ Permisos');

  // Asignar todos los permisos a admin
  for (const permiso of permisosCreados) {
    await upsertByUnique('permisos_rol', { rol_id_permiso_id: { rol_id: rolAdmin.id, permiso_id: permiso.id } }, { rol_id: rolAdmin.id, permiso_id: permiso.id });
  }
  console.log('  Ã¢Å“â€œ Permisos admin');

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
        await upsertByUnique('permisos_rol', { rol_id_permiso_id: { rol_id: rolAsesor.id, permiso_id: p.id } }, { rol_id: rolAsesor.id, permiso_id: p.id });
      }
    }
  }
  console.log('  Ã¢Å“â€œ Permisos asesor');

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
        await upsertByUnique('permisos_rol', { rol_id_permiso_id: { rol_id: rolFreelancer.id, permiso_id: p.id } }, { rol_id: rolFreelancer.id, permiso_id: p.id });
      }
    }
  }
  console.log('  Ã¢Å“â€œ Permisos freelancer');

  // =========================================================
  // 3. AEROLÃƒÂNEAS
  // =========================================================

  const aerolineasData = [
    { nombre: 'Avianca', codigo_iata: 'AV', tipo: 'Nacional', web: 'https://www.avianca.com' },
    { nombre: 'LATAM', codigo_iata: 'LA', tipo: 'Internacional', web: 'https://www.latam.com' },
    { nombre: 'Copa Airlines', codigo_iata: 'CM', tipo: 'Internacional', web: 'https://www.copaair.com' },
    { nombre: 'American Airlines', codigo_iata: 'AA', tipo: 'Internacional', web: 'https://www.aa.com' },
    { nombre: 'Iberia', codigo_iata: 'IB', tipo: 'Internacional', web: 'https://www.iberia.com' },
    { nombre: 'Delta', codigo_iata: 'DL', tipo: 'Internacional', web: 'https://www.delta.com' },
    { nombre: 'United Airlines', codigo_iata: 'UA', tipo: 'Internacional', web: 'https://www.united.com' },
    { nombre: 'Air France', codigo_iata: 'AF', tipo: 'Internacional', web: 'https://www.airfrance.com' },
    { nombre: 'KLM', codigo_iata: 'KL', tipo: 'Internacional', web: 'https://www.klm.com' },
    { nombre: 'JetBlue', codigo_iata: 'B6', tipo: 'Internacional', web: 'https://www.jetblue.com' },
    { nombre: 'Spirit Airlines', codigo_iata: 'NK', tipo: 'Internacional', web: 'https://www.spirit.com' },
    { nombre: 'Wingo', codigo_iata: 'P5', tipo: 'Nacional', web: 'https://www.wingo.com' },
    { nombre: 'EasyFly', codigo_iata: 'VE', tipo: 'Nacional', web: 'https://www.easyfly.com.co' },
    { nombre: 'Satena', codigo_iata: '9R', tipo: 'Nacional', web: 'https://www.satena.com' },
    { nombre: 'Viva Air', codigo_iata: 'VH', tipo: 'Nacional', web: null },
    { nombre: 'Emirates', codigo_iata: 'EK', tipo: 'Internacional', web: 'https://www.emirates.com' },
    { nombre: 'Turkish Airlines', codigo_iata: 'TK', tipo: 'Internacional', web: 'https://www.turkishairlines.com' },
    { nombre: 'Air Europa', codigo_iata: 'UX', tipo: 'Internacional', web: 'https://www.aireuropa.com' },
  ];
  const aerolineasMap = {};
  for (const a of aerolineasData) {
    const aerolinea = await upsertByUnique('aerolineas', { codigo_iata: a.codigo_iata }, a);
    aerolineasMap[a.codigo_iata] = aerolinea;
  }
  console.log('  Ã¢Å“â€œ AerolÃƒÂ­neas');

  // =========================================================
  // 4. AEROPUERTOS
  // =========================================================

  const aeropuertosData = [
    { nombre: 'El Dorado', codigo_iata: 'BOG', ciudad: 'BogotÃƒÂ¡', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'JosÃƒÂ© MarÃƒÂ­a CÃƒÂ³rdova', codigo_iata: 'MDE', ciudad: 'MedellÃƒÂ­n', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Olaya Herrera', codigo_iata: 'EOH', ciudad: 'MedellÃƒÂ­n', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Rafael NÃƒÂºÃƒÂ±ez', codigo_iata: 'CTG', ciudad: 'Cartagena', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Alfonso Bonilla AragÃƒÂ³n', codigo_iata: 'CLO', ciudad: 'Cali', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Gustavo Rojas Pinilla', codigo_iata: 'ADZ', ciudad: 'San AndrÃƒÂ©s', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Ernesto Cortissoz', codigo_iata: 'BAQ', ciudad: 'Barranquilla', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'MatecaÃƒÂ±a', codigo_iata: 'PEI', ciudad: 'Pereira', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Palonegro', codigo_iata: 'BGA', ciudad: 'Bucaramanga', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'SimÃƒÂ³n BolÃƒÂ­var', codigo_iata: 'SMR', ciudad: 'Santa Marta', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El EdÃƒÂ©n', codigo_iata: 'AXM', ciudad: 'Armenia', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'La Nubia', codigo_iata: 'MZL', ciudad: 'Manizales', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Camilo Daza', codigo_iata: 'CUC', ciudad: 'CÃƒÂºcuta', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Almirante Padilla', codigo_iata: 'RCH', ciudad: 'Riohacha', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Alfonso LÃƒÂ³pez Pumarejo', codigo_iata: 'VUP', ciudad: 'Valledupar', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Los Garzones', codigo_iata: 'MTR', ciudad: 'MonterÃƒÂ­a', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Antonio RoldÃƒÂ¡n Betancourt', codigo_iata: 'APO', ciudad: 'ApartadÃƒÂ³', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Las Brujas', codigo_iata: 'CZU', ciudad: 'Sincelejo', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Perales', codigo_iata: 'IBE', ciudad: 'IbaguÃƒÂ©', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Benito Salas', codigo_iata: 'NVA', ciudad: 'Neiva', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Guillermo LeÃƒÂ³n Valencia', codigo_iata: 'PPN', ciudad: 'PopayÃƒÂ¡n', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'San Luis', codigo_iata: 'IPI', ciudad: 'Ipiales', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Antonio NariÃƒÂ±o', codigo_iata: 'PSO', ciudad: 'Pasto', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Vanguardia', codigo_iata: 'VVC', ciudad: 'Villavicencio', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El AlcaravÃƒÂ¡n', codigo_iata: 'EYP', ciudad: 'Yopal', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Santiago PÃƒÂ©rez Quiroz', codigo_iata: 'AUC', ciudad: 'Arauca', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El CaraÃƒÂ±o', codigo_iata: 'UIB', ciudad: 'QuibdÃƒÂ³', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'YariguÃƒÂ­es', codigo_iata: 'EJA', ciudad: 'Barrancabermeja', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Reyes Murillo', codigo_iata: 'NQU', ciudad: 'NuquÃƒÂ­', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'JosÃƒÂ© Celestino Mutis', codigo_iata: 'BSC', ciudad: 'BahÃƒÂ­a Solano', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'GermÃƒÂ¡n Olano', codigo_iata: 'PCR', ciudad: 'Puerto CarreÃƒÂ±o', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Fabio Alberto LeÃƒÂ³n Bentley', codigo_iata: 'MVP', ciudad: 'MitÃƒÂº', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Jorge Enrique GonzÃƒÂ¡lez', codigo_iata: 'SJE', ciudad: 'San JosÃƒÂ© del Guaviare', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Tres de Mayo', codigo_iata: 'PUU', ciudad: 'Puerto AsÃƒÂ­s', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Alfredo VÃƒÂ¡squez Cobo', codigo_iata: 'LET', ciudad: 'Leticia', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Golfo de Morrosquillo', codigo_iata: 'TLU', ciudad: 'TolÃƒÂº', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Gerardo Tobar LÃƒÂ³pez', codigo_iata: 'BUN', ciudad: 'Buenaventura', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'San Bernardo', codigo_iata: 'MMP', ciudad: 'Mompox', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Cacique Aramare', codigo_iata: 'PDA', ciudad: 'Puerto InÃƒÂ­rida', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'La Florida', codigo_iata: 'TCO', ciudad: 'Tumaco', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Eduardo Falla Solano', codigo_iata: 'SVI', ciudad: 'San Vicente del CaguÃƒÂ¡n', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Gustavo Artunduaga', codigo_iata: 'FLA', ciudad: 'Florencia', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Contador', codigo_iata: 'PTX', ciudad: 'Pitalito', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Mandinga', codigo_iata: 'COG', ciudad: 'Condoto', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'CapurganÃƒÂ¡', codigo_iata: 'CPB', ciudad: 'CapurganÃƒÂ¡', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Alcides FernÃƒÂ¡ndez', codigo_iata: 'ACD', ciudad: 'AcandÃƒÂ­', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Jorge Isaacs', codigo_iata: 'MCJ', ciudad: 'Maicao', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Los Colonizadores', codigo_iata: 'RVE', ciudad: 'Saravena', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Miami', codigo_iata: 'MIA', ciudad: 'Miami', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'John F. Kennedy', codigo_iata: 'JFK', ciudad: 'New York', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'Adolfo SuÃƒÂ¡rez Madrid-Barajas', codigo_iata: 'MAD', ciudad: 'Madrid', pais: 'EspaÃƒÂ±a', tipo: 'Internacional' },
    { nombre: 'Charles de Gaulle', codigo_iata: 'CDG', ciudad: 'ParÃƒÂ­s', pais: 'Francia', tipo: 'Internacional' },
    { nombre: 'Tocumen', codigo_iata: 'PTY', ciudad: 'Ciudad de PanamÃƒÂ¡', pais: 'PanamÃƒÂ¡', tipo: 'Internacional' },
    { nombre: 'Benito JuÃƒÂ¡rez', codigo_iata: 'MEX', ciudad: 'Ciudad de MÃƒÂ©xico', pais: 'MÃƒÂ©xico', tipo: 'Internacional' },
    { nombre: 'Jorge ChÃƒÂ¡vez', codigo_iata: 'LIM', ciudad: 'Lima', pais: 'PerÃƒÂº', tipo: 'Internacional' },
    { nombre: 'Dubai', codigo_iata: 'DXB', ciudad: 'Dubai', pais: 'Emiratos ÃƒÂrabes Unidos', tipo: 'Internacional' },
    { nombre: 'Estambul', codigo_iata: 'IST', ciudad: 'Estambul', pais: 'TurquÃƒÂ­a', tipo: 'Internacional' },
  ];
  const aeropuertosMap = {};
  for (const a of aeropuertosData) {
    const aeropuerto = await upsertByUnique('aeropuertos', { codigo_iata: a.codigo_iata }, a);
    aeropuertosMap[a.codigo_iata] = aeropuerto;
  }
  console.log('  Ã¢Å“â€œ Aeropuertos');

  // =========================================================
  // 5. POLÃƒÂTICAS DE EQUIPAJE
  // =========================================================

  const equipajeData = [
    { aerolinea_id: aerolineasMap['CM'].id, tipo_tarifa: 'Basic', articulo_personal: '1 bolso (43x32x22 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['CM'].id, tipo_tarifa: 'Classic / Economy', articulo_personal: '1 bolso (43x32x22 cm)', equipaje_mano: '1 maleta hasta 10kg (56x36x26 cm)', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['CM'].id, tipo_tarifa: 'Business', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: '2 maletas hasta 32kg c/u' },
    { aerolinea_id: aerolineasMap['AA'].id, tipo_tarifa: 'Basic Economy', articulo_personal: '1 bolso (45x35x20 cm)', equipaje_mano: '1 maleta (56x36x23 cm)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['AA'].id, tipo_tarifa: 'Main Cabin', articulo_personal: '1 bolso', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['IB'].id, tipo_tarifa: 'BÃƒÂ¡sica', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg (56x40x25 cm)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['IB'].id, tipo_tarifa: 'Ãƒâ€œptima', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['DL'].id, tipo_tarifa: 'Basic Economy', articulo_personal: '1 artÃƒÂ­culo personal', equipaje_mano: '1 maleta de mano', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['DL'].id, tipo_tarifa: 'Main Cabin', articulo_personal: '1 artÃƒÂ­culo personal', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['UA'].id, tipo_tarifa: 'Basic Economy', articulo_personal: '1 bolso (43x25x22 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['UA'].id, tipo_tarifa: 'Economy', articulo_personal: '1 bolso', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['AF'].id, tipo_tarifa: 'Light', articulo_personal: '1 bolso (40x30x15 cm)', equipaje_mano: '1 maleta hasta 12kg (55x35x25 cm)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['AF'].id, tipo_tarifa: 'Standard', articulo_personal: '1 bolso', equipaje_mano: '1 maleta hasta 12kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['KL'].id, tipo_tarifa: 'Light', articulo_personal: '1 accesorio pequeÃƒÂ±o', equipaje_mano: '1 maleta (total mÃƒÂ¡x. 12kg)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['KL'].id, tipo_tarifa: 'Standard', articulo_personal: '1 accesorio pequeÃƒÂ±o', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['B6'].id, tipo_tarifa: 'Blue Basic', articulo_personal: '1 bolso personal (43x33x20 cm)', equipaje_mano: '1 maleta de mano', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['B6'].id, tipo_tarifa: 'Blue', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta de mano', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['NK'].id, tipo_tarifa: 'Standard', articulo_personal: '1 bolso personal (45x35x20 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['P5'].id, tipo_tarifa: 'Go Basic', articulo_personal: '1 bolso personal (40x30x20 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['P5'].id, tipo_tarifa: 'Go Plus', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta de mano hasta 12kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['VE'].id, tipo_tarifa: 'EconÃƒÂ³mica', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 5kg', equipaje_bodega: '1 maleta hasta 15kg' },
    { aerolinea_id: aerolineasMap['9R'].id, tipo_tarifa: 'BÃƒÂ¡sica', articulo_personal: '1 bolso personal', equipaje_mano: '1 equipaje hasta 5kg', equipaje_bodega: '1 maleta hasta 15kg' },
    { aerolinea_id: aerolineasMap['EK'].id, tipo_tarifa: 'Economy Special', articulo_personal: '1 bolso', equipaje_mano: '1 pieza hasta 7kg', equipaje_bodega: '1 maleta hasta 20kg' },
    { aerolinea_id: aerolineasMap['EK'].id, tipo_tarifa: 'Economy Flex', articulo_personal: '1 bolso', equipaje_mano: '1 pieza hasta 7kg', equipaje_bodega: 'Hasta 30kg' },
    { aerolinea_id: aerolineasMap['TK'].id, tipo_tarifa: 'EcoFly', articulo_personal: '1 accesorio personal', equipaje_mano: '1 pieza hasta 8kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['UX'].id, tipo_tarifa: 'Lite', articulo_personal: '1 accesorio (20x35x30 cm)', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['UX'].id, tipo_tarifa: 'Standard', articulo_personal: '1 accesorio', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['AV'].id, tipo_tarifa: 'Basic / XS', articulo_personal: '1 bolso personal (45x35x20 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['AV'].id, tipo_tarifa: 'Classic / M', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg (55x35x25 cm)', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['LA'].id, tipo_tarifa: 'Basic', articulo_personal: '1 bolso personal (45x35x20 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['LA'].id, tipo_tarifa: 'Light', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg (55x35x25 cm)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['LA'].id, tipo_tarifa: 'Plus', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: '1 maleta hasta 23kg' },
  ];
  const equipajeMap = {};
  for (const e of equipajeData) {
    const eq = await createIfNotExists(
      'politicas_equipaje',
      { aerolinea_id: e.aerolineaId, tipo_tarifa: e.tipo_tarifa },
      e
    );
    const key = `${e.aerolineaId}-${e.tipoTarifa}`;
    equipajeMap[key] = eq;
  }
  console.log('  Ã¢Å“â€œ PolÃƒÂ­ticas de equipaje');

  // =========================================================
  // 6. PROVEEDORES
  // =========================================================

  const proveedoresData = [
    { nombre: 'Decameron Hotels', tipo: 'Hotel', email_contacto: 'reservas@decameron.com', telefono: '+5712345678', web: 'https://www.decameron.com' },
    { nombre: 'Dann Carlton', tipo: 'Hotel', email_contacto: 'reservas@danncarlton.com', telefono: '+5723456789', web: 'https://www.danncarlton.com' },
    { nombre: 'Despegar', tipo: 'Proveedor', email_contacto: 'ventas@despegar.com', telefono: '+5734567890', web: 'https://www.despegar.com' },
    { nombre: 'Hotel Estelar', tipo: 'Hotel', email_contacto: 'reservas@hotelestelar.com', telefono: '+5745678901', web: 'https://www.hotelestelar.com' },
    { nombre: 'GHL Hotels', tipo: 'Hotel', email_contacto: 'reservas@ghlhoteles.com', telefono: '+5756789012', web: 'https://www.ghlhoteles.com' },
    { nombre: 'Viajes Falabella', tipo: 'Proveedor', email_contacto: 'ventas@viajesfalabella.com', telefono: '+5767890123', web: 'https://www.viajesfalabella.com' },
  ];
  for (const p of proveedoresData) {
    await createIfNotExists('proveedores', { nombre: p.nombre }, p);
  }
  console.log('  Ã¢Å“â€œ Proveedores');

  // =========================================================
  // 7. TARJETAS DE AGENCIA
  // =========================================================

  const tarjetasData = [
    { nombre: 'Bancolombia Principal', metodo_pago_id: mpTransferencia.id, ultimos_cuatro: '1234', status: 'active' },
    { nombre: 'Davivienda Empresarial', metodo_pago_id: mpTransferencia.id, ultimos_cuatro: '5678', status: 'active' },
    { nombre: 'Visa Corporativa', metodo_pago_id: mpTarjetaCredito.id, ultimos_cuatro: '9012', status: 'active' },
    { nombre: 'Mastercard Negocios', metodo_pago_id: mpTarjetaCredito.id, ultimos_cuatro: '3456', status: 'active' },
    { nombre: 'Nequi Empresarial', metodo_pago_id: mpTransferencia.id, ultimos_cuatro: '7890', status: 'active' },
  ];
  for (const t of tarjetasData) {
    await createIfNotExists('tarjetas_agencia', { nombre: t.nombre }, t);
  }
  console.log('  Ã¢Å“â€œ Tarjetas de agencia');

  // =========================================================
  // 8. PERSONAS + USUARIOS
  // =========================================================

  const usuariosData = [
    {
      nombres: 'Admin', apellidos: 'iTea', tipo_documento_id: tipoCC.id, documento: '123456789',
      email: 'admin@itea.com', telefono: '3001234567', birth_date: new Date('1990-01-15'),
      role: 'admin', password: 'Admin123'
    },
    {
      nombres: 'Juan', apellidos: 'Perez', tipo_documento_id: tipoCC.id, documento: '987654321',
      email: 'juan@itea.com', telefono: '3002345678', birth_date: new Date('1985-06-20'),
      role: 'asesor', password: 'Vendor123'
    },
    {
      nombres: 'Maria', apellidos: 'Garcia', tipo_documento_id: tipoCE.id, documento: '5555555',
      email: 'maria@itea.com', telefono: '3003456789', birth_date: new Date('1992-03-10'),
      role: 'asesor', password: 'Vendor123'
    },
    {
      nombres: 'Carlos', apellidos: 'Lopez', tipo_documento_id: tipoPasaporte.id, documento: 'XY789654',
      email: 'carlos@itea.com', telefono: '3004567890', birth_date: new Date('1988-11-25'),
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
        tipo_documento_id: u.tipoDocumentoId, documento: u.documento,
        email: u.email, telefono: u.telefono, birth_date: u.birthDate,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.nombres}`,
        status: u.status || 'active'
      }
    );
    const rol = u.role === 'admin' ? rolAdmin : (u.role === 'freelancer' ? rolFreelancer : rolAsesor);
    const usuario = await upsertByUnique(
      'usuarios',
      { email: u.email },
      {
        persona_id: persona.id, email: u.email,
        password_hash: await bcrypt.hash(u.password, SALT),
        rol_id: rol.id, status: u.status || 'active'
      }
    );
    usuariosMap[u.email] = usuario;
  }
  console.log('  Ã¢Å“â€œ Usuarios');

  // =========================================================
  // 9. PERSONAS + CLIENTES
  // =========================================================

  const clientesData = [
    { nombres: 'Ana Maria', apellidos: 'Torres', tipo_documento_id: tipoCC.id, documento: '12345678', email: 'ana@email.com', telefono: '3001234567', birth_date: new Date('1992-05-15') },
    { nombres: 'Roberto', apellidos: 'Sanchez', tipo_documento_id: tipoCC.id, documento: '87654321', email: 'roberto@email.com', telefono: '3002345678', birth_date: new Date('1988-08-20') },
    { nombres: 'Laura', apellidos: 'Martinez', tipo_documento_id: tipoPasaporte.id, documento: 'AB123456', email: 'laura@email.com', telefono: '3003456789', birth_date: new Date('1995-03-10') },
    { nombres: 'Miguel Angel', apellidos: 'Rodriguez', tipo_documento_id: tipoCC.id, documento: '11223344', email: 'miguel@email.com', telefono: '3004567890', birth_date: new Date('1990-11-25') },
    { nombres: 'Sofia', apellidos: 'Hernandez', tipo_documento_id: tipoCE.id, documento: 'CE5555555', email: 'sofia@email.com', telefono: '3005678901', birth_date: new Date('1993-07-01') },
    { nombres: 'Diego', apellidos: 'Fernandez', tipo_documento_id: tipoCC.id, documento: '99887766', email: 'diego@email.com', telefono: '3006789012', birth_date: new Date('1987-04-15') },
    { nombres: 'Carmen', apellidos: 'Lopez', tipo_documento_id: tipoPasaporte.id, documento: 'PAS-XY789654', email: 'carmen@email.com', telefono: '3007890123', birth_date: new Date('1991-12-01') },
    { nombres: 'Jose Manuel', apellidos: 'Gil', tipo_documento_id: tipoCC.id, documento: '44556677', email: 'jose@email.com', telefono: '3008901234', birth_date: new Date('1989-09-20') },
    { nombres: 'Isabella', apellidos: 'Diaz', tipo_documento_id: tipoCC.id, documento: '66778899', email: 'isabella@email.com', telefono: '3009012345', birth_date: new Date('1994-06-05') },
    { nombres: 'Fernando', apellidos: 'Morales', tipo_documento_id: tipoCE.id, documento: '1234888', email: 'fernando@email.com', telefono: '3010123456', birth_date: new Date('1986-06-18') },
    { nombres: 'Patricia', apellidos: 'Ruiz', tipo_documento_id: tipoPasaporte.id, documento: 'ZZ555555', email: 'patricia@email.com', telefono: '3011234567', birth_date: new Date('1997-07-01') },
    { nombres: 'Alejandro', apellidos: 'Castro', tipo_documento_id: tipoCC.id, documento: '33445566', email: 'alejandro@email.com', telefono: '3012345678', birth_date: new Date('1991-07-15') },
    { nombres: 'Carlos Eduardo', apellidos: 'Gomez', tipo_documento_id: tipoCC.id, documento: '10101010', email: 'carlos.gomez@email.com', telefono: '3000000001', birth_date: new Date('1990-01-01') },
    { nombres: 'Maria Fernanda', apellidos: 'Lopez', tipo_documento_id: tipoCC.id, documento: '20202020', email: 'maria.lopez@email.com', telefono: '3000000002', birth_date: new Date('1990-02-02') },
    { nombres: 'Pedro Antonio', apellidos: 'Ruiz', tipo_documento_id: tipoCC.id, documento: '30303030', email: 'pedro.ruiz@email.com', telefono: '3000000003', birth_date: new Date('1990-03-03') },
    { nombres: 'Lucia Daniela', apellidos: 'PeÃƒÂ±a', tipo_documento_id: tipoCC.id, documento: '40404040', email: 'lucia.pena@email.com', telefono: '3000000004', birth_date: new Date('1990-04-04') },
    { nombres: 'Andres Felipe', apellidos: 'Castro', tipo_documento_id: tipoCC.id, documento: '50505050', email: 'andres.castro@email.com', telefono: '3000000005', birth_date: new Date('1990-05-05') },
  ];
  const clientesMap = {};
  for (const c of clientesData) {
    const persona = await upsertByUnique(
      'personas',
      { documento: c.documento },
      {
        nombres: c.nombres, apellidos: c.apellidos,
        tipo_documento_id: c.tipoDocumentoId, documento: c.documento,
        email: c.email, telefono: c.telefono, birth_date: c.birthDate,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.nombres.split(' ')[0]}`
      }
    );
    const cliente = await upsertByUnique(
      'clientes',
      { persona_id: persona.id },
      { persona_id: persona.id, creado_por_id: usuariosMap['admin@itea.com'].id }
    );
    clientesMap[`${c.nombres} ${c.apellidos}`] = cliente;
  }
  console.log('  Ã¢Å“â€œ Clientes');

  // =========================================================
  // 10. COMISIONISTAS
  // =========================================================

  const comisionistasData = [
    { nombres: 'Agencia', apellidos: 'Viajes Plus', tipo_documento_id: tipoNIT.id, documento: '900123456', tipo: 'Agencia Externa' },
    { nombres: 'Asesor', apellidos: 'Independiente', tipo_documento_id: tipoCC.id, documento: '111111111', tipo: 'Comisionista' },
    { nombres: 'Global Travel', apellidos: 'Solutions', tipo_documento_id: tipoNIT.id, documento: '900789012', tipo: 'Empresa' },
    { nombres: 'Beatriz', apellidos: 'Herrera', tipo_documento_id: tipoCC.id, documento: '222222222', tipo: 'Comisionista' },
  ];
  const comisionistasMap = {};
  for (const c of comisionistasData) {
    const persona = await upsertByUnique(
      'personas',
      { documento: c.documento },
      {
        nombres: c.nombres, apellidos: c.apellidos,
        tipo_documento_id: c.tipoDocumentoId, documento: c.documento
      }
    );
    const comisionista = await upsertByUnique(
      'comisionistas',
      { persona_id: persona.id },
      { persona_id: persona.id, tipo: c.tipo, umbral_pago: 500000, acumulado: 0, status: 'Activo' }
    );
    comisionistasMap[c.documento] = comisionista;
  }
  console.log('  Ã¢Å“â€œ Comisionistas');

  // =========================================================
  // 11. PAQUETES TURÃƒÂSTICOS
  // =========================================================

  const paquetesData = [
    {
      nombre: 'San AndrÃƒÂ©s All Inclusive', destino: 'San AndrÃƒÂ©s', status: 'activo',
      servicios_incluidos: 'Vuelo ida y vuelta, Hotel 5 estrellas, AlimentaciÃƒÂ³n completa, Tour Acuario, Tour Jhonny Cay, Seguro de viaje',
      no_incluido: 'Gastos personales, Compras, Excursiones adicionales',
      hotel_nombre: 'Decameron San AndrÃƒÂ©s', tipo_hotel: 'resort', regimen: 'todo_incluido', noches: 4,
      aerolinea_iata: 'AV', nro_vuelo: 'AV204', modo_vuelo: 'round_trip',
      tarifa_adulto: 2500000, tarifa_menor: 1800000,
      cobertura_usd: 50000, dias_cobertura: 7
    },
    {
      nombre: 'Cartagena Boutique', destino: 'Cartagena', status: 'activo',
      servicios_incluidos: 'Vuelo ida y vuelta, Hotel Boutique, Desayunos, City Tour, Tour Castillo San Felipe',
      no_incluido: 'Almuerzos y cenas, Gastos personales, Propinas',
      hotel_nombre: 'Dann Carlton Cartagena', tipo_hotel: 'boutique', regimen: 'solo_desayuno', noches: 3,
      aerolinea_iata: 'LA', nro_vuelo: 'LA123', modo_vuelo: 'round_trip',
      tarifa_adulto: 1800000, tarifa_menor: 1300000,
      cobertura_usd: 30000, dias_cobertura: 5
    },
    {
      nombre: 'MedellÃƒÂ­n Aventura', destino: 'MedellÃƒÂ­n', status: 'activo',
      servicios_incluidos: 'Vuelo ida y vuelta, Hotel, Tour Comuna 13, Tour GuatapÃƒÂ©, Seguro de viaje',
      no_incluido: 'AlimentaciÃƒÂ³n, Gastos personales',
      hotel_nombre: 'Hotel Estelar', tipo_hotel: 'hotel', regimen: 'sin_alimentacion', noches: 3,
      aerolinea_iata: 'AV', nro_vuelo: 'AV412', modo_vuelo: 'round_trip',
      tarifa_adulto: 1200000, tarifa_menor: 900000,
      cobertura_usd: 25000, dias_cobertura: 4
    },
  ];

  for (const p of paquetesData) {
    const paquete = await createIfNotExists(
      'paquetes',
      { nombre: p.nombre, destino: p.destino },
      {
        nombre: p.nombre, destino: p.destino, status: p.status,
        servicios_incluidos: p.servicios_incluidos, no_incluido: p.no_incluido,
        creado_por_id: usuariosMap['admin@itea.com'].id
      }
    );
    // Solo crear relaciones si el paquete es nuevo (no existÃƒÂ­a)
    const existingVuelo = await prisma.paquete_vuelo.findFirst({ where: { paquete_id: paquete.id } });
    if (!existingVuelo) {
      await prisma.paquete_vuelo.create({
        data: {
          paquete_id: paquete.id, aerolinea_id: aerolineasMap[p.aerolinea_iata].id,
          nro_vuelo: p.nro_vuelo, modo_vuelo: p.modo_vuelo
        }
      });
    }

    const existingHotel = await prisma.paquete_hotel.findFirst({ where: { paquete_id: paquete.id } });
    if (!existingHotel) {
      await prisma.paquete_hotel.create({
        data: {
          paquete_id: paquete.id, hotel_nombre: p.hotel_nombre,
          tipo_hotel: p.tipo_hotel, regimen: p.regimen, noches: p.noches
        }
      });
    }

    const existingTarifa = await prisma.paquete_tarifas.findFirst({ where: { paquete_id: paquete.id } });
    if (!existingTarifa) {
      await prisma.paquete_tarifas.create({
        data: {
          paquete_id: paquete.id, tarifa_adulto: p.tarifa_adulto, tarifa_menor: p.tarifa_menor
        }
      });
    }

    const existingAsistencia = await prisma.paquete_asistencia_medica.findFirst({ where: { paquete_id: paquete.id } });
    if (!existingAsistencia) {
      await prisma.paquete_asistencia_medica.create({
        data: {
          paquete_id: paquete.id, cobertura_usd: p.cobertura_usd, dias_cobertura: p.dias_cobertura
        }
      });
    }
  }
  console.log('  Ã¢Å“â€œ Paquetes turÃƒÂ­sticos');

  // =========================================================
  // 12. VENTAS DE EJEMPLO
  // =========================================================

  const adminUser = usuariosMap['admin@itea.com'];
  const juanUser = usuariosMap['juan@itea.com'];
  const mariaUser = usuariosMap['maria@itea.com'];
  const clientes = await prisma.clientes.findMany({ include: { personas: true } });
  const getCliente = (index) => clientes[index % clientes.length];

  const allProveedores = await prisma.proveedores.findMany();

  const ventasEjemplo = [
    {
      clienteIndex: 0, asesorId: adminUser.id, monto_total: 2500000, status: 'pagado',
      metodo_pago_id: mpTarjetaCredito.id, comisionistaDoc: '900123456',
      monto_comision_bruto: 150000, porcentajeRetencion: 0, monto_comision_neto: 150000,
      costo_proveedor: 2100000, observaciones: 'Reserva de hotel en Santa Marta\n- 4 noches, 3 dÃƒÂ­as\n- Incluye desayunos\n- HabitaciÃƒÂ³n con vista al mar.',
      categoria: 'hoteleria', hotel_nombre: 'Decameron Santa Marta', destino: 'Santa Marta',
      fechaInicio: new Date('2026-05-01'), fechaFin: new Date('2026-05-04')
    },
    {
      clienteIndex: 1, asesorId: juanUser.id, monto_total: 800000, status: 'credito',
      metodo_pago_id: mpTransferencia.id, comisionistaDoc: '111111111',
      monto_comision_bruto: 20000, porcentajeRetencion: 0, monto_comision_neto: 20000,
      costo_proveedor: 730000, observaciones: 'Vuelo redondo BogotÃƒÂ¡ - MedellÃƒÂ­n\n- Ida: 10AM (Avianca)\n- Regreso: 6PM (Avianca)\n- Equipaje de mano de 10kg.',
      categoria: 'tiqueteria',
      es_credito: true, fecha_vence_credito: new Date('2026-06-15')
    },
    {
      clienteIndex: 2, asesorId: adminUser.id, monto_total: 4500000, status: 'abonado',
      metodo_pago_id: mpEfectivo.id, comisionistaDoc: '222222222',
      monto_comision_bruto: 300000, porcentajeRetencion: 0, monto_comision_neto: 300000,
      costo_proveedor: 3700000, observaciones: 'Paquete turÃƒÂ­stico a San AndrÃƒÂ©s (Vuelo + Hotel + Tours)\n- 5 DÃƒÂ­as / 4 Noches\n- Vuelo directo\n- Hotel All Inclusive\n- Tour Acuario y Jhonny Cay.',
      categoria: 'planes',
      es_credito: true, fecha_vence_credito: new Date('2026-07-15'), monto_pagado_credito: 2000000
    },
    {
      clienteIndex: 3, asesorId: mariaUser.id, monto_total: 1200000, status: 'pagado',
      metodo_pago_id: mpPSE.id, comisionistaDoc: '900789012',
      monto_comision_bruto: 85000, porcentajeRetencion: 0, monto_comision_neto: 85000,
      costo_proveedor: 950000, observaciones: 'Seguro de viaje internacional cobertura 100k USD.',
      categoria: 'seguros_viaje'
    },
  ];

  for (const v of ventasEjemplo) {
    const cliente = getCliente(v.clienteIndex);
    const comisionista = comisionistasMap[v.comisionistaDoc];

    const venta = await createIfNotExists(
      'ventas',
      {
        cliente_id: cliente.id,
        usuario_id: v.asesorId,
        monto_total: v.monto_total,
        status: v.status
      },
      {
        cliente_id: cliente.id,
        usuario_id: v.asesorId,
        monto_total: v.monto_total,
        costo_proveedor_total: v.costo_proveedor || 0,
        ta_total: v.monto_total - (v.costo_proveedor || 0),
        comisionista_id: comisionista?.id,
        monto_comision_bruto: v.monto_comision_bruto,
        porcentaje_retencion_comision: v.porcentajeRetencion,
        monto_comision_neto: v.monto_comision_neto,
        metodo_pago_principal_id: v.metodo_pago_id,
        status: v.status,
        es_credito: v.es_credito || false,
        fecha_vence_credito: v.fecha_vence_credito || null,
        monto_pagado_credito: v.monto_pagado_credito || 0,
        observaciones: v.observaciones || ''
      }
    );

    const existingDetalle = await prisma.detalle_venta.findFirst({ where: { venta_id: venta.id } });
    if (!existingDetalle) {
      const detalleId = randomUUID();
      const detalle = await prisma.detalle_venta.create({
        data: {
          id: detalleId,
          venta_id: venta.id,
          categoria: v.categoria,
          nombre_servicio: v.hotel_nombre || `Servicio de ${v.categoria}`,
          subtotal: v.costo_proveedor,
          ta: v.monto_total - v.costo_proveedor,
          costo_proveedor: v.costo_proveedor || 0,
          proveedor_id: allProveedores[0]?.id,
          fecha_inicio_viaje: v.fechaInicio,
          fecha_fin_viaje: v.fechaFin,
          origen: v.categoria === 'tiqueteria' ? 'Bogotá' : null,
          destino: v.destino || null
        }
      });

      switch (v.categoria) {
        case 'hoteleria':
          await prisma.prod_hoteleria.create({
            data: {
              id: randomUUID(),
              detalle_venta_id: detalle.id,
              hotel_nombre: v.hotel_nombre,
              destino: v.destino,
              tipo_hotel: 'hotel',
              fecha_entrada: v.fechaInicio,
              fecha_salida: v.fechaFin
            }
          });
          break;
        case 'tiqueteria': {
          const prodTicket = await prisma.prod_tiqueteria.create({
            data: {
              id: randomUUID(),
              detalle_venta_id: detalle.id,
              aerolineaId: aerolineasMap['AV'].id,
              nro_reserva: `RES-${venta.id}`,
              nro_vuelo: `AV${100 + venta.id}`,
              modo_vuelo: 'round_trip',
              planEquipajeId: equipajeMap[`${aerolineasMap['AV'].id}-Económica`]?.id
            }
          });
          await prisma.tramos_vuelo.create({
            data: {
              prod_tiqueteria_id: prodTicket.id,
              aeropuerto_origen_id: aeropuertosMap['BOG'].id,
              aeropuerto_destino_id: aeropuertosMap['MDE'].id,
              salida: new Date('2026-05-15T10:00:00'),
              llegada: new Date('2026-05-15T11:00:00'),
              nro_vuelo_tramo: `AV${100 + venta.id}`,
              orden: 1
            }
          });
          break;
        }
        case 'planes':
          await prisma.prod_planes.create({
            data: {
              id: randomUUID(),
              detalle_venta_id: detalle.id,
              nombre_plan: 'Plan San Andrés',
              aerolineaId: aerolineasMap['AV'].id,
              adultos_count: 2, menores_count: 0,
              fecha_viaje_inicio: new Date('2026-06-01'),
              fecha_viaje_fin: new Date('2026-06-05')
            }
          });
          break;
        case 'seguros_viaje':
          await prisma.prod_seguros.create({
            data: {
              id: randomUUID(),
              detalle_venta_id: detalle.id,
              tipo_seguro: 'todo_riesgo',
              cobertura_usd: 100000,
              dias_cobertura: 15,
              telefono_contacto: '3000000000'
            }
          });
          break;
      }
    }
  }
  console.log('  Ã¢Å“â€œ Ventas de ejemplo');

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
        'ventas_mensuales',
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
  console.log('  Ã¢Å“â€œ Ventas mensuales (historial)');

  console.log('\nÃ¢Å“â€¦ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('Ã¢ÂÅ’ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
