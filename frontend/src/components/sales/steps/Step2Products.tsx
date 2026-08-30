import { ShoppingBag, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "../../ui/Button";
import * as LuIcons from "react-icons/lu";
import { SALE_PRODUCTS, SaleProductId } from "../../../types";
import { 
  PRODUCT_IMAGES, 
  INITIAL_TICKET, 
  INITIAL_HOTEL, 
  INITIAL_INSURANCE, 
  INITIAL_PLAN, 
  INITIAL_CHECKIN, 
  INITIAL_MIGRATION, 
  INITIAL_SIMCARD, 
  INITIAL_CAR_RENTAL, 
  INITIAL_FINCA, 
  INITIAL_TOUR, 
  INITIAL_CONVENTION, 
  INITIAL_RESTAURANT, 
  INITIAL_VISA, 
  INITIAL_PASSPORT, 
  INITIAL_PET_SERVICE 
} from "../wizardData";

function ProductIcon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const IconComponent = (LuIcons as any)[name];
  if (!IconComponent) return null;
  return <IconComponent size={size} className={className} />;
}

export function Step2Products({ form, set, data, errors, toggleProduct, actions }: any) {
  const {
    showOtherProducts, setShowOtherProducts,
    activeForm, activeIdx,
    openForm
  } = actions;

  const client = form.clientData;

  const mainProducts = SALE_PRODUCTS.filter((p) =>
    ["ticket", "hotel", "insurance", "plan"].includes(p.id)
  );
  const otherProducts = SALE_PRODUCTS.filter(
    (p) => !["ticket", "hotel", "insurance", "plan"].includes(p.id)
  );

  const handleAddAnotherProduct = (productId: SaleProductId, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let targetKey: string | null = null;
    let initialFn: any = null;

    switch (productId) {
      case "ticket": targetKey = "tickets"; initialFn = INITIAL_TICKET; break;
      case "hotel": targetKey = "hotels"; initialFn = INITIAL_HOTEL; break;
      case "insurance": targetKey = "insurances"; initialFn = INITIAL_INSURANCE; break;
      case "plan": targetKey = "plans"; initialFn = INITIAL_PLAN; break;
      case "checkin": targetKey = "checkIns"; initialFn = INITIAL_CHECKIN; break;
      case "migration": targetKey = "migrations"; initialFn = INITIAL_MIGRATION; break;
      case "simcard": targetKey = "simCards"; initialFn = INITIAL_SIMCARD; break;
      case "car": targetKey = "carRentals"; initialFn = INITIAL_CAR_RENTAL; break;
      case "finca": targetKey = "fincas"; initialFn = INITIAL_FINCA; break;
      case "tour": targetKey = "tours"; initialFn = INITIAL_TOUR; break;
      case "convention": targetKey = "conventions"; initialFn = INITIAL_CONVENTION; break;
      case "restaurant": targetKey = "restaurants"; initialFn = INITIAL_RESTAURANT; break;
      case "visa": targetKey = "visas"; initialFn = INITIAL_VISA; break;
      case "passport": targetKey = "passports"; initialFn = INITIAL_PASSPORT; break;
      case "pet": targetKey = "petServices"; initialFn = INITIAL_PET_SERVICE; break;
    }

    if (targetKey && initialFn) {
      if (!form.selectedProducts.includes(productId)) {
        toggleProduct(productId);
      }
      const currentItems = [...((form as any)[targetKey] || [])];
      const newItem = initialFn(client);
      const newIdx = currentItems.length;
      currentItems.push(newItem);
      set(targetKey, currentItems);
      openForm(productId, newIdx);
    }
  };

  const handleProductClick = (productId: SaleProductId) => {
    const isSelected = form.selectedProducts.includes(productId);
    
    if (!isSelected) {
      toggleProduct(productId);
    }

    let targetKey: string | null = null;
    let initialFn: any = null;

    switch (productId) {
      case "ticket": targetKey = "tickets"; initialFn = INITIAL_TICKET; break;
      case "hotel": targetKey = "hotels"; initialFn = INITIAL_HOTEL; break;
      case "insurance": targetKey = "insurances"; initialFn = INITIAL_INSURANCE; break;
      case "plan": targetKey = "plans"; initialFn = INITIAL_PLAN; break;
      case "checkin": targetKey = "checkIns"; initialFn = INITIAL_CHECKIN; break;
      case "migration": targetKey = "migrations"; initialFn = INITIAL_MIGRATION; break;
      case "simcard": targetKey = "simCards"; initialFn = INITIAL_SIMCARD; break;
      case "car": targetKey = "carRentals"; initialFn = INITIAL_CAR_RENTAL; break;
      case "finca": targetKey = "fincas"; initialFn = INITIAL_FINCA; break;
      case "tour": targetKey = "tours"; initialFn = INITIAL_TOUR; break;
      case "convention": targetKey = "conventions"; initialFn = INITIAL_CONVENTION; break;
      case "restaurant": targetKey = "restaurants"; initialFn = INITIAL_RESTAURANT; break;
      case "visa": targetKey = "visas"; initialFn = INITIAL_VISA; break;
      case "passport": targetKey = "passports"; initialFn = INITIAL_PASSPORT; break;
      case "pet": targetKey = "petServices"; initialFn = INITIAL_PET_SERVICE; break;
    }

    if (targetKey && initialFn) {
      const currentItems = (form as any)[targetKey] || [];
      if (currentItems.length === 0) {
        const newItem = initialFn(client);
        set(targetKey, [newItem]);
        openForm(productId, 0);
      } else {
        openForm(productId, 0);
      }
    }
  };

  const getActiveItems = () => {
    const items: { id: SaleProductId; label: string; count: number; icon: string }[] = [];
    
    SALE_PRODUCTS.forEach(p => {
      let count = 0;
      switch (p.id) {
        case "ticket": count = form.tickets.length; break;
        case "hotel": count = form.hotels.length; break;
        case "insurance": count = form.insurances.length; break;
        case "plan": count = form.plans.length; break;
        case "checkin": count = form.checkIns.length; break;
        case "migration": count = form.migrations.length; break;
        case "simcard": count = form.simCards.length; break;
        case "car": count = form.carRentals.length; break;
        case "finca": count = form.fincas.length; break;
        case "tour": count = form.tours.length; break;
        case "convention": count = form.conventions.length; break;
        case "restaurant": count = form.restaurants.length; break;
        case "visa": count = form.visas.length; break;
        case "passport": count = form.passports.length; break;
        case "pet": count = form.petServices.length; break;
      }
      if (count > 0) {
        items.push({ id: p.id, label: p.label, count, icon: p.icon });
      }
    });
    return items;
  };

  return (
    <div className="animate-fade-in space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ShoppingBag size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-primary text-base">
              Productos y Servicios
            </h3>
            <p className="text-xs text-gray-500">
              Selecciona los productos que el cliente desea adquirir.
            </p>
          </div>
        </div>

        {errors.products && (
          <p className="text-sm text-red-500 font-medium bg-red-50 px-3 py-2 rounded-lg border border-red-100">
            {errors.products}
          </p>
        )}

        {/* Main Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {mainProducts.map((product) => {
            const selected = form.selectedProducts.includes(product.id);
            return (
              <div
                key={product.id}
                onClick={() => handleProductClick(product.id)}
                className={`
                  cursor-pointer relative flex flex-col items-center gap-0 p-0 rounded-2xl border-2 overflow-hidden
                  transition-all duration-300 group h-full
                  ${selected
                    ? "border-primary bg-primary/5 shadow-xl shadow-primary/10 ring-4 ring-primary/10"
                    : "border-gray-100 bg-white hover:border-primary/40 hover:shadow-lg"
                  }
                `}
              >
                <div className="w-full aspect-[4/3] bg-gray-50 overflow-hidden relative">
                  {PRODUCT_IMAGES[product.id] ? (
                    <img
                      src={PRODUCT_IMAGES[product.id]}
                      alt={product.label}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-primary/40">
                      <ProductIcon name={product.icon} size={48} />
                    </div>
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                  {(() => {
                    const keyMap: Record<string, string> = {
                      ticket: "tickets", hoteleria: "hotels", seguros_viaje: "insurances", planes: "plans",
                      checkin: "checkIns", documentacion_migratoria: "migrations", simcard: "simCards",
                      car: "carRentals", renta_fincas: "fincas", tours: "tour",
                      convention: "conventions", restaurantes: "restaurants", visa: "visas",
                      passport: "passports", servicio_mascotas: "petServices"
                    };
                    const targetKey = keyMap[product.id];
                    const count = targetKey ? ((form as any)[targetKey]?.length || 0) : 0;
                    if (count === 0) return null;
                    return (
                      <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md border border-white/20">
                        {count} {count === 1 ? 'añadido' : 'añadidos'}
                      </div>
                    );
                  })()}
                  {selected && (
                    <div className="absolute top-3 right-3 bg-primary text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-scale-in">
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="p-4 w-full text-center">
                  <h4 className={`font-bold transition-colors ${selected ? 'text-primary' : 'text-gray-700'}`}>
                    {product.label}
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                    {selected ? 'Configurar' : 'Añadir servicio'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Other Products Section */}
        <div className="pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowOtherProducts(!showOtherProducts)}
            className="flex items-center gap-2 text-primary font-bold text-sm hover:underline"
          >
            {showOtherProducts ? <LuIcons.LuChevronUp size={16} /> : <LuIcons.LuChevronDown size={16} />}
            Otros Productos y Servicios
          </button>

          {showOtherProducts && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 animate-slide-down">
              {otherProducts.map((product) => {
                const selected = form.selectedProducts.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductClick(product.id)}
                    className={`
                      flex items-center gap-2 p-3 rounded-xl border text-left transition-all w-full
                      ${
                        selected
                          ? "bg-primary border-primary text-white shadow-md shadow-primary/10"
                          : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-primary/40"
                      }
                    `}
                  >
                    <span className="text-lg flex-shrink-0">
                      <ProductIcon name={product.icon} size={18} className={selected ? "text-white" : "text-gray-400"} />
                    </span>
                    <span
                      className={`text-xs font-medium leading-tight ${
                        selected ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {product.label}
                    </span>
                    {selected && (
                      <Check
                        size={14}
                        className="text-white ml-auto flex-shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Services Summary */}
        <div className="pt-6 border-t border-gray-100">
          <h3 className="font-bold text-primary text-sm flex items-center gap-2 mb-4">
             <LuIcons.LuListTodo size={16} /> Servicios en esta Venta
          </h3>
          
          <div className="space-y-2">
            {(() => {
              const allItems: any[] = [];
              SALE_PRODUCTS.forEach(p => {
                let itemsList: any[] = [];
                let targetKey = "";
                switch (p.id) {
                  case "ticket": itemsList = form.tickets; targetKey = "tickets"; break;
                  case "hotel": itemsList = form.hotels; targetKey = "hotels"; break;
                  case "insurance": itemsList = form.insurances; targetKey = "insurances"; break;
                  case "plan": itemsList = form.plans; targetKey = "plans"; break;
                  case "checkin": itemsList = form.checkIns; targetKey = "checkIns"; break;
                  case "migration": itemsList = form.migrations; targetKey = "migrations"; break;
                  case "simcard": itemsList = form.simCards; targetKey = "simCards"; break;
                  case "car": itemsList = form.carRentals; targetKey = "carRentals"; break;
                  case "finca": itemsList = form.fincas; targetKey = "fincas"; break;
                  case "tour": itemsList = form.tours; targetKey = "tours"; break;
                  case "convention": itemsList = form.conventions; targetKey = "conventions"; break;
                  case "restaurant": itemsList = form.restaurants; targetKey = "restaurants"; break;
                  case "visa": itemsList = form.visas; targetKey = "visas"; break;
                  case "passport": itemsList = form.passports; targetKey = "passports"; break;
                  case "pet": itemsList = form.petServices; targetKey = "petServices"; break;
                }
                
                itemsList.forEach((item, idx) => {
                  allItems.push({
                    productId: p.id,
                    label: p.label,
                    icon: p.icon,
                    idx,
                    targetKey,
                    linkedToPlanIndex: (item as any).linkedToPlanIndex,
                    // Try to get a descriptive name from the item data
                    detail: (item as any).hotelName || (item as any).planName || (item as any).passengerName || (item as any).passengerInfo?.name || (item as any).petName || (item as any).ownerName || (item as any).mainDriver || "Información pendiente"
                  });
                });
              });

              if (allItems.length === 0) {
                return (
                  <div className="text-center py-10 bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-6 animate-fade-in">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-2xs">
                      <LuIcons.LuPackagePlus size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">No hay servicios seleccionados aún</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Haz clic en una de las tarjetas superiores (Tiquetería, Hotelería, Paquetes, etc.) para agregar el primer servicio a esta venta.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {allItems.map((item, i) => (
                    <div key={`${item.productId}-${item.idx}`} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                          <ProductIcon name={item.icon} size={16} />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-primary truncate">{item.label} #{item.idx + 1}</p>
                            {item.linkedToPlanIndex !== undefined && item.linkedToPlanIndex !== null && (
                              <span className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold shrink-0">
                                🔗 Paquete #{item.linkedToPlanIndex + 1}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-gray-400 truncate">{item.detail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openForm(item.productId, item.idx)}
                          className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                          title="Editar"
                        >
                          <LuIcons.LuPencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            const nextItems = [...(form as any)[item.targetKey]];
                            nextItems.splice(item.idx, 1);
                            set(item.targetKey, nextItems);
                            
                            // If it was the last item, deselect the product
                            if (nextItems.length === 0) {
                              toggleProduct(item.productId);
                            }
                            
                            // Close active form if we just deleted it
                            if (activeForm === item.productId && activeIdx === item.idx) {
                              openForm(null, null);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <LuIcons.LuTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Botones para agregar múltiples ítems (Tiquete 2, Hotel 2, Tour 2, etc.) */}
            {form.selectedProducts.length > 0 && (
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">
                  + Agregar ítems adicionales (Tiquete 2, Hotel 2, Tour 2, etc.):
                </label>
                <div className="flex flex-wrap gap-2">
                  {SALE_PRODUCTS.filter(p => form.selectedProducts.includes(p.id)).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => handleAddAnotherProduct(p.id, e)}
                      className="px-3 py-1.5 text-xs font-semibold bg-primary/5 text-primary border border-primary/20 rounded-xl hover:bg-primary/10 transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <LuIcons.LuPlus size={14} />
                      <span>+ Agregar otro {p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
