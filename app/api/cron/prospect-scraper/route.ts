// CRON: Prospect Scraper — runs every Monday at 6am MT
// PRIMARY: OpenStreetMap Overpass API — 100% free, no API key required.
// FALLBACK: Google Places API (if GOOGLE_PLACES_API_KEY is set).
//
// Scrapes HOAs, property managers, insurance agents, real estate offices,
// and mortgage brokers across the Colorado Front Range.
// Adds up to 60 new prospects per run (up from 20 with Google Places).

import { NextRequest, NextResponse } from "next/server";
import { hasMXRecord } from "@/lib/resend";

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
        signal: AbortSignal.timeout(8000),
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

// Scrape the company's website for a real email address — mailto: links are authoritative.
// Falls back to guessing info@ on the domain only if no email is found.
async function resolveEmail(website: string | null | undefined): Promise<{ email: string; status: "scraped" | "inferred" } | null> {
  if (!website) return null;
  const url = website.startsWith("http") ? website : `https://${website}`;
  let domain: string;
  try { domain = new URL(url).hostname.replace(/^www\./, ""); }
  catch { return null; }

  // Try to scrape a real email from the website
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    if (res.ok) {
      const html = await res.text();
      // mailto: links are the most reliable signal
      const mailto = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
      if (mailto) {
        const found = mailto[1].toLowerCase();
        // Skip noreply/donotreply and emails on different domains (CDN artifacts)
        if (!found.includes("noreply") && !found.includes("donotreply") && found.endsWith(`@${domain}`)) {
          return { email: found, status: "scraped" };
        }
      }
    }
  } catch { /* timeout or fetch error — fall through to guess */ }

  // Infer info@ on the domain as a last resort
  return { email: `info@${domain}`, status: "inferred" };
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

  // ── Phase 1: Overpass API (free, no key) — run in parallel ─────────────────
  const shuffledQueries = OVERPASS_QUERIES.sort(() => Math.random() - 0.5).slice(0, 3);

  const overpassResults = await Promise.allSettled(
    shuffledQueries.map(target => overpassQuery(target.query).then(elements => ({ elements, type: target.type })))
  );

  for (const r of overpassResults) {
    if (r.status !== "fulfilled") continue;
    const { elements, type } = r.value;
    for (const el of elements) {
      const p = overpassToProspect(el, type);
      if (p) prospects.push(p);
    }
    results.overpass_found += elements.length;
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
        prospects.push({
          name: details.name,
          email: null, // resolved below
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

  // ── Insert new prospects (with email resolution + MX gate) ──────────────────
  for (const p of prospects) {
    if (results.added >= 60) break;

    // 1. If OSM gave us a real email, use it. Otherwise scrape the website.
    const resolved = p.email
      ? { email: p.email, status: "scraped" as const }
      : await resolveEmail(p.website);

    if (!resolved) { results.skipped++; continue; }

    const email = resolved.email.toLowerCase();
    if (existingEmails.has(email)) { results.skipped++; continue; }

    // 2. MX gate — discard any address whose domain has no working mail server
    const mxOk = await hasMXRecord(email);
    if (!mxOk) { results.skipped++; continue; }

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
        email_status: resolved.status, // "scraped" | "inferred"
        added_by: "prospect_scraper",
      },
    });

    if (insertErr) {
      if (!insertErr.message?.includes("duplicate") && !insertErr.code?.includes("23505")) {
        console.error("Insert failed:", insertErr.message);
      }
      results.skipped++;
    } else {
      existingEmails.add(email);
      results.added++;
    }
  }

  console.log(`Prospect scraper (${results.source}): ${results.overpass_found} OSM + ${results.google_found} Google → ${results.added} added, ${results.skipped} skipped`);
  return NextResponse.json({ success: true, ...results });
}
