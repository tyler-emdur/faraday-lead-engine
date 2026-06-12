// National Weather Service API helper
// Monitors Colorado Front Range for hail and severe storms

const NWS_BASE = "https://api.weather.gov";

// Front Range cities and their approximate zip codes
export const FRONT_RANGE_CITIES = [
  "Denver", "Boulder", "Fort Collins", "Colorado Springs", "Longmont",
  "Loveland", "Broomfield", "Thornton", "Arvada", "Westminster",
  "Lakewood", "Aurora", "Castle Rock", "Parker", "Littleton",
  "Golden", "Brighton", "Greeley", "Erie", "Frederick",
  "Firestone", "Dacono", "Mead", "Berthoud", "Windsor"
];

export interface StormAlert {
  nws_id: string;
  event: string;
  headline: string;
  severity: string;
  areas: string;
  affected_cities: string[];
  description: string;
  onset: string;
  expires: string;
  has_hail: boolean;
}

export async function fetchColoradoAlerts(): Promise<StormAlert[]> {
  const res = await fetch(`${NWS_BASE}/alerts/active?area=CO`, {
    headers: { "User-Agent": "FaradayConstruction/1.0 (leads@faradayconstruction.com)" },
    next: { revalidate: 0 }, // No cache
  });

  if (!res.ok) {
    console.error("NWS API error:", res.status);
    return [];
  }

  const data = await res.json();
  const features = data.features || [];

  // Filter for severe weather relevant to roofing
  return features
    .filter((f: any) => {
      const event = (f.properties?.event || "").toLowerCase();
      const severity = f.properties?.severity;
      return (
        (severity === "Severe" || severity === "Extreme") &&
        (event.includes("hail") ||
          event.includes("thunderstorm") ||
          event.includes("tornado") ||
          event.includes("wind") ||
          event.includes("storm"))
      );
    })
    .map((f: any) => {
      const desc = (f.properties?.description || "").toLowerCase();
      const areas = f.properties?.areaDesc || "";

      // Check if any Front Range cities are in the affected area
      const affectedCities = FRONT_RANGE_CITIES.filter(
        (city) =>
          areas.toLowerCase().includes(city.toLowerCase()) ||
          desc.includes(city.toLowerCase())
      );

      // Check for hail specifically
      const hasHail =
        desc.includes("hail") ||
        (f.properties?.event || "").toLowerCase().includes("hail") ||
        (f.properties?.headline || "").toLowerCase().includes("hail");

      return {
        nws_id: f.properties?.id || f.id,
        event: f.properties?.event,
        headline: f.properties?.headline,
        severity: f.properties?.severity,
        areas: areas.slice(0, 500),
        affected_cities: affectedCities,
        description: (f.properties?.description || "").slice(0, 1000),
        onset: f.properties?.onset,
        expires: f.properties?.expires,
        has_hail: hasHail,
      };
    });
}

// Check if a storm alert affects the Front Range
export function isRelevantToFrontRange(alert: StormAlert): boolean {
  return alert.affected_cities.length > 0 || alert.has_hail;
}
