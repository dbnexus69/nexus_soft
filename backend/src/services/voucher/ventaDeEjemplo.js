// La venta con la que se dibuja la vista previa del voucher en "Mi empresa": inventada, no se guarda.
module.exports = {
  id: 0, numero: 1024, clientName: 'Laura Gómez', status: 'abonado', total: 2380000, iva: 38000,
  paymentMethod: 'Transferencia', payments: [{ amount: 1000000, method: 'Transferencia' }],
  ticketData: [{
    reservationNumber: 'XK7P2Q', airlineName: 'Avianca', baggagePlanName: 'Avianca - Classic',
    legs: [
      { origin: 'BOG', destination: 'CTG', flightNumber: 'AV9620', date: '2026-12-18', time: '07:30', arrivalTime: '08:55' },
      { origin: 'CTG', destination: 'BOG', flightNumber: 'AV9625', date: '2026-12-23', time: '18:10', arrivalTime: '19:40' },
    ],
    passengers: [
      { name: 'Laura Gómez', docNumber: '1020304050', esTitular: true, nroReserva: 'XK7P2Q', asientos: [{ tramo: 1, asiento: '14A' }, { tramo: 2, asiento: '9A' }] },
      { name: 'Andrés Gómez', docNumber: '1020304051', nroReserva: 'XK7P2Q', asientos: [{ tramo: 1, asiento: '14B' }, { tramo: 2, asiento: '9B' }] },
    ],
  }],
  hotelData: [{
    hotelName: 'Hotel Caribe', destination: 'Cartagena', hotelType: 'hotel', reservationNumber: 'HC-55821',
    startDate: '2026-12-18T20:00:00Z', endDate: '2026-12-23T16:00:00Z', guests: [{ name: 'Laura Gómez' }, { name: 'Andrés Gómez' }],
  }],
};
