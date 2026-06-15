// CRON: Prospect Scraper — runs every Monday at 6am MT
// PRIMARY: OpenStreetMap Overpass API — 100% free, no API key required.
// FALLBACK: Google Places API (if GOOGLE_PLACES_API_KEY is set).
//
// Scrapes HOAs, property managers, insurance agents, real estate offices,
// and mortgage brokers across the Colorado Front Range.
// Adds up to 60 new prospects per run (up from 20 with Google Places).

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Colorado Front Range bounding box [south, west, north, east]
const CO_BBOX = "39.3,-105.3,40.9,-104.5";

// Overpass QL queries — each targets a different prospect type
const OVERPASS_QUERIES = [
  {
    query: `[out:json][timeout:25];(node["office"="insurance"](${CO_BBOX});way["office"="insurance"](${CO_BBOX}););out center;`,
    type: "insurance_agent",
  },
  {
    query: `[out:json][timeout:25];(node["office"="real_estate"](${CO_BBOX});way["office"="real_estate"](${CO_BBOX}););out center;`,
    type: "realtor",
  },
  {
    query: `[out:json][timeout:25];(node["office"="property_management"](${CO_BBOX});way["office"="property_management"](${CO_BBOX}););out center;`,
    type: "property_manager",
  },
  {
    query: `[out:json][timeout:25];(node["office"="association"](${CO_BBOX});way["office"="association"](${CO_BBOX});node["amenity"="community_centre"]["name"~"HOA|homeowner|homeowners|association",i](${CO_BBOX}););out center;`,
    type: "hoa_manager",
  },
  {
    query: `[out:json][timeout:25];(node["office"="financial"](${CO_BBOX});node["amenity"="bank"]["name"~"mortgage|lending|credit union",i](${CO_BBOX}););out center;`,
    type: "mortgage_broker",
  },
];

// Extended Front Range cities for Google Places fallback
const GOOGLE_SEARCH_TARGETS = [
  { query: "independent insurance agent Colorado Front Range", type: "insurance_agent", city_hint: "Denver" },
  { query: "insurance agency Colorado hail storm", type: "insurance_agent", city_hint: "Boulder" },
  { query: "property management company Denver Colorado", type: "property_manager", city_hint: "Denver" },
  { query: "apartment complex property manager Colorado", type: "apartment_manager", city_hint: "Aurora" },
  { query: "condo association management company Colorado", type: "condo_manager", city_hint: "Littleton" },
  { query: "HOA management company Colorado", type: "hoa_manager", city_hint: "Littleton" },
  { query: "homeowners association management Colorado", type: "hoa_manager", city_hint: "Castle Rock" },
  { query: "mortgage broker Colorado homeowners", type: "mortgage_broker", city_hint: "Fort Collins" },
  { query: "real estate broker Colorado Front Range", type: "realtor", city_hint: "Aurora" },
];

// ── Overpass API ──────────────────────────────────────────────────────────────

interface OverpassElement {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function overpassQuery(ql: string): Promise<OverpassElement[]> {
  // Use multiple Overpass endpoints to avoid rate-limiting one
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(ql)}`,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { elements?: OverpassElement[] };
      return data.elements || [];
    } catch {
      continue;
    }
  }
  return [];
}

function overpassToProspect(el: OverpassElement, type: string) {
  const tags = el.tags || {};
  const name = tags["name"] || tags["operator"] || "";
  if (!name) return null;

  const email = tags["email"] || tags["contact:email"] || null;
  const phone = tags["phone"] || tags["contact:phone"] || tags["contact:mobile"] || null;
  const website = tags["website"] || tags["contact:website"] || tags["url"] || null;
  const city = tags["addr:city"] || tags["addr:suburb"] || "";

  // Skip non-Colorado entries that might leak in
  const state = tags["addr:state"] || "";
  if (state && state !== "CO" && state !== "Colorado") return null;

  // Without email or website, we can't contact them
  if (!email && !website) return null;

  return { name, email, phone, website, city, type };
}

// ── Google Places fallback ────────────────────────────────────────────────────

async function googlePlacesSearch(query: string): Promise<{ name: string; place_id: string }[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({ query, key: apiKey, type: "establishment", region: "us" });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: { name: string; place_id: string }[] };
    return (data.results || []).slice(0, 8);
  } catch { return []; }
}

async function googlePlacesDetails(placeId: string): Promise<{
  name: string; formatted_address: string; phone?: string; website?: string
} | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "name,formatted_address,formatted_phone_number,website",
      key: apiKey,
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: { name: string; formatted_address: string; formatted_phone_number?: string; website?: string } };
    const r = data.result;
    return r ? { name: r.name, formatted_address: r.formatted_address || "", phone: r.formatted_phone_number, website: r.website } : null;
  } catch { return null; }
}

function guessEmail(name: string, website?: string): string | null {
  if (!website) return null;
  try {
    const domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    return `contact@${domain}`;
  } catch { return null; }
}

function extractCity(address: string): string {
  const parts = address.split(",");
  if (parts.length >= 2) return parts[parts.length - 3]?.trim() || parts[1]?.trim() || "";
  return "";
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: "SUPABASE_URL not set" }, { status: 503 });
  }

  const { getSupabase } = await import("@/lib/supabase");
  const db = getSupabase();

  const { data: existing } = await db.from("outbound_prospects").select("email").limit(2000);
  const existingEmails = new Set((existing || []).map(r => r.email.toLowerCase()));

  const results = { source: "", overpass_found: 0, google_found: 0, added: 0, skipped: 0 };

  const prospects: { name: string; email: string | null; phone?: string | null; website?: string | null; city?: string; type: string }[] = [];

  // ── Phase 1: Overpass API (free, no key) ────────────────────────────────────
  const shuffledQueries = OVERPASS_QUERIES.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const target of shuffledQueries) {
    const elements = await overpassQuery(target.query);
    for (const el of elements) {
      const p = overpassToProspect(el, target.type);
      if (p) prospects.push(p);
    }
    results.overpass_found += elements.length;
    // small delay to be a good citizen
    await new Promise(r => setTimeout(r, 500));
  }
  results.source = "overpass";

  // ── Phase 2: Google Places fallback ─────────────────────────────────────────
  if (process.env.GOOGLE_PLACES_API_KEY) {
    const gTargets = GOOGLE_SEARCH_TARGETS.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const target of gTargets) {
      const places = await googlePlacesSearch(target.query);
      for (const place of places) {
        const details = await googlePlacesDetails(place.place_id);
        if (!details) continue;
        const email = guessEmail(details.name, details.website);
        prospects.push({
          name: details.name,
          email,
          phone: details.phone,
          website: details.website,
          city: extractCity(details.formatted_address),
          type: target.type,
        });
        results.google_found++;
      }
    }
    results.source = "overpass+google";
  }

  // ── Insert new prospects ─────────────────────────────────────────────────────
  for (const p of prospects) {
    if (results.added >= 60) break;

    // Determine the email to use for dedup
    const email = p.email || (p.website ? guessEmail(p.name, p.website || undefined) : null);
    if (!email) { results.skipped++; continue; }
    if (existingEmails.has(email.toLowerCase())) { results.skipped++; continue; }

    const { error: insertErr } = await db.from("outbound_prospects").insert({
      email,
      name: p.name,
      company: p.name,
      city: p.city || "",
      website: p.website || null,
      city_hint: p.city || null,
      status: "new",
      source: p.type,
      metadata: {
        phone: p.phone,
        website: p.website,
        prospect_type: p.type,
        added_by: "prospect_scraper_overpass",
      },
    });

    if (insertErr) {
      if (!insertErr.message?.includes("duplicate") && !insertErr.code?.includes("23505")) {
        console.error("Insert failed:", insertErr.message);
      }
      results.skipped++;
    } else {
      existingEmails.add(email.toLowerCase());
      results.added++;
    }
  }

  console.log(`Prospect scraper (${results.source}): ${results.overpass_found} OSM + ${results.google_found} Google → ${results.added} added, ${results.skipped} skipped`);
  return NextResponse.json({ success: true, ...results });
}
