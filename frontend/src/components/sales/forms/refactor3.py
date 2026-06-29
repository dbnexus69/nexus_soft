path = 'c:/Users/graci/Desktop/Projects/db_nexus/DB NEXUS SOFT/nexus_soft/frontend/src/components/sales/forms/TicketForm.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('{/* 👥 Información de Pasajeros')
if start == -1:
    print("No encontro inicio pasajeros")
else:
    end = content.find('{/* ✈️ Itinerario de Vuelos', start)
    if end == -1:
        print("No encontro inicio de vuelos")
    else:
        replacement = '''{/* 👥 Información de Pasajeros (Delegado a Submódulo) */}
        <PassengerManager 
          passengers={ticket.passengers || (ticket as any).passengerInfo ? [{ ...(ticket as any).passengerInfo, esTitular: true, asiento: '', nroReserva: '', nroTiquete: '' }] : []}
          clients={clients}
          documentTypes={data?.config?.documentTypes || []}
          onChange={(pax) => onChange({ passengers: pax })}
        />
        '''
        content = content[:start] + replacement + content[end:]
        print("Reemplazado pasajeros.")

start_flight = content.find('{/* ✈️ Itinerario de Vuelos')
if start_flight != -1:
    end_flight = content.find('{/* 💵 Condiciones Financieras', start_flight)
    if end_flight != -1:
        replacement = '''{/* ✈️ Itinerario de Vuelos (Delegado a Submódulo) */}
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
        content = content[:start_flight] + replacement + content[end_flight:]
        print("Reemplazado vuelos.")

import_str = '''import { PassengerManager } from "./subcomponents/PassengerManager";
import { FlightLegsManager } from "./subcomponents/FlightLegsManager";
import { useData } from "../../../context/DataContext";'''

content = content.replace('import { TicketData, FlightLeg } from "../../../types";', 'import { TicketData, FlightLeg } from "../../../types";\n' + import_str)
content = content.replace('export function TicketForm({ ticket, onChange, airlines, suppliers, airports, paymentMethods, baggage, clients }: TicketFormProps) {', 'export function TicketForm({ ticket, onChange, airlines, suppliers, airports, paymentMethods, baggage, clients }: TicketFormProps) {\n  const { data } = useData();')


with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
