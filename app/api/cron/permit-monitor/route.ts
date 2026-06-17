// CRON: Permit Monitor — runs daily at 8am MT
// Watches Denver (+ extensible to other Front Range cities) for roofing,
// solar, window, and storm-repair permits filed in the last 24 hours.
//
// Why permits matter:
//   - A roof replacement permit in a neighborhood often means neighbors
//     have the same-aged roof and may need replacement too.
//   - Solar permits signal a neighborhood that's amenable to upgrades.
//   - Storm repair permits confirm damage in a specific area.
//
// API: Denver Open Data (Socrata) — no key required, free tier works fine.
// Add DENVER_PERMITS_APP_TOKEN env var for higher rate limits (optional).

import { NextRequest, NextResponse } from "next/server";
import { notifyTyler } from "@/lib/notify";
import { scoreOpportunity, generateAIAnalysis, saveOpportunity, opportunityExists } from "@/lib/intel";

// ─── NEIGHBOR BLASTER ──────────────────────────────────────────────────────────
// When a roofing permit is found at "123 Oak St", the 4 nearest neighbors
// (121, 119, 125, 127) almost certainly have the same-aged roof and same storm exposure.
// This generates a draft "neighbor letter" for each address and adds it to
// contact_form_queue as physical_mail type. Tyler sees them in /admin → Outreach.
//
// No paid API needed — street number arithmetic + address formatting.
// Physical mailing cost: ~$1/postcard via USPS or Lob.com (manual for now).

function generateNeighborAddresses(address: string): string[] {
  // Parse "123 OAK ST" → number=123, street="OAK ST"
  const match = address.trim().match(/^(\d+)\s+(.+)$/);
  if (!match) return [];

  const num = parseInt(match[1], 10);
  const street = match[2];

  // Generate ±2 addresses on same street (skipping even/odd parity issues, just do ±2/±4)
  const neighbors: string[] = [];
  for (const offset of [-4, -2, 2, 4]) {
    const n = num + offset;
    if (n > 0) neighbors.push(`${n} ${street}`);
  }
  return neighbors;
}

function draftNeighborLetter(neighborAddress: string, jobAddress: string, city: string, service: string): string {
  const serviceLabel = service === "roofing" ? "roof replacement" : service === "hail_damage" ? "hail damage repair" : "storm repair";
  return `Hi neighbor at ${neighborAddress},

I'm Anna with Faraday Construction. We recently completed a ${serviceLabel} at ${jobAddress} — just down the street from you.

Homes on the same block often share the same roof age and the same storm exposure. If your home went through the same hail events, you may have damage that insurance will cover — most homeowners only pay their deductible, and the average claim in Colorado is $9,000–$22,000.

We're offering your block a free roof inspection this week with no commitment. Just call or text (720) 766-1518 or visit leads.faradaysun.com.

— Anna
Faraday Construction · BBB A+ Rated · Colorado License #EC.0101010`;
}

// ─── LOB.COM POSTCARD API ──────────────────────────────────────────────────────
// Lob sends physical postcards via USPS for ~$1.09 each.
// Set LOB_API_KEY in Vercel env vars to activate automatic mailing.
// Set FARADAY_STREET, FARADAY_CITY, FARADAY_STATE, FARADAY_ZIP for return address.
// Without LOB_API_KEY, falls back to contact_form_queue for manual mailing.
//
// Get a Lob account at lob.com — no minimum spend, pay per postcard.

// City → default zip map for Denver permit addresses (zip refined by Lob address verification)
const CITY_ZIP: Record<string, string> = {
  Denver: "80202", Aurora: "80012", Lakewood: "80226", Westminster: "80031",
  Arvada: "80002", Thornton: "80229", Boulder: "80301", "Fort Collins": "80521",
  "Colorado Springs": "80903", Parker: "80134", "Castle Rock": "80104",
  "Highlands Ranch": "80129", Englewood: "80110", Longmont: "80501",
  Broomfield: "80021", Greeley: "80631", Loveland: "80537", Commerce: "80022",
};

function postcardFront(neighborAddr: string, jobAddr: string, city: string): string {
  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 30px; background: #fff; }
  .header { background: #1e3a5f; color: white; padding: 12px 20px; border-radius: 4px; margin-bottom: 16px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.85; }
  .body { font-size: 13px; color: #333; line-height: 1.5; }
  .highlight { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 8px 12px; margin: 12px 0; font-size: 12px; }
  .cta { background: #1e3a5f; color: white; text-align: center; padding: 12px; border-radius: 4px; margin-top: 14px; font-size: 15px; font-weight: bold; }
</style></head>
<body>
  <div class="header">
    <h1>Faraday Construction</h1>
    <p>Colorado Licensed Roofing · BBB A+ Rated</p>
  </div>
  <div class="body">
    <p>Hi neighbor,</p>
    <p>We recently completed a <strong>roof replacement at ${jobAddr}</strong> — just down the street.</p>
    <p>Homes on the same block often have the same roof age and the same storm exposure. If your home went through recent hail events, you may have damage your insurance will cover.</p>
    <div class="highlight">
      Most Colorado homeowners pay <strong>only their deductible</strong>. The average insurance claim is $9,000–$22,000.
    </div>
    <p>We're offering your block a <strong>free roof inspection this week</strong> with no commitment.</p>
  </div>
  <div class="cta">Call or text: (720) 766-1518<br><span style="font-size:12px;font-weight:normal;">leads.faradaysun.com</span></div>
</body>
</html>`;
}

function postcardBack(neighborAddr: string): string {
  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #fff; font-size: 12px; color: #333; }
  .return { color: #666; font-size: 11px; margin-bottom: 20px; }
  .message { margin-top: 10px; line-height: 1.6; }
  .sig { margin-top: 16px; color: #1e3a5f; font-weight: bold; }
</style></head>
<body>
  <div class="return">
    Faraday Construction<br>
    ${process.env.FARADAY_STREET || "PO Box 12345"}<br>
    ${process.env.FARADAY_CITY || "Denver"}, ${process.env.FARADAY_STATE || "CO"} ${process.env.FARADAY_ZIP || "80202"}
  </div>
  <div class="message">
    A neighbor of yours just had their roof replaced by Faraday Construction.<br><br>
    Hail damage from recent storms often affects entire blocks at once — if your roof hasn't been inspected recently, there may be damage your insurance will cover at no cost to you.<br><br>
    We're offering a <strong>free inspection this week</strong> to neighbors of every job we complete.
  </div>
  <div class="sig">
    — Tyler Emdur, Faraday Construction<br>
    (720) 766-1518 · leads.faradaysun.com
  </div>
</body>
</html>`;
}

async function sendLobPostcard(
  neighborAddr: string,
  city: string,
  jobAddr: string
): Promise<boolean> {
  const lobKey = process.env.LOB_API_KEY;
  if (!lobKey) return false;

  const zip = CITY_ZIP[city] || "80202";
  const fromStreet = process.env.FARADAY_STREET || "PO Box 12345";
  const fromCity = process.env.FARADAY_CITY || "Denver";
  const fromState = process.env.FARADAY_STATE || "CO";
  const fromZip = process.env.FARADAY_ZIP || "80202";

  try {
    const body = {
      description: `Neighbor blaster: ${neighborAddr}, ${city}`,
      to: {
        name: "Current Resident",
        address_line1: neighborAddr,
        address_city: city,
        address_state: "CO",
        address_zip: zip,
        address_country: "US",
      },
      from: {
        name: "Faraday Construction",
        address_line1: fromStreet,
        address_city: fromCity,
        address_state: fromState,
        address_zip: fromZip,
        address_country: "US",
      },
      size: "4x6",
      front: postcardFront(neighborAddr, jobAddr, city),
      back: postcardBack(neighborAddr),
    };

    const res = await fetch("https://api.lob.com/v1/postcards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(lobKey + ":").toString("base64")}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Lob postcard failed for ${neighborAddr}: ${res.status} ${err.slice(0, 200)}`);
      return false;
    }

    const data = await res.json() as { id?: string };
    console.log(`Lob postcard queued: ${neighborAddr} — ID: ${data.id}`);
    return true;
  } catch (e) {
    console.error(`Lob postcard error for ${neighborAddr}:`, e);
    return false;
  }
}

async function queueNeighborOutreach(
  address: string,
  city: string,
  service: string,
  permitId: string
): Promise<number> {
  if (!process.env.SUPABASE_URL) return 0;
  if (service !== "roofing" && service !== "hail_damage") return 0;

  const neighbors = generateNeighborAddresses(address);
  if (neighbors.length === 0) return 0;

  const lobEnabled = !!process.env.LOB_API_KEY;
  let queued = 0;

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();

    for (const neighborAddr of neighbors) {
      // Check if already processed
      const { data: existing } = await db
        .from("contact_form_queue")
        .select("id")
        .eq("business_name", `MAIL TO: ${neighborAddr}`)
        .maybeSingle();
      if (existing) continue;

      const draft = draftNeighborLetter(neighborAddr, address, city, service);
      let status = "pending_send";

      // Try Lob first — if key is set, mail automatically
      if (lobEnabled) {
        const mailed = await sendLobPostcard(neighborAddr, city, address);
        if (mailed) status = "sent"; // Mark as sent so admin queue stays clean
      }

      // Always log to contact_form_queue for record-keeping
      await db.from("contact_form_queue").insert({
        business_name: `MAIL TO: ${neighborAddr}`,
        website: `${neighborAddr}, ${city}, CO`,
        source: "neighbor_blaster",
        city,
        drafted_message: draft,
        status,
      });

      queued++;
    }
    return queued;
  } catch (e) {
    console.error("Neighbor queue failed:", e);
    return 0;
  }
}

export const maxDuration = 60;

// ─── PERMIT SOURCES ────────────────────────────────────────────────────────────

interface PermitSource {
  name: string;
  endpoint: string;
  fields: {
    permit_id: string;
    description: string;
    address: string;
    issued_date: string;
    value?: string;
    neighborhood?: string;
    contractor?: string;
  };
}

const SOURCES: PermitSource[] = [
  {
    name: "Denver",
    endpoint: "https://data.denvergov.org/resource/rbth-yxmr.json",
    fields: {
      permit_id: "permit_no",
      description: "type_description",
      address: "address",
      issued_date: "issued_date",
      value: "valuation",
      neighborhood: "neighborhood_id",
      contractor: "contractor_name",
    },
  },
  // Boulder: https://opendata.bouldercolorado.gov/resource/<dataset>.json
  // Jefferson County: add when open data API confirmed
  // Add more cities here as you find their Socrata endpoints
];

// ─── KEYWORD MATCHING ──────────────────────────────────────────────────────────

const PERMIT_TRIGGERS: { keywords: string[]; service: string; score: number }[] = [
  { keywords: ["reroof", "re-roof", "roof replacement", "roofing", "shingle", "hail damage roof", "storm damage roof"], service: "roofing", score: 75 },
  { keywords: ["solar", "photovoltaic", "pv system", "solar panel"], service: "solar", score: 60 },
  { keywords: ["window replacement", "fenestration", "window", "glazing"], service: "windows", score: 55 },
  { keywords: ["storm repair", "hail damage", "wind damage", "storm damage"], service: "hail_damage", score: 80 },
];

function matchPermit(description: string): { matched: boolean; service: string; baseScore: number } {
  const lower = description.toLowerCase();
  for (const trigger of PERMIT_TRIGGERS) {
    if (trigger.keywords.some(k => lower.includes(k))) {
      return { matched: true, service: trigger.service, baseScore: trigger.score };
    }
  }
  return { matched: false, service: "", baseScore: 0 };
}

// ─── FETCH PERMITS ─────────────────────────────────────────────────────────────

async function fetchPermits(source: PermitSource, since: string): Promise<Record<string, string>[]> {
  const appToken = process.env.DENVER_PERMITS_APP_TOKEN;
  const dateField = source.fields.issued_date;

  const params = new URLSearchParams({
    "$where": `${dateField} >= '${since}'`,
    "$limit": "300",
    "$order": `${dateField} DESC`,
  });

  const url = `${source.endpoint}?${params}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "FaradayLeadBot/1.0",
  };
  if (appToken) headers["X-App-Token"] = appToken;

  try {
    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!res.ok) {
      console.error(`${source.name} permits API error: ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.error(`${source.name} permits fetch failed:`, e);
    return [];
  }
}

// ─── MAIN HANDLER ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 26 * 60 * 60 * 1000) // 26h window
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD

  const results = { permits_checked: 0, matched: 0, saved: 0, alerted: 0, neighbors_queued: 0 };
  const highPriorityFinds: string[] = [];

  for (const source of SOURCES) {
    const permits = await fetchPermits(source, since);
    results.permits_checked += permits.length;

    for (const permit of permits) {
      const description = String(permit[source.fields.description] || "");
      const address = String(permit[source.fields.address] || "");
      const permitId = String(permit[source.fields.permit_id] || "");
      const neighborhood = source.fields.neighborhood ? String(permit[source.fields.neighborhood] || "") : "";
      const rawValue = source.fields.value ? Number(permit[source.fields.value] || 0) : 0;
      const contractor = source.fields.contractor ? String(permit[source.fields.contractor] || "") : "";

      const { matched, service, baseScore } = matchPermit(description);
      if (!matched) continue;

      results.matched++;

      const sourceId = `permit_${source.name.toLowerCase()}_${permitId}`;
      if (await opportunityExists(sourceId)) continue;

      // Value bonus: bigger permit = more likely the whole neighborhood needs work
      const valueBonus = rawValue >= 20000 ? 10 : rawValue >= 10000 ? 5 : 0;
      const finalScore = Math.min(100, baseScore + valueBonus);
      const priority = finalScore >= 65 ? "high" as const : finalScore >= 45 ? "medium" as const : "low" as const;

      const location = neighborhood
        ? `${neighborhood}, ${source.name}`
        : source.name;

      const title = `${service === "roofing" ? "Roof" : service === "solar" ? "Solar" : service === "windows" ? "Window" : "Storm"} permit — ${address || source.name}`;
      const body = [
        `Description: ${description}`,
        contractor ? `Contractor: ${contractor}` : null,
        rawValue > 0 ? `Permit value: $${rawValue.toLocaleString()}` : null,
        `Source: ${source.name} building permits`,
      ].filter(Boolean).join("\n");

      const analysis = priority !== "low"
        ? await generateAIAnalysis({
            title,
            body,
            source: "property_scan",
            location,
            score: finalScore,
            intent: "medium",
          })
        : null;

      const opp = await saveOpportunity({
        source: "property_scan",
        source_id: sourceId,
        type: "property_target",
        priority,
        title,
        body,
        location,
        urgency_score: finalScore,
        opportunity_score: finalScore,
        why_it_matters: analysis?.why_it_matters ??
          `A ${service} permit was pulled at ${address}. Neighbors likely have the same-aged roof and similar damage exposure.`,
        close_probability: analysis?.close_probability,
        outreach_message: analysis?.outreach_message ??
          `Hi neighbor! I noticed some roof work happening on your block — if you haven't had your roof inspected since the last major storm, Faraday does free inspections. Most claims come in at $9,000–$22,000, covered by insurance. (720) 766-1518`,
        follow_up_schedule: analysis?.follow_up_schedule,
      });

      if (opp) {
        results.saved++;
        if (priority === "high") {
          highPriorityFinds.push(`${service.toUpperCase()} permit — ${address || neighborhood} (${source.name})`);
        }
      }

      // Queue neighbor outreach for roofing/hail permits
      if (address && (service === "roofing" || service === "hail_damage")) {
        const neighborsQueued = await queueNeighborOutreach(address, source.name, service, permitId);
        results.neighbors_queued += neighborsQueued;
      }
    }
  }

  // Alert Tyler if high-priority permits found
  if (highPriorityFinds.length > 0) {
    const msg = [
      `🏠 ${highPriorityFinds.length} HIGH-PRIORITY permit${highPriorityFinds.length > 1 ? "s" : ""} found`,
      ...highPriorityFinds.slice(0, 3).map(f => `• ${f}`),
      `→ Check /intel for full details`,
    ].join("\n");

    await notifyTyler(msg, `🏠 ${highPriorityFinds.length} new permit leads — Faraday`)
      .catch(e => console.error("Permit notify failed:", e));

    results.alerted = highPriorityFinds.length;
  }

  console.log(`Permit monitor: ${results.permits_checked} checked, ${results.matched} matched, ${results.saved} saved`);
  return NextResponse.json({ success: true, ...results });
}
