export type AirportInfo = {
  city: string;
  name: string;
};

export function buildAirportMap(
  airports: { abbreviation?: string; name?: string; city?: string }[]
): Record<string, AirportInfo> {
  const map: Record<string, AirportInfo> = {};
  for (const a of airports) {
    if (a.abbreviation && a.city && a.name) {
      map[a.abbreviation] = { city: a.city, name: a.name };
    }
  }
  return map;
}
