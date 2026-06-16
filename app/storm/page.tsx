// Storm War Room — Tyler's command center when hail hits
// Shows active alerts, watches, affected-city posting links, recent leads, performance history
import type { Metadata } from "next";
import CopyBlock from "@/components/CopyBlock";
import { scoreNeighborhoods } from "@/lib/saturation";
import StormLiveStatus from "@/components/StormLiveStatus";

export const metadata: Metadata = {
  title: "Storm War Room — Faraday Leads",
  robots: "noindex",
};

export const revalidate = 180;

// ─── NWS ──────────────────────────────────────────────────────────────────────

interface NWSAlert {
  properties: {
    id: string;
    event: string;
    headline: string;
    description: string;
    areaDesc: string;
    sent: string;
    expires: string;
    severity: string;
    parameters?: { hailSize?: string[]; maxHailSize?: string[] };
  };
}

const FRONT_RANGE = [
  "Denver","Boulder","Fort Collins","Colorado Springs","Longmont","Loveland",
  "Broomfield","Thornton","Arvada","Westminster","Lakewood","Aurora",
  "Castle Rock","Parker","Littleton","Golden","Brighton","Greeley",
  "Erie","Frederick","Firestone","Dacono","Mead","Berthoud","Windsor",
  "Highlands Ranch","Centennial","Englewood","Wheat Ridge","Lafayette",
  "Louisville","Superior","Niwot","Evans","Milliken","Johnstown","Timnath",
];

async function fetchAlerts(): Promise<{ warnings: NWSAlert[]; watches: NWSAlert[] }> {
  try {
    const res = await fetch("https://api.weather.gov/alerts/active?area=CO", {
      headers: { "User-Agent": "FaradayLeads/1.0" },
      next: { revalidate: 180 },
    });
    if (!res.ok) return { warnings: [], watches: [] };
    const data = await res.json();
    const stormEvents = ["severe thunderstorm","hail","tornado","wind","storm"];
    const relevant = (data.features || []).filter((f: NWSAlert) =>
      stormEvents.some(e => f.properties.event.toLowerCase().includes(e))
    );
    const warnings = relevant.filter((f: NWSAlert) => !f.properties.event.toLowerCase().includes("watch"));
    const watches  = relevant.filter((f: NWSAlert) =>  f.properties.event.toLowerCase().includes("watch"));
    return { warnings, watches };
  } catch {
    return { warnings: [], watches: [] };
  }
}

function extractHailSize(a: NWSAlert): string | null {
  const p = a.properties.parameters;
  if (p?.hailSize?.[0]) return p.hailSize[0];
  if (p?.maxHailSize?.[0]) return p.maxHailSize[0];
  const m = a.properties.description.match(/hail(?:\s+up\s+to)?\s+(\d+(?:\.\d+)?)\s*inch/i);
  return m ? `${m[1]}"` : null;
}

function alertCities(areaDesc: string): string[] {
  return areaDesc.split(";").map(s => s.trim().split(",")[0].trim()).filter(Boolean);
}

function frontRangeCities(areaDesc: string): string[] {
  const all = alertCities(areaDesc);
  const fr = all.filter(c => FRONT_RANGE.some(fr => c.toLowerCase().includes(fr.toLowerCase()) || fr.toLowerCase().includes(c.toLowerCase())));
  return fr.length > 0 ? fr.slice(0, 6) : all.slice(0, 4);
}

function timeAgo(d: string): string {
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return "Just now";
  if (h === 1) return "1 hr ago";
  if (h < 24) return `${h} hrs ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ─── SUPABASE DATA ─────────────────────────────────────────────────────────────

interface LeadRow { city: string | null; name: string | null; service: string | null; created_at: string }

async function fetchRecentLeads(cities: string[]): Promise<LeadRow[]> {
  if (!process.env.SUPABASE_URL || cities.length === 0) return [];
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const since = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data } = await getSupabase()
      .from("leads")
      .select("city,name,service,created_at")
      .in("city", cities)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data as LeadRow[]) || [];
  } catch { return []; }
}

async function fetchCityPerformance(): Promise<{ city: string; count: number }[]> {
  if (!process.env.SUPABASE_URL) return [];
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const since = new Date(Date.now() - 730 * 86400000).toISOString();
    const { data } = await getSupabase()
      .from("leads")
      .select("city")
      .not("city", "is", null)
      .gte("created_at", since)
      .limit(2000);
    if (!data) return [];
    const counts: Record<string, number> = {};
    for (const r of data) {
      if (r.city) counts[r.city] = (counts[r.city] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  } catch { return []; }
}

// ─── COMMUNITY GROUPS ─────────────────────────────────────────────────────────

interface Group { name: string; platform: "Facebook" | "Nextdoor"; url: string; desc: string }

const ALL_GROUPS: { region: string; keywords: string[]; groups: Group[] }[] = [
  {
    region: "Denver Metro",
    keywords: ["denver","englewood","wheat ridge","commerce city","commerce","glendale"],
    groups: [
      { name: "Denver Community Board", platform: "Facebook", url: "https://www.facebook.com/groups/denvercommunityboard", desc: "150K+ members" },
      { name: "Denver Homeowners & Neighbors", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Denver+homeowners+Colorado", desc: "Homeowners focus" },
      { name: "Nextdoor Denver", platform: "Nextdoor", url: "https://nextdoor.com", desc: "Join your local neighborhood" },
    ],
  },
  {
    region: "Boulder / Longmont / Lafayette / Louisville",
    keywords: ["boulder","longmont","lafayette","louisville","superior","niwot","lyons"],
    groups: [
      { name: "Boulder County Community", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Boulder+Colorado+community", desc: "Boulder area hub" },
      { name: "Longmont Community Forum", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Longmont+Colorado+community", desc: "Active local group" },
      { name: "Nextdoor Boulder", platform: "Nextdoor", url: "https://nextdoor.com", desc: "Best for recommendations" },
    ],
  },
  {
    region: "Fort Collins / Loveland / Greeley",
    keywords: ["fort collins","loveland","greeley","windsor","timnath","evans","milliken","johnstown","berthoud"],
    groups: [
      { name: "Fort Collins Community Board", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Fort+Collins+community+board", desc: "Large active group" },
      { name: "Loveland Colorado Community", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Loveland+Colorado+community", desc: "Local community" },
      { name: "Nextdoor NoCo", platform: "Nextdoor", url: "https://nextdoor.com", desc: "Northern Colorado neighborhoods" },
    ],
  },
  {
    region: "Broomfield / Westminster / Arvada / Thornton",
    keywords: ["broomfield","westminster","arvada","thornton","northglenn","federal heights"],
    groups: [
      { name: "Broomfield Community Group", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Broomfield+Colorado+community", desc: "High-value suburb" },
      { name: "Westminster Colorado Neighbors", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Westminster+Colorado+community", desc: "Active local group" },
      { name: "Arvada Community Board", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Arvada+Colorado+community", desc: "Arvada homeowners" },
      { name: "Nextdoor NW Denver suburbs", platform: "Nextdoor", url: "https://nextdoor.com", desc: "Join all neighborhoods" },
    ],
  },
  {
    region: "Aurora / Centennial",
    keywords: ["aurora","centennial"],
    groups: [
      { name: "Aurora Colorado Community", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Aurora+Colorado+community", desc: "Large east-Denver suburb" },
      { name: "Centennial Colorado Neighbors", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Centennial+Colorado+community", desc: "Centennial homeowners" },
      { name: "Nextdoor Aurora", platform: "Nextdoor", url: "https://nextdoor.com", desc: "Aurora neighborhoods" },
    ],
  },
  {
    region: "Parker / Castle Rock / Highlands Ranch / Littleton",
    keywords: ["parker","castle rock","highlands ranch","littleton","lone tree","castle pines"],
    groups: [
      { name: "Parker Colorado Neighbors", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Parker+Colorado+community", desc: "Affluent suburb" },
      { name: "Castle Rock / Highlands Ranch", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Castle+Rock+Colorado+community", desc: "South Denver corridor" },
      { name: "Nextdoor South Denver suburbs", platform: "Nextdoor", url: "https://nextdoor.com", desc: "High-value neighborhoods" },
    ],
  },
  {
    region: "Erie / Frederick / Firestone / Brighton",
    keywords: ["erie","frederick","firestone","dacono","mead","brighton","commerce city"],
    groups: [
      { name: "Erie Colorado Community", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Erie+Colorado+community", desc: "Fast-growing suburb" },
      { name: "Weld County Neighbors", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Weld+County+Colorado+community", desc: "Covers Frederick, Firestone" },
      { name: "Nextdoor NE Colorado", platform: "Nextdoor", url: "https://nextdoor.com", desc: "NE Front Range neighborhoods" },
    ],
  },
  {
    region: "Lakewood / Golden",
    keywords: ["lakewood","golden","edgewater","morrison"],
    groups: [
      { name: "Lakewood Colorado Community", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Lakewood+Colorado+community", desc: "West Denver suburb" },
      { name: "Golden Colorado Neighbors", platform: "Facebook", url: "https://www.facebook.com/search/groups/?q=Golden+Colorado+community", desc: "Golden area" },
      { name: "Nextdoor West Denver suburbs", platform: "Nextdoor", url: "https://nextdoor.com", desc: "Jefferson County neighborhoods" },
    ],
  },
];

function groupsForCity(city: string): typeof ALL_GROUPS[number] | null {
  const lower = city.toLowerCase();
  return ALL_GROUPS.find(r => r.keywords.some(k => lower.includes(k) || k.includes(lower))) ?? null;
}

function affectedRegions(cities: string[]): typeof ALL_GROUPS[number][] {
  const seen = new Set<string>();
  const result: typeof ALL_GROUPS[number][] = [];
  for (const city of cities) {
    const region = groupsForCity(city);
    if (region && !seen.has(region.region)) {
      seen.add(region.region);
      result.push(region);
    }
  }
  return result;
}

const PLATFORM_COLOR: Record<string, string> = {
  Facebook: "bg-blue-900/50 text-blue-300",
  Nextdoor: "bg-green-900/50 text-green-300",
};

// ─── POST TEMPLATES ────────────────────────────────────────────────────────────

function nextdoorPost(city: string, hailSize: string | null) {
  const sizeNote = hailSize ? ` — ${hailSize} hail was measured in the area` : "";
  return `Hi neighbors! Just a heads up after last night's storm${sizeNote}:

Many homeowners in ${city} have roof or gutter damage they haven't noticed yet. It often doesn't look bad from the ground but shows up in an inspection.

Faraday Construction is offering free inspections for our area this week. They helped my neighbor get $14,000 covered last month — he only paid his deductible.

Don't wait — insurance companies get tougher the longer you wait after a storm.

Free inspection: [YOUR LINK] or call/text (720) 766-1518`;
}

function facebookPost(city: string, hailSize: string | null) {
  const sizeNote = hailSize ? ` (${hailSize} hail reported!)` : "";
  return `ATTENTION ${city.toUpperCase()} HOMEOWNERS${sizeNote}

Did last night's storm hit your property? Your roof damage may be FULLY covered by insurance — most homeowners only pay their deductible.

Faraday Construction is doing FREE inspections this week. We've helped 1,200+ Colorado families recover $9,000–$22,000 from insurance.

⚠️ Don't wait — insurance claim windows close fast after storms.

👉 [YOUR LINK]

Free inspection. Zero cost if no damage. Same-day availability.

#${city.replace(/\s+/g, "")}CO #HailDamage #FreeRoofInspection #FaradayConstruction`;
}

function commentTemplate(city: string) {
  return `We do free inspections in ${city} — most damage is invisible from the ground. Happy to take a look, no commitment. (720) 766-1518 or [YOUR LINK]`;
}

function dmTemplate(city: string) {
  return `Hey! Saw your post about the storm in ${city}. Faraday Construction does free inspections — we find damage you can't see from the ground, and if your insurance covers it we handle all the paperwork. Want me to set one up? No commitment.`;
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default async function StormWarRoom() {
  const [{ warnings, watches }, cityPerformance] = await Promise.all([
    fetchAlerts(),
    fetchCityPerformance(),
  ]);

  const allAffectedCities = [
    ...warnings.flatMap(a => frontRangeCities(a.properties.areaDesc)),
    ...watches.flatMap(a => frontRangeCities(a.properties.areaDesc)),
  ];
  const uniqueAffectedCities = [...new Set(allAffectedCities)];

  // Extract hail size from the most severe active warning
  const primaryHailSize = (() => {
    for (const w of warnings) {
      const h = extractHailSize(w);
      if (h) {
        const m = h.match(/(\d+(?:\.\d+)?)/);
        if (m) return parseFloat(m[1]);
      }
    }
    return 0.75;
  })();

  const [recentLeads, neighborhoodScores] = await Promise.all([
    fetchRecentLeads(uniqueAffectedCities),
    uniqueAffectedCities.length > 0
      ? scoreNeighborhoods(uniqueAffectedCities, primaryHailSize)
      : Promise.resolve([]),
  ]);

  const isActive = warnings.length > 0;
  const isWatch = watches.length > 0;
  const status = isActive ? "🔴 ACTIVE" : isWatch ? "🟡 WATCH" : "✓ Clear";
  const statusColor = isActive ? "text-red-400" : isWatch ? "text-amber-400" : "text-green-400";

  return (
    <main className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-white">Storm War Room</h1>
              <span className={`text-sm font-black ${statusColor}`}>{status}</span>
            </div>
            <p className="text-gray-500 text-xs">
              NWS data • refreshes every 3 min • {new Date().toLocaleTimeString("en-US", { timeZone: "America/Denver", hour: "2-digit", minute: "2-digit" })} MT
            </p>
          </div>
          <a href="/intel" className="text-xs text-gray-500 hover:text-white border border-gray-800 px-3 py-1.5 rounded-lg transition-colors">
            Lead Intel →
          </a>
        </div>

        {/* Live status panel — polls every 30s */}
        <StormLiveStatus />

        {/* Playbook reminder */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-6 text-xs text-gray-400">
          <span className="text-white font-semibold">Storm playbook: </span>
          Post Nextdoor + Facebook groups <span className="text-gray-600">(free, 20–35% close rate)</span> →
          Run $200–500 Facebook ad targeting hit ZIPs →
          Reply to every Nextdoor comment within 15 min →
          <span className="text-green-400 font-semibold"> $500–$3,000 per storm event</span>
        </div>

        {/* ── ACTIVE WARNINGS ─────────────────────────────────────────────────── */}
        {warnings.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-red-400 font-bold text-sm uppercase tracking-wide">
                {warnings.length} Active Warning{warnings.length > 1 ? "s" : ""} — Post NOW
              </h2>
            </div>

            {warnings.map(alert => {
              const hailSize = extractHailSize(alert);
              const cities = frontRangeCities(alert.properties.areaDesc);
              const primaryCity = cities[0] || "Colorado";
              const regions = affectedRegions(cities);
              const leadsHere = recentLeads.filter(l => cities.some(c => l.city?.toLowerCase().includes(c.toLowerCase())));

              return (
                <div key={alert.properties.id} className="bg-gray-900 border border-red-700/40 rounded-2xl p-5 mb-4">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        <span className="bg-red-900/60 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full">
                          {alert.properties.event.toUpperCase()}
                        </span>
                        {hailSize && (
                          <span className="bg-orange-900/60 text-orange-300 text-xs font-bold px-2 py-0.5 rounded-full">
                            {hailSize} HAIL
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">{timeAgo(alert.properties.sent)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">opportunity</p>
                      <p className="text-green-400 font-bold">$500–$3K</p>
                    </div>
                  </div>

                  {/* Affected cities */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {cities.map(c => (
                      <span key={c} className="bg-gray-800 text-gray-200 text-xs px-2.5 py-1 rounded-lg font-medium">{c}</span>
                    ))}
                  </div>

                  {/* Recent leads in this area */}
                  {leadsHere.length > 0 && (
                    <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl px-3 py-2 mb-4">
                      <p className="text-amber-400 text-xs font-semibold mb-1">
                        {leadsHere.length} existing lead{leadsHere.length > 1 ? "s" : ""} in this area — re-engagement SMS sent automatically
                      </p>
                      <p className="text-gray-500 text-xs">
                        {leadsHere.slice(0, 3).map(l => l.name || "Lead").join(", ")}{leadsHere.length > 3 ? ` +${leadsHere.length - 3} more` : ""}
                      </p>
                    </div>
                  )}

                  {/* Community groups for affected regions */}
                  {regions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Post to these groups now</p>
                      <div className="space-y-1.5">
                        {regions.flatMap(r => r.groups).map(g => (
                          <div key={g.name} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${PLATFORM_COLOR[g.platform]}`}>
                                {g.platform}
                              </span>
                              <span className="text-white text-xs font-medium truncate">{g.name}</span>
                              <span className="text-gray-600 text-xs shrink-0 hidden sm:inline">{g.desc}</span>
                            </div>
                            <a href={g.url} target="_blank" rel="noopener noreferrer"
                               className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-2">
                              Open →
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Copy-ready posts for primary city */}
                  <div className="space-y-2">
                    <CopyBlock label={`Nextdoor — ${primaryCity} (20–35% close rate)`} content={nextdoorPost(primaryCity, hailSize)} />
                    <CopyBlock label={`Facebook Post — ${primaryCity}`} content={facebookPost(primaryCity, hailSize)} />
                    <CopyBlock label="Quick Comment (reply to existing threads)" content={commentTemplate(primaryCity)} />
                    <CopyBlock label="DM Template (send to anyone who engages)" content={dmTemplate(primaryCity)} />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── NEIGHBORHOOD SATURATION ──────────────────────────────────────────── */}
        {neighborhoodScores.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white font-bold mb-1">Where to Focus</h2>
            <p className="text-gray-500 text-xs mb-3">Ranked by hail severity + historical leads + completed jobs. Work top to bottom.</p>
            <div className="space-y-2">
              {neighborhoodScores.map((n, i) => (
                <div key={n.city} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                  n.priority === "high" ? "bg-gray-900 border-red-700/30" :
                  n.priority === "medium" ? "bg-gray-900 border-amber-700/20" :
                  "bg-gray-900 border-gray-800"
                }`}>
                  <div className="text-gray-600 font-mono text-xs w-4 shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{n.city}</span>
                      <span className={`text-xs font-bold ${
                        n.priority === "high" ? "text-red-400" :
                        n.priority === "medium" ? "text-amber-400" : "text-gray-500"
                      }`}>{n.priority.toUpperCase()}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{n.reasoning}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xl font-black ${
                      n.score >= 65 ? "text-red-400" : n.score >= 40 ? "text-amber-400" : "text-gray-500"
                    }`}>{n.score}</p>
                    <p className="text-gray-600 text-xs">/100</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── STORM WATCHES ─────────────────────────────────────────────────────�� */}
        {watches.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-amber-400 font-bold text-sm uppercase tracking-wide">
                {watches.length} Watch — Storm Possible in 2–12 Hours. Prep Now.
              </h2>
            </div>

            {watches.map(alert => {
              const cities = frontRangeCities(alert.properties.areaDesc);
              const regions = affectedRegions(cities);

              return (
                <div key={alert.properties.id} className="bg-gray-900 border border-amber-700/30 rounded-2xl p-5 mb-4">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="bg-amber-900/50 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                      {alert.properties.event.toUpperCase()}
                    </span>
                    <span className="text-gray-500 text-xs self-center">{timeAgo(alert.properties.sent)}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {cities.map(c => (
                      <span key={c} className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-lg">{c}</span>
                    ))}
                  </div>

                  {/* Prep checklist */}
                  <div className="bg-amber-950/20 border border-amber-800/20 rounded-xl px-4 py-3 mb-4">
                    <p className="text-amber-300 text-xs font-bold mb-2">Prep checklist — do this now, before the storm</p>
                    <ul className="space-y-1 text-xs text-gray-400">
                      <li>□ Join any affected Facebook groups you're not already in</li>
                      <li>□ Draft your Nextdoor post (copy template below, fill in city)</li>
                      <li>□ Set up Facebook ad targeting (affected ZIP codes, ready to launch)</li>
                      <li>□ Have your phone charged and notifications on</li>
                    </ul>
                  </div>

                  {regions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Join these groups before the storm</p>
                      {regions.flatMap(r => r.groups).map(g => (
                        <div key={g.name} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${PLATFORM_COLOR[g.platform]}`}>{g.platform}</span>
                            <span className="text-white text-xs">{g.name}</span>
                          </div>
                          <a href={g.url} target="_blank" rel="noopener noreferrer"
                             className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ml-2">
                            Join →
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* ── CLEAR STATE ──────────────────────────────────────────────────────── */}
        {warnings.length === 0 && watches.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center mb-8">
            <p className="text-3xl mb-3">✓</p>
            <p className="text-white font-bold mb-1">No Active Severe Alerts</p>
            <p className="text-gray-500 text-sm">Check back May–September. Use always-ready templates below for any storm you hear about.</p>
          </div>
        )}

        {/* ── NEIGHBORHOOD PERFORMANCE HISTORY ─────────────────────────────────── */}
        {cityPerformance.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white font-bold mb-1">Where Your Leads Come From</h2>
            <p className="text-gray-500 text-xs mb-3">Historical lead count by city — focus your storm posts here first.</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">City</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Leads (2 yr)</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Est. Value</th>
                  </tr>
                </thead>
                <tbody>
                  {cityPerformance.map((row, i) => (
                    <tr key={row.city} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-4 py-2.5 text-white text-xs">
                        {i === 0 && <span className="text-amber-400 font-bold mr-1">★</span>}
                        {row.city}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300 text-xs">{row.count}</td>
                      <td className="px-4 py-2.5 text-right text-green-400 font-semibold text-xs">${row.count * 100}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── ALL COMMUNITY GROUPS ─────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-white font-bold mb-1">All Community Groups</h2>
          <p className="text-gray-500 text-xs mb-4">
            Join all of these <span className="text-white font-semibold">before</span> storm season. Speed is everything after hail hits.
          </p>
          {ALL_GROUPS.map(region => (
            <div key={region.region} className="mb-5">
              <p className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-2">{region.region}</p>
              <div className="space-y-1.5">
                {region.groups.map(g => (
                  <div key={g.name} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${PLATFORM_COLOR[g.platform]}`}>{g.platform}</span>
                      <span className="text-white text-sm truncate">{g.name}</span>
                      <span className="text-gray-600 text-xs hidden sm:inline">{g.desc}</span>
                    </div>
                    <a href={g.url} target="_blank" rel="noopener noreferrer"
                       className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-2">
                      Open →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── ALWAYS-READY TEMPLATES ────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-white font-bold mb-1">Always-Ready Templates</h2>
          <p className="text-gray-500 text-xs mb-4">Use any time you hear about hail — replace [CITY] with the area.</p>
          <div className="space-y-3">
            <CopyBlock label="Nextdoor Post (any storm)" content={nextdoorPost("[CITY]", null)} />
            <CopyBlock label="Facebook Post (any storm)" content={facebookPost("[CITY]", null)} />
            <CopyBlock label="Quick Comment Reply" content={commentTemplate("[CITY]")} />
            <CopyBlock label="DM Template" content={dmTemplate("[CITY]")} />
          </div>
        </section>

        <div className="flex items-center justify-between text-xs text-gray-700 pt-4 border-t border-gray-800">
          <span>NWS (weather.gov) • 3 min cache</span>
          <a href="/" className="hover:text-gray-400 transition-colors">← Back to site</a>
        </div>
      </div>
    </main>
  );
}
