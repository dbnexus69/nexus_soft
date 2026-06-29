const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../errors/AppError');

const CATEGORIES = {
  ticket: 'tiqueteria', hotel: 'hoteleria', insurance: 'seguros_viaje',
  plan: 'planes', checkin: 'checkin', migration: 'documentacion_migratoria',
  simcard: 'simcard', carRental: 'renta_vehiculos', finca: 'renta_fincas',
  tour: 'tours', convention: 'centros_convencion', restaurant: 'restaurantes',
  visa: 'visa', passport: 'pasaporte', petService: 'servicio_mascotas'
};

class ProductsService {
  async findOrCreatePersona(tx, name, docType, docNumber, defaultPersonaId) {
    if (!name && !docNumber) return defaultPersonaId || null;
    if (docNumber) {
      const match = await tx.personas.findUnique({ where: { documento: String(docNumber) } });
      if (match) return match.id;
    }
    const nameParts = (name || '').trim().split(/\s+/);
    const nombres = nameParts[0] || 'Pasajero';
    const apellidos = nameParts.slice(1).join(' ') || 'Temporal';
    let tipo_documento_id = null;
    if (docType) {
      const td = await tx.tipos_documento.findUnique({ where: { abreviatura: String(docType) } });
      if (td) tipo_documento_id = td.id;
    }
    const newPersona = await tx.personas.create({
      data: { nombres, apellidos, tipo_documento_id, documento: docNumber ? String(docNumber) : null, status: 'active' }
    });
    return newPersona.id;
  }

  async getSale(saleId) {
    const id = parseInt(saleId);
    const venta = await prisma.ventas.findUnique({ where: { id } });
    if (!venta) throw new NotFoundError('Venta no encontrada');
    return venta;
  }

  async createDetalleProducto(tx, venta_id, categoria, data) {
    return tx.detalleVenta.create({
      data: {
        venta_id,
        categoria,
        nombreServicio: data.nombreServicio || null,
        subtotal: data.subtotal || 0,
        ta: data.ta || 0,
        costoProveedor: data.supplierCost || 0,
        proveedorId: data.supplierId ? parseInt(data.supplierId) : null,
        metodoPagoProveedorId: data.supplierPaymentMethod ? parseInt(data.supplierPaymentMethod) : null,
        voucherUrl: data.voucherUrl || null,
        fechaInicioViaje: data.startDate ? new Date(data.startDate) : null,
        fechaFinViaje: data.endDate ? new Date(data.endDate) : null,
        origen: data.origin || null,
        destino: data.destination || null,
        observaciones: data.observations || null
      }
    });
  }

  async uploadVoucher(saleId, category, productId, file) {
    if (!file) throw new BadRequestError('Archivo requerido');
    const actualCategory = CATEGORIES[category] || category;
    const detalle = await prisma.detalleVenta.findFirst({
      where: { venta_id: parseInt(saleId), categoria: actualCategory }
    });
    if (!detalle) throw new NotFoundError('Detalle de venta no encontrado');

    const voucherUrl = `/uploads/${file.filename}`;
    await prisma.detalleVenta.update({
      where: { id: detalle.id },
      data: { voucherUrl }
    });

    return { voucherUrl };
  }
}

module.exports = new ProductsService();
