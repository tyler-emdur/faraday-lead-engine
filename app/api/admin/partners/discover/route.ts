// Phase 3: Partner Discovery
// Promotes already-collected outbound_prospects into managed partner *candidates*
// (status='identified') so Tyler can work them through the lifecycle and convert
// them once into permanent, attributed referral nodes.
//
// $0, no scraping: reuses the prospect data already in the DB. Maps the prospect's
// `source` (its business type) to a valid partner `type`. Deduped by slug.
//
// POST body (all optional): { types?: string[], limit?: number }

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { normalizeSlug } from "@/lib/partners";

// outbound_prospects.source  →  partners.type
const TYPE_MAP: Record<string, string> = {
  public_adjuster: "public_adjuster",
  home_inspector: "home_inspector",
  property_manager: "property_manager",
  apartment_manager: "property_manager",
  condo_manager: "property_manager",
  hoa_manager: "hoa_manager",
  insurance_agent: "insurance_agent",
  restoration_contractor: "restoration_contractor",
  gutter_company: "gutter_company",
  solar_installer: "solar_installer",
  general_contractor: "general_contractor",
  small_roofer: "general_contractor",
  plumber: "plumber",
  hvac_company: "hvac_company",
  exterior_painter: "other",
  realtor: "realtor",
  mortgage_broker: "mortgage_broker",
  title_company: "title_company",
};

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_URL) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 200, 500);
  const typeFilter: string[] | null = Array.isArray(body.types) && body.types.length ? body.types : null;

  const db = getSupabase();

  // Eligible prospects: real business, not burned, not already a partner-type we can't use.
  let q = db
    .from("outbound_prospects")
    .select("id, name, company, city, email, source, metadata")
    .neq("status", "do_not_contact")
    .neq("status", "unqualified")
    .limit(limit);
  if (typeFilter) q = q.in("source", typeFilter);
  const { data: prospects, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!prospects?.length) return NextResponse.json({ imported: 0, skipped: 0, partners: [] });

  // Existing slugs to dedupe against
  const { data: existing } = await db.from("partners").select("slug");
  const usedSlugs = new Set((existing || []).map((p) => p.slug));

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const p of prospects) {
    const label = p.company || p.name;
    if (!label) { skipped++; continue; }
    let slug = normalizeSlug(label);
    if (!slug) { skipped++; continue; }
    // Ensure uniqueness across existing + this batch
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    usedSlugs.add(slug);

    const phone = (p.metadata as Record<string, unknown>)?.phone as string | undefined;
    toInsert.push({
      slug,
      name: p.name || null,
      company: p.company || null,
      type: TYPE_MAP[p.source] || "other",
      contact_email: p.email || null,
      contact_phone: phone || null,
      status: "identified",
      referral_fee: 25,
      source: `discovery:${p.source || "outbound_prospects"}`,
      notes: p.city ? `City: ${p.city}` : null,
    });
  }

  if (toInsert.length === 0) return NextResponse.json({ imported: 0, skipped, partners: [] });

  const { data: inserted, error: insErr } = await db.from("partners").insert(toInsert).select("id, slug, name, type");
  if (insErr) return NextResponse.json({ error: insErr.message, skipped }, { status: 500 });

  return NextResponse.json({ imported: inserted?.length || 0, skipped, partners: inserted });
}
