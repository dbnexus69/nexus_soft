// Las cláusulas que salen cuando la agencia no ha escrito las suyas (`empresas.voucher_terminos` NULL).
// Son las que traía el voucher del navegador; `{agencia}` se sustituye por su nombre.
module.exports = [
  {
    titulo: 'Intermediación',
    texto: '{agencia} actúa como intermediario entre el cliente y los prestadores finales de los servicios (aerolíneas, hoteles, operadores terrestres).',
  },
  {
    titulo: 'Presentación',
    texto: 'Es obligatorio presentarse con 2 horas de anticipación para vuelos nacionales y 4 horas para vuelos internacionales.',
  },
  {
    titulo: 'Documentación',
    texto: 'El pasajero es el único responsable de portar documentos de identidad vigentes, visas, permisos de menores y certificaciones sanitarias exigidas por su destino.',
  },
  {
    titulo: 'Check-in',
    texto: '{agencia} podrá brindar asistencia con el pase de abordar sujeto a la disponibilidad y tiempos de la aerolínea (típicamente 24 horas antes del vuelo). {agencia} no asume responsabilidad si el pasajero no realiza este trámite a tiempo.',
  },
  {
    titulo: 'Responsabilidad limitada',
    texto: 'Todo cambio, demora, cancelación o penalidad está sujeta única y exclusivamente a las políticas comerciales de la aerolínea o proveedor final.',
  },
];
