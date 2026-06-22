// National Weather Service API helper
// Monitors Colorado Front Range for hail and severe storms

const NWS_BASE = "https://api.weather.gov";

export const FRONT_RANGE_CITIES = [
  "Denver", "Boulder", "Fort Collins", "Colorado Springs", "Longmont",
  "Loveland", "Broomfield", "Thornton", "Arvada", "Westminster",
  "Lakewood", "Aurora", "Castle Rock", "Parker", "Littleton",
  "Golden", "Brighton", "Greeley", "Erie", "Frederick",
  "Firestone", "Dacono", "Mead", "Berthoud", "Windsor"
];

// Maps UGC county codes (COC001 etc.) → sample zip codes for that county
// Covers all Front Range counties in Colorado
const UGC_TO_ZIPS: Record<string, string[]> = {
  "COC001": ["80401", "80403", "80419"],           // Adams — wait, 001 is Adams
  "COC005": ["80001", "80002", "80003", "80004"],  // Arapahoe
  "COC013": ["80021", "80023", "80023"],            // Broomfield
  "COC014": ["80301", "80302", "80303", "80305"],  // Boulder
  "COC019": ["80104", "80108", "80109"],            // Castle Rock / Douglas
  "COC031": ["80201", "80202", "80203", "80204", "80205", "80206", "80207", "80208", "80209", "80210", "80211", "80212", "80216", "80218", "80219", "80220", "80221", "80222", "80223", "80224", "80226", "80227", "80228", "80229", "80230", "80231", "80232", "80233", "80234", "80235", "80236", "80237", "80238", "80239", "80241", "80246", "80247", "80249", "80250", "80260"], // Denver
  "COC035": ["80521", "80522", "80524", "80525", "80526", "80528"], // Fort Collins / Larimer
  "COC041": ["80631", "80634", "80638", "80639"],  // Greeley / Weld
  "COC059": ["80401", "80403", "80419", "80433", "80470"], // Jefferson
  "COC123": ["80002", "80003", "80004", "80005", "80007"], // Arvada / Jefferson
};

export interface StormAlert {
  nws_id: string;
  event: string;
  headline: string;
  severity: string;
  areas: string;
  affected_cities: string[];
  affected_zips: string[];
  description: string;
  onset: string;
  expires: string;
  has_hail: boolean;
  hail_size_text: string;
  hail_size_inches: number;
}

// Maps common hail size descriptions to inches
// NWS LSRs use these standard descriptions
const HAIL_SIZE_WORDS: [RegExp, number][] = [
  [/pea/i, 0.25],
  [/marble/i, 0.5],
  [/penny|1 cent/i, 0.75],
  [/nickel/i, 0.88],
  [/quarter/i, 1.0],
  [/half.?dollar/i, 1.25],
  [/ping.?pong/i, 1.5],
  [/golf.?ball/i, 1.75],
  [/hen.?egg/i, 2.0],
  [/tennis.?ball/i, 2.5],
  [/baseball/i, 2.75],
  [/grapefruit/i, 4.0],
  [/softball/i, 4.5],
];

export function parseHailSize(text: string): { text: string; inches: number } {
  const lower = text.toLowerCase();

  // Check word descriptors first
  for (const [pattern, inches] of HAIL_SIZE_WORDS) {
    if (pattern.test(lower)) {
      const match = lower.match(pattern);
      return { text: match ? `${match[0]}-sized hail` : "hail", inches };
    }
  }

  // Try numeric pattern: "1.75 inch", "1 1/2 inch", "up to 2 inches"
  const numMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:to\s+\d+(?:\.\d+)?\s*)?inch/i);
  if (numMatch) {
    const inches = parseFloat(numMatch[1]);
    return { text: `${inches}-inch hail`, inches };
  }

  // Fraction: "3/4 inch"
  const fracMatch = lower.match(/(\d+)\/(\d+)\s*inch/i);
  if (fracMatch) {
    const inches = parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    return { text: `${fracMatch[1]}/${fracMatch[2]}-inch hail`, inches };
  }

  if (lower.includes("hail")) return { text: "hail", inches: 0.75 };
  return { text: "", inches: 0 };
}

function extractZips(properties: Record<string, unknown>): string[] {
  const zips = new Set<string>();

  // From geocode.UGC codes
  const geocode = properties.geocode as Record<string, string[]> | undefined;
  const ugcCodes = geocode?.UGC || [];
  for (const ugc of ugcCodes) {
    const mapped = UGC_TO_ZIPS[ugc];
    if (mapped) for (const z of mapped) zips.add(z);
  }

  // From description text — NWS sometimes lists zip codes
  const desc = String(properties.description || "");
  const zipMatches = desc.match(/\b(8\d{4})\b/g);
  if (zipMatches) for (const z of zipMatches) zips.add(z);

  return [...zips];
}

export async function fetchColoradoAlerts(): Promise<StormAlert[]> {
  const res = await fetch(`${NWS_BASE}/alerts/active?area=CO`, {
    headers: { "User-Agent": "FaradayConstruction/1.0 (leads@faradayconstruction.com)" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error("NWS API error:", res.status);
    return [];
  }

  const data = await res.json();
  const features: unknown[] = data.features || [];

  return features
    .filter((f) => {
      const props = (f as { properties?: Record<string, unknown> }).properties || {};
      const event = String(props.event || "").toLowerCase();
      const severity = props.severity as string;
      return (
        (severity === "Severe" || severity === "Extreme") &&
        (event.includes("hail") ||
          event.includes("thunderstorm") ||
          event.includes("tornado") ||
          event.includes("wind") ||
          event.includes("storm"))
      );
    })
    .map((f) => {
      const props = (f as { properties?: Record<string, unknown>; id?: string }).properties || {};
      const desc = String(props.description || "");
      const areas = String(props.areaDesc || "");

      const affectedCities = FRONT_RANGE_CITIES.filter(
        (city) =>
          areas.toLowerCase().includes(city.toLowerCase()) ||
          desc.toLowerCase().includes(city.toLowerCase())
      );

      const fullText = `${desc} ${String(props.headline || "")} ${String(props.event || "")}`;
      const hasHail = /hail/i.test(fullText);
      const { text: hailText, inches: hailInches } = parseHailSize(desc);

      return {
        nws_id: String(props.id || (f as { id?: string }).id || ""),
        event: String(props.event || ""),
        headline: String(props.headline || ""),
        severity: String(props.severity || ""),
        areas: areas.slice(0, 500),
        affected_cities: affectedCities,
        affected_zips: extractZips(props),
        description: desc.slice(0, 1000),
        onset: String(props.onset || ""),
        expires: String(props.expires || ""),
        has_hail: hasHail,
        hail_size_text: hailText,
        hail_size_inches: hailInches,
      };
    });
}

export function isRelevantToFrontRange(alert: StormAlert): boolean {
  return alert.affected_cities.length > 0 || alert.has_hail;
}

export async function fetchColoradoWatches(): Promise<StormAlert[]> {
  const all = await fetchColoradoAlerts();
  return all.filter(a => a.event.toLowerCase().includes("watch"));
}

export function isWatch(alert: StormAlert): boolean {
  return alert.event.toLowerCase().includes("watch");
}
