import re

path = 'c:/Users/graci/Desktop/Projects/db_nexus/DB NEXUS SOFT/nexus_soft/frontend/src/components/sales/forms/TicketForm.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Reemplazar Pasajeros
pax_regex = r'\{\/\* 📌 Información de Pasajeros.*?\n        </div>'
replacement_pax = '''{/* 📌 Información de Pasajeros (Delegado a Submódulo) */}
        <PassengerManager 
          passengers={ticket.passengers || (ticket as any).passengerInfo ? [{ ...(ticket as any).passengerInfo, esTitular: true, asiento: '', nroReserva: '', nroTiquete: '' }] : []}
          clients={clients}
          documentTypes={data?.config?.documentTypes || []}
          onChange={(pax) => onChange({ passengers: pax })}
        />'''
content = re.sub(pax_regex, replacement_pax, content, flags=re.DOTALL)

# Reemplazar Vuelos
flight_regex = r'\{\/\* 📌 Itinerario de Vuelos.*?\n          </div>\n        </div>'
replacement_flight = '''{/* 📌 Itinerario de Vuelos (Delegado a Submódulo) */}
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
        />'''
content = re.sub(flight_regex, replacement_flight, content, flags=re.DOTALL)

# Injectar los imports al principio
import_str = '''import { PassengerManager } from "./subcomponents/PassengerManager";
import { FlightLegsManager } from "./subcomponents/FlightLegsManager";
import { useData } from "../../../context/DataContext";'''

content = content.replace('import { TicketData, FlightLeg } from "../../../types";', 'import { TicketData, FlightLeg } from "../../../types";\n' + import_str)
content = content.replace('export function TicketForm({ ticket, onChange, airlines, suppliers, airports, paymentMethods, baggage, clients }: TicketFormProps) {', 'export function TicketForm({ ticket, onChange, airlines, suppliers, airports, paymentMethods, baggage, clients }: TicketFormProps) {\n  const { data } = useData();')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
