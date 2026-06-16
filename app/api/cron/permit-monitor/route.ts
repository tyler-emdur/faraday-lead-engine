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

async function queueNeighborOutreach(
  address: string,
  city: string,
  service: string,
  permitId: string
): Promise<number> {
  if (!process.env.SUPABASE_URL) return 0;
  if (service !== "roofing" && service !== "hail_damage") return 0; // Only queue for roof work

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();

    const neighbors = generateNeighborAddresses(address);
    if (neighbors.length === 0) return 0;

    let queued = 0;
    for (const neighborAddr of neighbors) {
      const queueId = `neighbor_${permitId}_${neighborAddr.replace(/\s+/g, "_")}`;

      // Check if already queued
      const { data: existing } = await db
        .from("contact_form_queue")
        .select("id")
        .eq("business_name", `MAIL TO: ${neighborAddr}`)
        .maybeSingle();
      if (existing) continue;

      const draft = draftNeighborLetter(neighborAddr, address, city, service);

      await db.from("contact_form_queue").insert({
        business_name: `MAIL TO: ${neighborAddr}`,
        website: `${neighborAddr}, ${city}, CO`,
        source: "neighbor_blaster",
        city,
        drafted_message: draft,
        status: "pending_send",
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
