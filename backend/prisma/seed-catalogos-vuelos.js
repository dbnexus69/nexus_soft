/**
 * Siembra solo los catálogos globales de vuelos (aerolíneas, aeropuertos, políticas de
 * equipaje) — ninguno de los tres lleva `empresa_id`, son compartidos por todas las agencias.
 *
 * Existe aparte de `prisma/seed.js` porque ese script ya no corre: quedó desactualizado
 * frente al esquema multi-tenant (`metodos_pago`/`roles` ya no tienen un único por `nombre`
 * a secas, sino por `(empresa_id, nombre)`) y falla antes de llegar a esta parte. Arreglar
 * `seed.js` entero es aparte; esto cubre lo que se pidió: aerolíneas y aeropuertos
 * principales de Colombia y los internacionales más reservados, con sus equipajes.
 *
 * `pnpm db:seed:vuelos`. Idempotente: se puede correr varias veces sin duplicar ni pisar.
 */
const { PrismaClient } = require('@prisma/client');

const urlAdmin = (process.env.DIRECT_URL || process.env.DATABASE_URL || '').split('?')[0];
const prisma = new PrismaClient({
  datasourceUrl: urlAdmin ? `${urlAdmin}?connection_limit=1` : undefined,
});

async function upsertByUnique(model, where, data) {
  return prisma[model].upsert({ where, update: {}, create: data });
}

async function createIfNotExists(model, where, data) {
  const existing = await prisma[model].findFirst({ where });
  if (existing) return existing;
  return prisma[model].create({ data });
}

async function main() {
  console.log('Sembrando catálogos de vuelos...');

  // Viva Air (VH) no entra: dejó de operar en febrero de 2023 y no se reactivó.
  const aerolineasData = [
    { nombre: 'Avianca', codigo_iata: 'AV', tipo: 'Nacional', web: 'https://www.avianca.com' },
    { nombre: 'LATAM', codigo_iata: 'LA', tipo: 'Internacional', web: 'https://www.latam.com' },
    { nombre: 'Wingo', codigo_iata: 'P5', tipo: 'Nacional', web: 'https://www.wingo.com' },
    { nombre: 'EasyFly', codigo_iata: 'VE', tipo: 'Nacional', web: 'https://www.easyfly.com.co' },
    { nombre: 'Satena', codigo_iata: '9R', tipo: 'Nacional', web: 'https://www.satena.com' },
    { nombre: 'JetSmart Colombia', codigo_iata: 'J6', tipo: 'Nacional', web: 'https://www.jetsmart.com' },
    { nombre: 'Copa Airlines', codigo_iata: 'CM', tipo: 'Internacional', web: 'https://www.copaair.com' },
    { nombre: 'American Airlines', codigo_iata: 'AA', tipo: 'Internacional', web: 'https://www.aa.com' },
    { nombre: 'Iberia', codigo_iata: 'IB', tipo: 'Internacional', web: 'https://www.iberia.com' },
    { nombre: 'Delta', codigo_iata: 'DL', tipo: 'Internacional', web: 'https://www.delta.com' },
    { nombre: 'United Airlines', codigo_iata: 'UA', tipo: 'Internacional', web: 'https://www.united.com' },
    { nombre: 'Air France', codigo_iata: 'AF', tipo: 'Internacional', web: 'https://www.airfrance.com' },
    { nombre: 'KLM', codigo_iata: 'KL', tipo: 'Internacional', web: 'https://www.klm.com' },
    { nombre: 'JetBlue', codigo_iata: 'B6', tipo: 'Internacional', web: 'https://www.jetblue.com' },
    { nombre: 'Spirit Airlines', codigo_iata: 'NK', tipo: 'Internacional', web: 'https://www.spirit.com' },
    { nombre: 'Emirates', codigo_iata: 'EK', tipo: 'Internacional', web: 'https://www.emirates.com' },
    { nombre: 'Turkish Airlines', codigo_iata: 'TK', tipo: 'Internacional', web: 'https://www.turkishairlines.com' },
    { nombre: 'Air Europa', codigo_iata: 'UX', tipo: 'Internacional', web: 'https://www.aireuropa.com' },
    { nombre: 'Aeroméxico', codigo_iata: 'AM', tipo: 'Internacional', web: 'https://www.aeromexico.com' },
    { nombre: 'Lufthansa', codigo_iata: 'LH', tipo: 'Internacional', web: 'https://www.lufthansa.com' },
    { nombre: 'GOL Linhas Aéreas', codigo_iata: 'G3', tipo: 'Internacional', web: 'https://www.voegol.com.br' },
  ];
  const aerolineasMap = {};
  for (const a of aerolineasData) {
    aerolineasMap[a.codigo_iata] = await upsertByUnique('aerolineas', { codigo_iata: a.codigo_iata }, a);
  }
  console.log(`  ✓ Aerolíneas (${aerolineasData.length})`);

  const aeropuertosData = [
    { nombre: 'El Dorado', codigo_iata: 'BOG', ciudad: 'Bogotá', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'José María Córdova', codigo_iata: 'MDE', ciudad: 'Medellín', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Olaya Herrera', codigo_iata: 'EOH', ciudad: 'Medellín', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Rafael Núñez', codigo_iata: 'CTG', ciudad: 'Cartagena', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Alfonso Bonilla Aragón', codigo_iata: 'CLO', ciudad: 'Cali', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Gustavo Rojas Pinilla', codigo_iata: 'ADZ', ciudad: 'San Andrés', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Ernesto Cortissoz', codigo_iata: 'BAQ', ciudad: 'Barranquilla', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Matecaña', codigo_iata: 'PEI', ciudad: 'Pereira', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Palonegro', codigo_iata: 'BGA', ciudad: 'Bucaramanga', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Simón Bolívar', codigo_iata: 'SMR', ciudad: 'Santa Marta', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El Edén', codigo_iata: 'AXM', ciudad: 'Armenia', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'La Nubia', codigo_iata: 'MZL', ciudad: 'Manizales', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Camilo Daza', codigo_iata: 'CUC', ciudad: 'Cúcuta', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Almirante Padilla', codigo_iata: 'RCH', ciudad: 'Riohacha', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Alfonso López Pumarejo', codigo_iata: 'VUP', ciudad: 'Valledupar', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Los Garzones', codigo_iata: 'MTR', ciudad: 'Montería', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Antonio Roldán Betancourt', codigo_iata: 'APO', ciudad: 'Apartadó', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Las Brujas', codigo_iata: 'CZU', ciudad: 'Sincelejo', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Perales', codigo_iata: 'IBE', ciudad: 'Ibagué', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Benito Salas', codigo_iata: 'NVA', ciudad: 'Neiva', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Guillermo León Valencia', codigo_iata: 'PPN', ciudad: 'Popayán', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'San Luis', codigo_iata: 'IPI', ciudad: 'Ipiales', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Antonio Nariño', codigo_iata: 'PSO', ciudad: 'Pasto', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Vanguardia', codigo_iata: 'VVC', ciudad: 'Villavicencio', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El Alcaraván', codigo_iata: 'EYP', ciudad: 'Yopal', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Santiago Pérez Quiroz', codigo_iata: 'AUC', ciudad: 'Arauca', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'El Caraño', codigo_iata: 'UIB', ciudad: 'Quibdó', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Yariguíes', codigo_iata: 'EJA', ciudad: 'Barrancabermeja', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Reyes Murillo', codigo_iata: 'NQU', ciudad: 'Nuquí', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'José Celestino Mutis', codigo_iata: 'BSC', ciudad: 'Bahía Solano', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Germán Olano', codigo_iata: 'PCR', ciudad: 'Puerto Carreño', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Fabio Alberto León Bentley', codigo_iata: 'MVP', ciudad: 'Mitú', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Jorge Enrique González', codigo_iata: 'SJE', ciudad: 'San José del Guaviare', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Tres de Mayo', codigo_iata: 'PUU', ciudad: 'Puerto Asís', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Alfredo Vásquez Cobo', codigo_iata: 'LET', ciudad: 'Leticia', pais: 'Colombia', tipo: 'Ambos' },
    { nombre: 'Golfo de Morrosquillo', codigo_iata: 'TLU', ciudad: 'Tolú', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Gerardo Tobar López', codigo_iata: 'BUN', ciudad: 'Buenaventura', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'San Bernardo', codigo_iata: 'MMP', ciudad: 'Mompox', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Cacique Aramare', codigo_iata: 'PDA', ciudad: 'Puerto Inírida', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'La Florida', codigo_iata: 'TCO', ciudad: 'Tumaco', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Eduardo Falla Solano', codigo_iata: 'SVI', ciudad: 'San Vicente del Caguán', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Gustavo Artunduaga', codigo_iata: 'FLA', ciudad: 'Florencia', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Contador', codigo_iata: 'PTX', ciudad: 'Pitalito', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Mandinga', codigo_iata: 'COG', ciudad: 'Condoto', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Capurganá', codigo_iata: 'CPB', ciudad: 'Capurganá', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Alcides Fernández', codigo_iata: 'ACD', ciudad: 'Acandí', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Jorge Isaacs', codigo_iata: 'MCJ', ciudad: 'Maicao', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Los Colonizadores', codigo_iata: 'RVE', ciudad: 'Saravena', pais: 'Colombia', tipo: 'Nacional' },
    { nombre: 'Miami', codigo_iata: 'MIA', ciudad: 'Miami', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'John F. Kennedy', codigo_iata: 'JFK', ciudad: 'New York', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'Orlando', codigo_iata: 'MCO', ciudad: 'Orlando', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'Los Ángeles', codigo_iata: 'LAX', ciudad: 'Los Ángeles', pais: 'Estados Unidos', tipo: 'Internacional' },
    { nombre: 'Adolfo Suárez Madrid-Barajas', codigo_iata: 'MAD', ciudad: 'Madrid', pais: 'España', tipo: 'Internacional' },
    { nombre: 'Barcelona-El Prat', codigo_iata: 'BCN', ciudad: 'Barcelona', pais: 'España', tipo: 'Internacional' },
    { nombre: 'Charles de Gaulle', codigo_iata: 'CDG', ciudad: 'París', pais: 'Francia', tipo: 'Internacional' },
    { nombre: 'Heathrow', codigo_iata: 'LHR', ciudad: 'Londres', pais: 'Reino Unido', tipo: 'Internacional' },
    { nombre: 'Frankfurt', codigo_iata: 'FRA', ciudad: 'Frankfurt', pais: 'Alemania', tipo: 'Internacional' },
    { nombre: 'Tocumen', codigo_iata: 'PTY', ciudad: 'Ciudad de Panamá', pais: 'Panamá', tipo: 'Internacional' },
    { nombre: 'Benito Juárez', codigo_iata: 'MEX', ciudad: 'Ciudad de México', pais: 'México', tipo: 'Internacional' },
    { nombre: 'Cancún', codigo_iata: 'CUN', ciudad: 'Cancún', pais: 'México', tipo: 'Internacional' },
    { nombre: 'Jorge Chávez', codigo_iata: 'LIM', ciudad: 'Lima', pais: 'Perú', tipo: 'Internacional' },
    { nombre: 'Mariscal Sucre', codigo_iata: 'UIO', ciudad: 'Quito', pais: 'Ecuador', tipo: 'Internacional' },
    { nombre: 'Ministro Pistarini (Ezeiza)', codigo_iata: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina', tipo: 'Internacional' },
    { nombre: 'Arturo Merino Benítez', codigo_iata: 'SCL', ciudad: 'Santiago', pais: 'Chile', tipo: 'Internacional' },
    { nombre: 'Guarulhos', codigo_iata: 'GRU', ciudad: 'São Paulo', pais: 'Brasil', tipo: 'Internacional' },
    { nombre: 'Las Américas', codigo_iata: 'SDQ', ciudad: 'Santo Domingo', pais: 'República Dominicana', tipo: 'Internacional' },
    { nombre: 'Queen Beatrix', codigo_iata: 'AUA', ciudad: 'Oranjestad', pais: 'Aruba', tipo: 'Internacional' },
    { nombre: 'Dubai', codigo_iata: 'DXB', ciudad: 'Dubái', pais: 'Emiratos Árabes Unidos', tipo: 'Internacional' },
    { nombre: 'Estambul', codigo_iata: 'IST', ciudad: 'Estambul', pais: 'Turquía', tipo: 'Internacional' },
  ];
  for (const a of aeropuertosData) {
    await upsertByUnique('aeropuertos', { codigo_iata: a.codigo_iata }, a);
  }
  console.log(`  ✓ Aeropuertos (${aeropuertosData.length})`);

  const equipajeData = [
    { aerolinea_id: aerolineasMap['CM'].id, tipo_tarifa: 'Basic', articulo_personal: '1 bolso (43x32x22 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['CM'].id, tipo_tarifa: 'Classic / Economy', articulo_personal: '1 bolso (43x32x22 cm)', equipaje_mano: '1 maleta hasta 10kg (56x36x26 cm)', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['CM'].id, tipo_tarifa: 'Business', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: '2 maletas hasta 32kg c/u' },
    { aerolinea_id: aerolineasMap['AA'].id, tipo_tarifa: 'Basic Economy', articulo_personal: '1 bolso (45x35x20 cm)', equipaje_mano: '1 maleta (56x36x23 cm)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['AA'].id, tipo_tarifa: 'Main Cabin', articulo_personal: '1 bolso', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['IB'].id, tipo_tarifa: 'Básica', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg (56x40x25 cm)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['IB'].id, tipo_tarifa: 'Óptima', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['DL'].id, tipo_tarifa: 'Basic Economy', articulo_personal: '1 artículo personal', equipaje_mano: '1 maleta de mano', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['DL'].id, tipo_tarifa: 'Main Cabin', articulo_personal: '1 artículo personal', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['UA'].id, tipo_tarifa: 'Basic Economy', articulo_personal: '1 bolso (43x25x22 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['UA'].id, tipo_tarifa: 'Economy', articulo_personal: '1 bolso', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['AF'].id, tipo_tarifa: 'Light', articulo_personal: '1 bolso (40x30x15 cm)', equipaje_mano: '1 maleta hasta 12kg (55x35x25 cm)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['AF'].id, tipo_tarifa: 'Standard', articulo_personal: '1 bolso', equipaje_mano: '1 maleta hasta 12kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['KL'].id, tipo_tarifa: 'Light', articulo_personal: '1 accesorio pequeño', equipaje_mano: '1 maleta (total máx. 12kg)', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['KL'].id, tipo_tarifa: 'Standard', articulo_personal: '1 accesorio pequeño', equipaje_mano: '1 maleta de mano', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['B6'].id, tipo_tarifa: 'Blue Basic', articulo_personal: '1 bolso personal (43x33x20 cm)', equipaje_mano: '1 maleta de mano', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['B6'].id, tipo_tarifa: 'Blue', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta de mano', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['NK'].id, tipo_tarifa: 'Standard', articulo_personal: '1 bolso personal (45x35x20 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['P5'].id, tipo_tarifa: 'Go Basic', articulo_personal: '1 bolso personal (40x30x20 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['P5'].id, tipo_tarifa: 'Go Plus', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta de mano hasta 12kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['VE'].id, tipo_tarifa: 'Económica', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta hasta 5kg', equipaje_bodega: '1 maleta hasta 15kg' },
    { aerolinea_id: aerolineasMap['9R'].id, tipo_tarifa: 'Básica', articulo_personal: '1 bolso personal', equipaje_mano: '1 equipaje hasta 5kg', equipaje_bodega: '1 maleta hasta 15kg' },
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
    { aerolinea_id: aerolineasMap['J6'].id, tipo_tarifa: 'Zero', articulo_personal: '1 bolso (40x30x20 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['J6'].id, tipo_tarifa: 'Smart', articulo_personal: '1 bolso', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['AM'].id, tipo_tarifa: 'Basic', articulo_personal: '1 bolso personal (40x30x25 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['AM'].id, tipo_tarifa: 'Classic', articulo_personal: '1 bolso personal', equipaje_mano: '1 maleta de mano hasta 10kg', equipaje_bodega: '1 maleta hasta 25kg' },
    { aerolinea_id: aerolineasMap['LH'].id, tipo_tarifa: 'Economy Light', articulo_personal: '1 accesorio personal', equipaje_mano: '1 maleta hasta 8kg', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['LH'].id, tipo_tarifa: 'Economy Classic', articulo_personal: '1 accesorio personal', equipaje_mano: '1 maleta hasta 8kg', equipaje_bodega: '1 maleta hasta 23kg' },
    { aerolinea_id: aerolineasMap['G3'].id, tipo_tarifa: 'Light', articulo_personal: '1 bolso (25x35x45 cm)', equipaje_mano: 'No incluido', equipaje_bodega: 'No incluido' },
    { aerolinea_id: aerolineasMap['G3'].id, tipo_tarifa: 'Plus', articulo_personal: '1 bolso', equipaje_mano: '1 maleta hasta 10kg', equipaje_bodega: '1 maleta hasta 23kg' },
  ];
  for (const e of equipajeData) {
    await createIfNotExists('politicas_equipaje', { aerolinea_id: e.aerolinea_id, tipo_tarifa: e.tipo_tarifa }, e);
  }
  console.log(`  ✓ Políticas de equipaje (${equipajeData.length})`);

  console.log('Listo.');
}

main()
  .catch((err) => { console.error('Error durante el seed de vuelos:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
