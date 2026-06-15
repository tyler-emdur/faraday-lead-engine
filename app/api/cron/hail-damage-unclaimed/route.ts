// CRON: Hail Damage Unclaimed — runs weekly on Monday at 8am MT
// Colorado gives homeowners 3 years to file a hail claim. Thousands of homes
// were hit 1-2 years ago and the owners never knew.
//
// How it works:
//   1. Pull historical storm events from storm_events table (12-30 months ago)
//   2. Get all roofing permits from Denver's Socrata API for those zip codes
//      AFTER the storm date — these are homes that already got fixed
//   3. Areas with few/no post-storm roofing permits = unclaimed damage goldmine
//   4. Create high-priority intel opportunities for those zip codes
//   5. Notify Tyler with a canvassing target list
//
// Requires: SUPABASE_URL (for storm_events)
// Optional: DENVER_PERMITS_APP_TOKEN (for higher rate limits)

import { NextRequest, NextResponse } from "next/server";
import { saveOpportunity, opportunityExists } from "@/lib/intel";
import { notifyTyler } from "@/lib/notify";

export const maxDuration = 60;

const PERMITS_ENDPOINT = "https://data.denvergov.org/resource/rbth-yxmr.json";

interface StormEvent {
  id: string;
  zip_codes: string[];
  affected_cities: string[];
  hail_size_inches: number | null;
  detected_at: string;
  nws_alert_id: string;
}

interface PermitRow {
  permit_no?: string;
  type_description?: string;
  address?: string;
  issued_date?: string;
  neighborhood_id?: string;
}

const ROOFING_KEYWORDS = ["reroof", "re-roof", "roof replacement", "roofing", "shingle", "hail damage roof", "storm damage roof"];

function isRoofPermit(description: string): boolean {
  const lower = description.toLowerCase();
  return ROOFING_KEYWORDS.some(k => lower.includes(k));
}

async function fetchRoofPermitsSince(sinceDate: string): Promise<PermitRow[]> {
  const appToken = process.env.DENVER_PERMITS_APP_TOKEN;
  const params = new URLSearchParams({
    "$where": `issued_date >= '${sinceDate}'`,
    "$limit": "500",
    "$order": "issued_date DESC",
  });
  const headers: Record<string, string> = { "Accept": "application/json", "User-Agent": "FaradayLeadBot/1.0" };
  if (appToken) headers["X-App-Token"] = appToken;

  try {
    const res = await fetch(`${PERMITS_ENDPOINT}?${params}`, { headers, next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json() as PermitRow[];
    return data.filter(p => isRoofPermit(String(p.type_description || "")));
  } catch { return []; }
}

async function fetchHistoricalStorms(): Promise<StormEvent[]> {
  if (!process.env.SUPABASE_URL) return [];
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();

    // 12–30 months ago (claim window still open, enough time has passed)
    const thirtyMonthsAgo = new Date(Date.now() - 30 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const twelveMonthsAgo = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await db
      .from("storm_events")
      .select("id, zip_codes, affected_cities, hail_size_inches, detected_at, nws_alert_id")
      .gte("detected_at", thirtyMonthsAgo)
      .lte("detected_at", twelveMonthsAgo)
      .not("zip_codes", "eq", "{}")
      .order("hail_size_inches", { ascending: false })
      .limit(20);

    return (data || []) as StormEvent[];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { storms_checked: 0, permit_zip_matches: 0, unclaimed_areas: 0, saved: 0 };
  const hotTargets: string[] = [];

  const storms = await fetchHistoricalStorms();
  results.storms_checked = storms.length;

  if (storms.length === 0) {
    return NextResponse.json({ success: true, ...results, message: "No historical storm data yet — storm_events table will fill as storm-check runs" });
  }

  for (const storm of storms) {
    if (!storm.zip_codes?.length && !storm.affected_cities?.length) continue;

    const stormDate = storm.detected_at.slice(0, 10);
    const hailInches = storm.hail_size_inches || 0.75;
    const cities = storm.affected_cities?.slice(0, 3) || [];

    // Fetch roofing permits from Denver AFTER this storm date
    const postStormPermits = await fetchRoofPermitsSince(stormDate);
    results.permit_zip_matches += postStormPermits.length;

    // Group permits by neighborhood
    const permittedNeighborhoods = new Set(
      postStormPermits.map(p => (p.neighborhood_id || "").toLowerCase()).filter(Boolean)
    );

    // For each affected city, check if they've had significant permit activity
    for (const city of cities) {
      const cityLower = city.toLowerCase();
      // If this city is NOT in the permitted areas, it's likely unclaimed
      const hasSomePermits = [...permittedNeighborhoods].some(n => n.includes(cityLower.split(" ")[0]));

      const sourceId = `unclaimed_${storm.nws_alert_id}_${cityLower.replace(/\s+/g, "_")}`;
      if (await opportunityExists(sourceId)) continue;

      const urgency = hailInches >= 1.5 ? 85 : hailInches >= 1.0 ? 70 : 55;
      const permitNote = hasSomePermits
        ? "Some post-storm roofing activity detected — many homes still unclaimed"
        : "No post-storm roofing permits found — area is largely untouched";

      results.unclaimed_areas++;

      const opp = await saveOpportunity({
        source: "property_scan",
        source_id: sourceId,
        type: "storm_victim_area",
        priority: urgency >= 70 ? "high" : "medium",
        title: `Unclaimed Hail Damage — ${city} (${stormDate})`,
        body: `${hailInches}" hail hit ${city} on ${stormDate}. ${permitNote}. Colorado has 3-year claim window — these homeowners still qualify.`,
        location: city,
        urgency_score: urgency,
        opportunity_score: urgency,
        why_it_matters: `${city} was hit by ${hailInches}" hail on ${stormDate} and appears to have low post-storm roofing permit activity. These homeowners have covered damage they don't know about. 3-year claim window is still open. Free inspection canvassing in this area should yield 5–15 warm leads per block.`,
        outreach_message: `Hi! Faraday Construction is reaching out to homeowners in ${city} who may have undiscovered hail damage from ${new Date(stormDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}. We offer free inspections — most claims come in at $9,000–$22,000 and insurance covers everything except your deductible. (720) 766-1518`,
        close_probability: 30,
        follow_up_schedule: "Door-knock or direct mail campaign targeting the neighborhood. Urgency: 3-year claim window.",
      });

      if (opp) {
        results.saved++;
        if (urgency >= 70) {
          hotTargets.push(`${city} — ${hailInches}" hail ${stormDate}${hasSomePermits ? "" : " (no permits filed!)"}`);
        }
      }
    }
  }

  if (hotTargets.length > 0) {
    const msg = [
      `🎯 ${hotTargets.length} UNCLAIMED HAIL DAMAGE AREA${hotTargets.length > 1 ? "S" : ""}`,
      ...hotTargets.slice(0, 4).map(t => `• ${t}`),
      `→ Door-knock or direct mail — claim window still open`,
    ].join("\n");
    await notifyTyler(msg, `🎯 Unclaimed Damage — Free Money`).catch(() => {});
  }

  console.log(`Unclaimed hail: ${results.storms_checked} storms, ${results.unclaimed_areas} unclaimed areas, ${results.saved} saved`);
  return NextResponse.json({ success: true, ...results });
}
