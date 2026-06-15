// CRON: Prospect Scraper — runs every Monday at 6am MT
// Uses Google Places API to find insurance agents, mortgage brokers, and
// property managers in Colorado. Populates outbound_prospects for Anna to contact.
//
// Targets insurance agents and mortgage brokers first — they have direct client
// relationships and can send steady referrals year-round regardless of storm season.
//
// Requires: GOOGLE_PLACES_API_KEY, SUPABASE_URL
// Each run adds up to 20 new prospects to the queue.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number } };
  types?: string[];
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  email?: string;
}

const SEARCH_TARGETS = [
  // Insurance — refer clients with storm damage year-round
  { query: "independent insurance agent Colorado Front Range", type: "insurance_agent", city_hint: "Denver" },
  { query: "insurance agency Colorado hail storm", type: "insurance_agent", city_hint: "Boulder" },
  // Property managers — many properties, pre-approved budgets
  { query: "property management company Denver Colorado", type: "property_manager", city_hint: "Denver" },
  { query: "apartment complex property manager Colorado", type: "apartment_manager", city_hint: "Aurora" },
  { query: "condo association management company Colorado", type: "condo_manager", city_hint: "Littleton" },
  // HOA — manage entire communities
  { query: "HOA management company Colorado", type: "hoa_manager", city_hint: "Littleton" },
  { query: "homeowners association management Colorado", type: "hoa_manager", city_hint: "Castle Rock" },
  // Mortgage / title — borrowers need roof certs before closing
  { query: "mortgage broker Colorado homeowners", type: "mortgage_broker", city_hint: "Fort Collins" },
  { query: "mortgage lender Colorado Front Range purchase", type: "mortgage_broker", city_hint: "Westminster" },
  { query: "title company Colorado real estate closing", type: "title_company", city_hint: "Broomfield" },
  // Realtors — listing agents need roof certs, buyer agents want reliable inspectors
  { query: "real estate broker Colorado Front Range", type: "realtor", city_hint: "Aurora" },
  { query: "real estate agent Denver hail storm homes", type: "realtor", city_hint: "Denver" },
];

async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      query,
      key: apiKey,
      type: "establishment",
      region: "us",
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 10) as PlaceResult[];
  } catch {
    return [];
  }
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "name,formatted_address,formatted_phone_number,website",
      key: apiKey,
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const r = data.result;
    return r ? {
      place_id: placeId,
      name: r.name,
      formatted_address: r.formatted_address || "",
      formatted_phone_number: r.formatted_phone_number,
      website: r.website,
    } : null;
  } catch {
    return null;
  }
}

function extractCity(address: string): string {
  // "123 Main St, Denver, CO 80202, USA" → "Denver"
  const parts = address.split(",");
  if (parts.length >= 2) return parts[parts.length - 3]?.trim() || parts[1]?.trim() || "";
  return "";
}

function extractEmail(website: string | undefined): string | null {
  // We can't scrape email from website in this context, but we'll note the website
  // and Anna can use contact form outreach as an alternative.
  return null;
}

// Generate a plausible contact email from business name + domain if we have a website
function guessEmail(name: string, website?: string): string | null {
  if (!website) return null;
  try {
    const domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname
      .replace(/^www\./, "");
    // Common patterns for small businesses
    return `contact@${domain}`;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: "SUPABASE_URL not set" }, { status: 503 });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({
      success: false,
      message: "GOOGLE_PLACES_API_KEY not set — add it to Vercel env vars to enable auto-prospecting",
    });
  }

  const { getSupabase } = await import("@/lib/supabase");
  const db = getSupabase();

  // Fetch existing emails so we don't add duplicates
  const { data: existing } = await db
    .from("outbound_prospects")
    .select("email")
    .limit(1000);
  const existingEmails = new Set((existing || []).map(r => r.email.toLowerCase()));

  const results = { searched: 0, found: 0, added: 0, skipped: 0 };

  // Pick 3 random targets each week to vary the outreach
  const shuffled = SEARCH_TARGETS.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const target of shuffled) {
    results.searched++;
    const places = await searchPlaces(target.query);

    for (const place of places) {
      results.found++;
      const details = await getPlaceDetails(place.place_id);
      if (!details) continue;

      const email = guessEmail(details.name, details.website);
      if (!email) {
        results.skipped++;
        continue;
      }

      if (existingEmails.has(email.toLowerCase())) {
        results.skipped++;
        continue;
      }

      const city = extractCity(details.formatted_address);

      const { error: insertErr } = await db.from("outbound_prospects").insert({
        email,
        name: details.name,
        company: details.name,
        city,
        status: "new",
        source: target.type,
        metadata: {
          place_id: place.place_id,
          address: details.formatted_address,
          phone: details.formatted_phone_number,
          website: details.website,
          prospect_type: target.type,
          added_by: "prospect_scraper",
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

      if (results.added >= 20) break; // Cap per run to avoid spam flags
    }

    if (results.added >= 20) break;
  }

  console.log(`Prospect scraper: ${results.found} found, ${results.added} added, ${results.skipped} skipped`);
  return NextResponse.json({ success: true, ...results });
}
