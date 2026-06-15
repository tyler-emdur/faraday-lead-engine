// CRON: Municipal & Government Bid Monitor — runs daily at 7am MT
// Watches Colorado government procurement portals for roofing, construction,
// and facility management bids. One municipal roof is worth $100k+.
//
// Sources:
//   1. Colorado OSPB (bids.colorado.gov) — state agency bids
//   2. Denver city bids (denvergov.org) — city/county bids
//   3. Colorado open data (data.colorado.gov) — awarded contracts for competitor intel
//
// No API key required — all public data.

import { NextRequest, NextResponse } from "next/server";
import { notifyTyler } from "@/lib/notify";
import { saveOpportunity, opportunityExists } from "@/lib/intel";

export const maxDuration = 60;

interface BidOpportunity {
  id: string;
  title: string;
  description: string;
  agency: string;
  url: string;
  closing_date?: string;
  value_estimate?: number;
}

const ROOFING_KEYWORDS = [
  "roof", "roofing", "re-roof", "reroof", "hail damage", "storm damage",
  "building envelope", "flat roof", "membrane roof", "facilities maintenance",
  "exterior renovation", "shingle", "skylight", "gutter", "flashing",
];

function matchesBid(text: string): boolean {
  const lower = text.toLowerCase();
  return ROOFING_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Source 1: Colorado OSPB bids via their Socrata endpoint ─────────────────
// Dataset: Colorado state agency solicitations
async function fetchColoradoStateBids(): Promise<BidOpportunity[]> {
  try {
    const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      "$where": `date_issued >= '${since.slice(0, 10)}'`,
      "$limit": "50",
      "$order": "date_issued DESC",
    });

    const res = await fetch(
      `https://data.colorado.gov/resource/state-bids.json?${params}`,
      {
        headers: { "User-Agent": "FaradayLeadBot/1.0" },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) return [];
    const data: Record<string, string>[] = await res.json();

    return data
      .filter(b => matchesBid(`${b.title || ""} ${b.description || ""}`))
      .map(b => ({
        id: `co_ospb_${b.bid_number || b.id || Math.random().toString(36).slice(2)}`,
        title: b.title || b.solicitation_title || "Colorado State Bid",
        description: b.description || b.scope_of_work || "",
        agency: b.agency || b.department || "Colorado State Agency",
        url: b.url || b.link || "https://bids.colorado.gov",
        closing_date: b.closing_date || b.due_date,
      }));
  } catch {
    return [];
  }
}

// ── Source 2: Denver city bids (Socrata) ────────────────────────────────────
async function fetchDenverCityBids(): Promise<BidOpportunity[]> {
  try {
    const res = await fetch(
      "https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Financial-Management/Purchasing/Solicitations",
      {
        headers: { "User-Agent": "FaradayLeadBot/1.0", "Accept": "application/json" },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) return [];

    // Denver returns HTML — parse for bid listings using basic text matching
    const html = await res.text();
    const bids: BidOpportunity[] = [];

    // Extract bid titles and numbers from the page
    const bidMatches = html.matchAll(/IFB|RFP|RFQ[\s-]*([A-Z0-9-]+)[^<]*<[^>]+>([^<]{10,})</g);
    let i = 0;
    for (const match of bidMatches) {
      const description = match[2]?.trim() || "";
      if (!matchesBid(description)) continue;
      bids.push({
        id: `denver_bid_${match[1] || i++}`,
        title: description.slice(0, 120),
        description,
        agency: "City and County of Denver",
        url: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Financial-Management/Purchasing/Solicitations",
      });
      if (bids.length >= 5) break;
    }

    return bids;
  } catch {
    return [];
  }
}

// ── Source 3: Jefferson County bids ─────────────────────────────────────────
async function fetchJeffcosBids(): Promise<BidOpportunity[]> {
  try {
    const res = await fetch(
      "https://www.jeffco.us/bids.aspx",
      {
        headers: { "User-Agent": "FaradayLeadBot/1.0" },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) return [];
    const html = await res.text();
    const bids: BidOpportunity[] = [];

    // Parse bid titles from the page
    const matches = html.matchAll(/<a[^>]+href="([^"]*bid[^"]*)"[^>]*>([^<]{10,})<\/a>/gi);
    for (const match of matches) {
      const title = match[2]?.trim() || "";
      if (!matchesBid(title)) continue;
      bids.push({
        id: `jeffco_${Buffer.from(title).toString("base64").slice(0, 20)}`,
        title,
        description: title,
        agency: "Jefferson County, CO",
        url: match[1]?.startsWith("http") ? match[1] : `https://www.jeffco.us${match[1]}`,
      });
      if (bids.length >= 5) break;
    }

    return bids;
  } catch {
    return [];
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { checked: 0, matched: 0, saved: 0 };
  const highPriorityBids: string[] = [];

  const [stateBids, denverBids, jeffcoBids] = await Promise.all([
    fetchColoradoStateBids(),
    fetchDenverCityBids(),
    fetchJeffcosBids(),
  ]);

  const allBids = [...stateBids, ...denverBids, ...jeffcoBids];
  results.checked = allBids.length;

  for (const bid of allBids) {
    results.matched++;
    if (await opportunityExists(bid.id)) continue;

    const hasClosingDate = !!bid.closing_date;
    const isUrgent = hasClosingDate && new Date(bid.closing_date!).getTime() - Date.now() < 14 * 86400000;

    const opp = await saveOpportunity({
      source: "property_scan",
      source_id: bid.id,
      type: "property_target",
      priority: isUrgent ? "high" : "medium",
      title: `Gov't Bid: ${bid.title.slice(0, 100)}`,
      body: `${bid.agency}\n${bid.description.slice(0, 400)}${bid.closing_date ? `\nCloses: ${bid.closing_date}` : ""}`,
      url: bid.url,
      location: bid.agency,
      urgency_score: isUrgent ? 80 : 55,
      opportunity_score: isUrgent ? 80 : 55,
      why_it_matters: `Government roofing bid from ${bid.agency}. Municipal contracts are worth $50k–$500k and provide stable revenue independent of storm season. Getting on their approved vendor list creates recurring work.`,
      outreach_message: `Hi, I'm reaching out on behalf of Faraday Construction regarding bid ${bid.id.split("_").pop()} — ${bid.title.slice(0, 80)}. We're a licensed Colorado contractor specializing in commercial and municipal roofing. I'd love to learn more about your requirements. When is a good time to connect?`,
      close_probability: 25,
      follow_up_schedule: `Submit by closing date${bid.closing_date ? ` (${bid.closing_date})` : ""}. Follow up 3 days before deadline if no response.`,
    });

    if (opp) {
      results.saved++;
      if (isUrgent) highPriorityBids.push(`${bid.agency}: ${bid.title.slice(0, 60)}`);
    }
  }

  if (highPriorityBids.length > 0) {
    const msg = [
      `🏛 ${highPriorityBids.length} URGENT GOV'T BID${highPriorityBids.length > 1 ? "S" : ""}`,
      ...highPriorityBids.slice(0, 3).map(b => `• ${b}`),
      `→ Check /intel — closing in <14 days`,
    ].join("\n");
    await notifyTyler(msg, `🏛 Urgent Gov't Bid — Faraday`).catch(() => {});
  }

  console.log(`Bid monitor: ${results.checked} checked, ${results.matched} matched, ${results.saved} saved`);
  return NextResponse.json({ success: true, ...results });
}
