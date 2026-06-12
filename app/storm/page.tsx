// Tyler's Storm Tracker — active CO hail alerts + copy-paste posts + ad targeting guide
// This is your traffic trigger: storm hits → you post → leads come in within hours
import type { Metadata } from "next";
import CopyBlock from "@/components/CopyBlock";

export const metadata: Metadata = {
  title: "Storm Tracker — Faraday Leads",
  robots: "noindex",
};

export const revalidate = 300; // NWS data refreshes every 5 minutes

interface NWSFeature {
  properties: {
    id: string;
    event: string;
    headline: string;
    description: string;
    areaDesc: string;
    sent: string;
    effective: string;
    expires: string;
    severity: string;
    parameters?: {
      hailSize?: string[];
      maxHailSize?: string[];
    };
  };
}

// Pre-seeded list of high-value Front Range community groups.
// Add more as you find them — the more groups you're in, the faster you can blanket an area after a storm.
const COMMUNITY_GROUPS = [
  {
    city: "Denver Metro",
    groups: [
      { name: "Denver, Colorado — Community Board", platform: "Facebook", description: "150K+ members", url: "https://www.facebook.com/groups/denvercommunityboard" },
      { name: "Denver Homeowners & Neighbors", platform: "Facebook", description: "Homeowners focus", url: "https://www.facebook.com/search/groups/?q=Denver+homeowners+Colorado" },
      { name: "r/Denver", platform: "Reddit", description: "Monitor for hail/roof posts", url: "https://www.reddit.com/r/Denver/new" },
      { name: "Nextdoor — Denver neighborhoods", platform: "Nextdoor", description: "Join your local neighborhoods", url: "https://nextdoor.com" },
    ],
  },
  {
    city: "Boulder / Longmont",
    groups: [
      { name: "Boulder Community Board", platform: "Facebook", description: "Boulder community hub", url: "https://www.facebook.com/search/groups/?q=Boulder+Colorado+community" },
      { name: "Longmont Community Forum", platform: "Facebook", description: "Active local group", url: "https://www.facebook.com/search/groups/?q=Longmont+Colorado+community" },
      { name: "r/Boulder", platform: "Reddit", description: "Monitor for storm posts", url: "https://www.reddit.com/r/Boulder/new" },
      { name: "Boulder County Homeowners", platform: "Facebook", description: "Homeowners focus", url: "https://www.facebook.com/search/groups/?q=Boulder+County+homeowners" },
    ],
  },
  {
    city: "Fort Collins / Loveland",
    groups: [
      { name: "Fort Collins Community Board", platform: "Facebook", description: "Large active group", url: "https://www.facebook.com/search/groups/?q=Fort+Collins+community+board" },
      { name: "Loveland Colorado Community", platform: "Facebook", description: "Local community", url: "https://www.facebook.com/search/groups/?q=Loveland+Colorado+community" },
      { name: "r/FortCollins", platform: "Reddit", description: "Monitor for storm posts", url: "https://www.reddit.com/r/FortCollins/new" },
      { name: "Northern Colorado Homeowners", platform: "Facebook", description: "NoCo homeowners", url: "https://www.facebook.com/search/groups/?q=Northern+Colorado+homeowners" },
    ],
  },
  {
    city: "Broomfield / Westminster / Arvada",
    groups: [
      { name: "Broomfield Community Group", platform: "Facebook", description: "High-value suburb", url: "https://www.facebook.com/search/groups/?q=Broomfield+Colorado+community" },
      { name: "Westminster Colorado Neighbors", platform: "Facebook", description: "Active local group", url: "https://www.facebook.com/search/groups/?q=Westminster+Colorado+community" },
      { name: "Arvada Community Board", platform: "Facebook", description: "Arvada homeowners", url: "https://www.facebook.com/search/groups/?q=Arvada+Colorado+community" },
    ],
  },
  {
    city: "Aurora / Parker / Lakewood",
    groups: [
      { name: "Aurora Colorado Community", platform: "Facebook", description: "Large east-Denver suburb", url: "https://www.facebook.com/search/groups/?q=Aurora+Colorado+community" },
      { name: "Parker Colorado Neighbors", platform: "Facebook", description: "Affluent suburb, great leads", url: "https://www.facebook.com/search/groups/?q=Parker+Colorado+community" },
      { name: "Lakewood Colorado Community", platform: "Facebook", description: "West Denver suburb", url: "https://www.facebook.com/search/groups/?q=Lakewood+Colorado+community" },
    ],
  },
  {
    city: "Statewide (Post After Major Events)",
    groups: [
      { name: "r/Colorado", platform: "Reddit", description: "Statewide — major storm events", url: "https://www.reddit.com/r/Colorado/new" },
      { name: "Colorado Homeowners Network", platform: "Facebook", description: "Statewide homeowners", url: "https://www.facebook.com/search/groups/?q=Colorado+homeowners+network" },
      { name: "r/HomeImprovement", platform: "Reddit", description: "People actively seeking contractors", url: "https://www.reddit.com/r/HomeImprovement/new" },
    ],
  },
];

async function getColoradoAlerts(): Promise<NWSFeature[]> {
  try {
    const res = await fetch(
      "https://api.weather.gov/alerts/active?area=CO",
      {
        headers: { "User-Agent": "FaradayLeads/1.0" },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const stormEvents = [
      "severe thunderstorm",
      "hail",
      "tornado",
      "wind advisory",
      "high wind",
    ];
    return (data.features || []).filter((f: NWSFeature) => {
      const event = f.properties.event.toLowerCase();
      return stormEvents.some(e => event.includes(e));
    });
  } catch {
    return [];
  }
}

function extractHailSize(alert: NWSFeature): string | null {
  const params = alert.properties.parameters;
  if (params?.hailSize?.[0]) return params.hailSize[0];
  if (params?.maxHailSize?.[0]) return params.maxHailSize[0];
  const match = alert.properties.description.match(
    /hail(?:\s+up\s+to)?\s+(\d+(?:\.\d+)?)\s*inch/i
  );
  return match ? `${match[1]} inch` : null;
}

function primaryCity(areaDesc: string): string {
  return areaDesc.split(";")[0].trim().split(",")[0].trim();
}

function affectedCities(areaDesc: string): string[] {
  return areaDesc
    .split(";")
    .map(a => a.trim().split(",")[0].trim())
    .filter(Boolean)
    .slice(0, 6);
}

function timeAgo(dateStr: string): string {
  const hours = Math.round(
    (Date.now() - new Date(dateStr).getTime()) / 3600000
  );
  if (hours < 1) return "Just now";
  if (hours === 1) return "1 hr ago";
  if (hours < 24) return `${hours} hrs ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function facebookPost(city: string, hailSize: string | null): string {
  const sizeNote = hailSize ? ` (${hailSize} hail reported!)` : "";
  return `ATTENTION ${city.toUpperCase()} HOMEOWNERS${sizeNote}

Did last night's storm hit your property? Your roof damage may be FULLY covered by insurance — most homeowners only pay their deductible.

Faraday Construction is doing FREE inspections this week. We've helped 1,200+ Colorado families recover $9,000–$22,000 from insurance.

⚠️ Don't wait — insurance claim windows close fast after storms.

👉 [YOUR LINK HERE]

Free inspection. Zero cost if no damage. Same-day availability.

#${city.replace(/\s+/g, "")}CO #HailDamage #FreeRoofInspection #FaradayConstruction #ColoradoHail`;
}

function nextdoorPost(city: string, hailSize: string | null): string {
  const sizeNote = hailSize
    ? ` — ${hailSize} hail was measured in the area`
    : "";
  return `Hi neighbors! Just a heads up after last night's storm${sizeNote}:

Many homeowners in ${city} have roof or gutter damage they haven't noticed yet. It often doesn't look bad from the ground but shows up in an inspection.

Faraday Construction is offering free inspections specifically for our area this week. They helped my neighbor get $14,000 covered last month — he only paid his deductible. Fast, professional, no pressure.

If you think you might have damage, don't wait too long — insurance companies get tougher the longer you wait after a storm.

Free inspection link: [YOUR LINK HERE]
Or call/text: (720) 766-1518`;
}

function adHeadline(city: string, hailSize: string | null): string {
  const size = hailSize ? ` — ${hailSize} Hail Reported` : "";
  return `📍 ${city} Homeowners${size}: Your Roof May Already Be Covered

Most storm damage claims come in at $9,000–$22,000 — paid by your insurance, not you.

FREE inspection • We handle all paperwork • Same-day available

✓ BBB A+ Rated  ✓ 1,200+ Families Helped  ✓ Licensed & Insured

[YOUR LINK] | (720) 766-1518

Target: Homeowners in ${city} area, 30–65 yrs, $60K+ household income
Budget: $200–500 for first 48 hrs. Scale if cost/lead < $25.`;
}

export default async function StormTrackerPage() {
  const alerts = await getColoradoAlerts();
  const hailAlerts = alerts.filter(a => {
    const event = a.properties.event.toLowerCase();
    return event.includes("severe thunderstorm") || event.includes("hail");
  });
  const otherAlerts = alerts.filter(a => !hailAlerts.includes(a));

  return (
    <main className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-white">Storm Tracker</h1>
            <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-700/40 px-2 py-1 rounded-full font-semibold">
              Tyler&apos;s Lead Trigger
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            Active Colorado severe weather alerts from National Weather Service. Auto-refreshes every 5 min.
          </p>
        </div>

        {/* ROI banner */}
        <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4 mb-6">
          <p className="text-green-300 text-sm font-semibold mb-1">Your playbook when a storm hits:</p>
          <p className="text-gray-400 text-xs">
            Post to Nextdoor + local Facebook groups (free) → Run $200–500 Facebook ad → Capture 10–40 leads → $1,000–$4,000 in jobs at $100 each
          </p>
        </div>

        {/* Active hail alerts — the money signals */}
        {hailAlerts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-red-400 font-bold text-sm uppercase tracking-wide">
                {hailAlerts.length} Active Hail / Severe Storm Alert{hailAlerts.length > 1 ? "s" : ""} — Act Now
              </h2>
            </div>
            <div className="space-y-5">
              {hailAlerts.map(alert => {
                const hailSize = extractHailSize(alert);
                const city = primaryCity(alert.properties.areaDesc);
                const cities = affectedCities(alert.properties.areaDesc);
                const expires = new Date(alert.properties.expires).toLocaleTimeString(
                  "en-US",
                  { hour: "2-digit", minute: "2-digit", timeZone: "America/Denver" }
                );

                return (
                  <div
                    key={alert.properties.id}
                    className="bg-gray-900 border border-red-700/50 rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="bg-red-900/60 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full">
                            {alert.properties.event.toUpperCase()}
                          </span>
                          {hailSize && (
                            <span className="bg-orange-900/60 text-orange-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                              {hailSize} HAIL
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs">
                          {timeAgo(alert.properties.sent)} • Expires {expires} MT
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-green-400 text-xs">Your opportunity</p>
                        <p className="text-green-300 font-bold text-lg">$500–$3,000</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-gray-500 text-xs mb-2">Affected areas:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cities.map(c => (
                          <span key={c} className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-lg">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <CopyBlock
                        label="Nextdoor Post (highest close rate)"
                        content={nextdoorPost(city, hailSize)}
                      />
                      <CopyBlock
                        label="Facebook / Instagram Post"
                        content={facebookPost(city, hailSize)}
                      />
                      <CopyBlock
                        label="Facebook Ad Copy + Targeting Notes"
                        content={adHeadline(city, hailSize)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other active alerts (wind, tornado) */}
        {otherAlerts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-yellow-400 font-semibold text-sm uppercase tracking-wide mb-3">
              Other Active Alerts (Lower Priority)
            </h2>
            <div className="space-y-3">
              {otherAlerts.map(alert => (
                <div
                  key={alert.properties.id}
                  className="bg-gray-900 border border-yellow-800/40 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="bg-yellow-900/50 text-yellow-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {alert.properties.event}
                      </span>
                      <p className="text-gray-400 text-xs mt-1">
                        {affectedCities(alert.properties.areaDesc).join(" • ")}
                      </p>
                    </div>
                    <p className="text-gray-500 text-xs">{timeAgo(alert.properties.sent)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No active alerts state */}
        {alerts.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center mb-8">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-white font-bold mb-1">No Active Severe Alerts</h2>
            <p className="text-gray-400 text-sm">
              No active severe weather in Colorado right now. Check back during storm season (May–September).
              Use the templates below to post after any storm, even without a NWS alert.
            </p>
          </div>
        )}

        {/* Always-ready templates */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-bold mb-1">Always-Ready Templates</h2>
          <p className="text-gray-400 text-xs mb-4">
            Use these any time you hear about hail or storms — even without an NWS alert active.
            Replace [CITY] with the actual area.
          </p>
          <div className="space-y-3">
            <CopyBlock
              label="General Nextdoor Post (Any Storm)"
              content={nextdoorPost("[CITY]", null)}
            />
            <CopyBlock
              label="General Facebook Post"
              content={facebookPost("[CITY]", null)}
            />
            <CopyBlock
              label="Facebook Ad — Generic Hail Season"
              content={`Colorado Homeowners: Free Roof Inspection — We Find Damage You Can't See

65% of our inspections find hail damage the homeowner didn't know was there. Average insurance claim: $9,000–$22,000.

You only pay your deductible. We handle everything else.

✓ BBB A+ Rated   ✓ Free Same-Day Inspection   ✓ We Handle All Insurance Paperwork

[YOUR LINK] | (720) 766-1518

Target: Colorado homeowners, 30–65 years old, $60K+ HHI
Budget: Start at $10/day, scale what's working`}
            />
          </div>
        </div>

        {/* Facebook ad targeting guide */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-bold mb-4">Facebook Ad Setup — Storm Mode</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-amber-400 font-semibold text-xs uppercase tracking-wide mb-2">When to run</p>
              <ul className="text-gray-300 space-y-1 text-xs">
                <li>• Within 6 hours of storm hitting</li>
                <li>• Competition increases fast after 24 hrs</li>
                <li>• Run for 48–72 hrs post-storm</li>
              </ul>
            </div>
            <div>
              <p className="text-amber-400 font-semibold text-xs uppercase tracking-wide mb-2">Targeting</p>
              <ul className="text-gray-300 space-y-1 text-xs">
                <li>• Zip codes in affected area ±10 miles</li>
                <li>• Homeowners, ages 30–65</li>
                <li>• Household income $60K+</li>
                <li>• Objective: Leads or Traffic</li>
              </ul>
            </div>
            <div>
              <p className="text-amber-400 font-semibold text-xs uppercase tracking-wide mb-2">Budget</p>
              <ul className="text-gray-300 space-y-1 text-xs">
                <li>• Start: $200–500 first 48 hours</li>
                <li>• Scale if cost/lead under $25</li>
                <li>• Stop if cost/lead over $40</li>
              </ul>
            </div>
            <div>
              <p className="text-amber-400 font-semibold text-xs uppercase tracking-wide mb-2">Your math</p>
              <ul className="text-gray-300 space-y-1 text-xs">
                <li>• $15 avg cost/lead from Facebook</li>
                <li>• 10–15% close rate = $100/job</li>
                <li>• $300 ad spend → ~20 leads → 2–3 jobs</li>
                <li>• <span className="text-green-400 font-semibold">$200–300 profit per storm event</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Nextdoor tips */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-bold mb-3">Nextdoor Playbook</h2>
          <div className="space-y-2 text-xs text-gray-400">
            <p>• <span className="text-gray-200">Post as yourself</span>, not as a business — Nextdoor penalizes obvious ads</p>
            <p>• <span className="text-gray-200">Reference the specific storm</span> that just happened ("last night&apos;s storm," "this morning&apos;s hail")</p>
            <p>• <span className="text-gray-200">Join 5–10 neighborhood groups</span> in Front Range cities before storm season so you can post immediately</p>
            <p>• <span className="text-gray-200">Post within 12 hours</span> of a storm for maximum visibility</p>
            <p>• Cost: $0. Close rate from Nextdoor: typically 20–35% (they&apos;re warm, local, and already thinking about it)</p>
          </div>
        </div>

        {/* ── COMMUNITY GROUP DIRECTORY ── */}
        {/* Join these BEFORE storm season so you can post immediately when hail hits */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-bold mb-1">Community Group Directory</h2>
          <p className="text-gray-400 text-xs mb-5">
            Join all of these <span className="text-white font-semibold">before</span> storm season.
            When hail hits, click Open → paste your post → done. Speed is everything.
          </p>

          {COMMUNITY_GROUPS.map(city => (
            <div key={city.city} className="mb-5 last:mb-0">
              <p className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-2">{city.city}</p>
              <div className="space-y-2">
                {city.groups.map(g => (
                  <div key={g.name} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-white text-sm font-medium">{g.name}</p>
                      <p className="text-gray-500 text-xs">{g.platform} • {g.description}</p>
                    </div>
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-3"
                    >
                      Open →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-4 bg-gray-800 rounded-xl p-3">
            <p className="text-gray-400 text-xs">
              <span className="text-white font-semibold">Tip:</span> Search Facebook for &ldquo;[city] homeowners&rdquo; or &ldquo;[city] community&rdquo; to find more groups.
              The bigger the group, the more leads after a storm. Aim to join 15–20 groups total.
            </p>
          </div>
        </div>

        {/* ── REDDIT MONITORING STATUS ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-white font-bold">Reddit Monitor — Running</h2>
          </div>
          <p className="text-gray-400 text-xs mb-4">
            Every 15 minutes, the system scans these subreddits for people asking about roofing, hail damage, or storm damage.
            When found, you get a text with the direct post link so you can reply before any other contractor sees it.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {["r/Denver", "r/Boulder", "r/FortCollins", "r/ColoradoSprings", "r/Longmont", "r/Colorado", "r/HomeImprovement"].map(sub => (
              <a
                key={sub}
                href={`https://www.reddit.com/${sub}/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-lg text-center transition-colors"
              >
                {sub}
              </a>
            ))}
          </div>
          <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">When you get a Reddit alert text:</p>
            <ol className="text-gray-400 text-xs space-y-1 list-decimal list-inside">
              <li>Open the link immediately — reply within the first 15 minutes</li>
              <li>Be helpful, not salesy: &ldquo;Faraday does free inspections — happy to help you figure out if it&apos;s covered&rdquo;</li>
              <li>DM anyone who engages with your comment</li>
              <li>These convert at 30–50% because they&apos;re already asking</li>
            </ol>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600 pt-4 border-t border-gray-800">
          <span>Data: National Weather Service (weather.gov) • Refreshes every 5 min</span>
          <a href="/" className="hover:text-gray-400 transition-colors">← Back to site</a>
        </div>
      </div>
    </main>
  );
}
