path = 'c:/Users/graci/Desktop/Projects/db_nexus/DB NEXUS SOFT/nexus_soft/frontend/src/components/sales/forms/TicketForm.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_flight = content.find('{/* ── TABS Tipo de Vuelo')
end_flight = content.find('{/* ── Información de Pasajeros', start_flight)

if start_flight != -1 and end_flight != -1:
    replacement_flight = '''{/* ── Itinerario de Vuelos (Delegado a Submódulo) ── */}
        <FlightLegsManager
          flightMode={ticket.flightMode}
          hasStops={ticket.hasStops}
          returnHasStops={ticket.returnHasStops}
          legs={ticket.legs}
          outboundStops={ticket.outboundStops}
          returnLeg={ticket.returnLeg}
          returnStops={ticket.returnStops}
          airports={airports}
          onChange={(field, value) => onChange({ [field]: value })}
        />
        
      '''
    content = content[:start_flight] + replacement_flight + content[end_flight:]
    print("Vuelos reemplazados.")

start_pax = content.find('{/* ── Información de Pasajeros')
end_pax = content.find('{/* ── Detalles Financieros', start_pax)

if start_pax != -1 and end_pax != -1:
    replacement_pax = '''{/* ── Información de Pasajeros (Delegado a Submódulo) ── */}
        <PassengerManager 
          passengers={ticket.passengers || (ticket as any).passengerInfo ? [{ ...(ticket as any).passengerInfo, esTitular: true, asiento: '', nroReserva: '', nroTiquete: '' }] : []}
          clients={clients}
          documentTypes={data?.config?.documentTypes || []}
          onChange={(pax) => onChange({ passengers: pax })}
        />
        
      '''
    content = content[:start_pax] + replacement_pax + content[end_pax:]
    print("Pasajeros reemplazados.")

import_str = '''import { PassengerManager } from "./subcomponents/PassengerManager";
import { FlightLegsManager } from "./subcomponents/FlightLegsManager";
import { useData } from "../../../context/DataContext";'''

content = content.replace('import { TicketData, FlightLeg } from "../../../types";', 'import { TicketData, FlightLeg } from "../../../types";\n' + import_str)
content = content.replace('export function TicketForm({ ticket, onChange, airlines, suppliers, airports, paymentMethods, baggage, clients }: TicketFormProps) {', 'export function TicketForm({ ticket, onChange, airlines, suppliers, airports, paymentMethods, baggage, clients }: TicketFormProps) {\n  const { data } = useData();')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
