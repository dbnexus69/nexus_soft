import React from 'react';
import { Plane, Building2, ShieldCheck, Package } from 'lucide-react';

/**
 * Patrón Estrategia: Registry de Detalles de Productos
 * 
 * En lugar de utilizar un switch(product.type) de miles de líneas en ProductDetailsModal,
 * registraremos componentes modulares aquí.
 */

export type ProductType = "Tiquetería" | "Hotelería" | "Seguros de Viaje" | "Planes";

export interface DetailRendererProps {
  data: any[];
  airportMap?: Record<string, any>;
  formatDate: (d: string) => string;
  formatTimeAMPM: (t: string) => string;
}

export const DetailsRegistry: Record<string, React.FC<DetailRendererProps>> = {
  // Ej: "Tiquetería": TicketDetailRenderer,
  // Ej: "Hotelería": HotelDetailRenderer,
};

// Utilidad para extraer componentes
export const renderProductDetail = (type: string, props: DetailRendererProps) => {
  const Renderer = DetailsRegistry[type];
  if (!Renderer) {
    return <div className="text-gray-500 p-4 bg-gray-50 rounded-lg">Renderizador para {type} en desarrollo.</div>;
  }
  return <Renderer {...props} />;
};
