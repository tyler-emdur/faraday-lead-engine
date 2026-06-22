// Partner network admin API — Phase 1.
// GET   → all partners with live stats (clicks, leads, accepted, earnings)
// POST  → create a partner record (issues their tracking slug)
// PATCH → update a partner (status, ZIP assignment, referral fee, contact, etc.)

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { normalizeSlug } from "@/lib/partners";

const LEAD_VALUE = 100; // what Faraday pays per accepted lead

export async function GET() {
  if (!process.env.SUPABASE_URL) return NextResponse.json({ partners: [] });
  const db = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";

  const [{ data: partners }, { data: clicks }, { data: leads }] = await Promise.all([
    db.from("partners").select("*").order("created_at", { ascending: false }),
    db.from("partner_clicks").select("partner_slug, lead_id"),
    db.from("leads").select("partner_id, accepted").not("partner_id", "is", null),
  ]);

  // Clicks aggregated by slug
  const clickStats: Record<string, { clicks: number; creditedClicks: number }> = {};
  for (const c of clicks || []) {
    const s = clickStats[c.partner_slug] ||= { clicks: 0, creditedClicks: 0 };
    s.clicks++;
    if (c.lead_id) s.creditedClicks++;
  }

  // Leads aggregated by partner_id (direct attribution = source of truth for $)
  const leadStats: Record<string, { leads: number; accepted: number }> = {};
  for (const l of leads || []) {
    const s = leadStats[l.partner_id] ||= { leads: 0, accepted: 0 };
    s.leads++;
    if (l.accepted) s.accepted++;
  }

  const registeredSlugs = new Set<string>();
  const rows = (partners || []).map((p) => {
    registeredSlugs.add(p.slug);
    const c = clickStats[p.slug] || { clicks: 0, creditedClicks: 0 };
    const ls = leadStats[p.id] || { leads: 0, accepted: 0 };
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      company: p.company,
      type: p.type,
      status: p.status,
      contact_phone: p.contact_phone,
      contact_email: p.contact_email,
      zip_codes: p.zip_codes || [],
      referral_fee: p.referral_fee || 0,
      registered: true,
      clicks: c.clicks,
      leads: ls.leads,
      accepted: ls.accepted,
      conversionRate: c.clicks > 0 ? Math.round((ls.leads / c.clicks) * 100) : 0,
      grossRevenue: ls.accepted * LEAD_VALUE,
      netRevenue: ls.accepted * (LEAD_VALUE - (p.referral_fee || 0)),
      trackingUrl: `${siteUrl}/api/track/${p.slug}`,
    };
  });

  // Legacy ghost slugs (clicks exist but no partner record) — surface so they can be claimed
  for (const [slug, c] of Object.entries(clickStats)) {
    if (registeredSlugs.has(slug)) continue;
    rows.push({
      id: "", slug, name: null, company: null, type: "other", status: "unregistered",
      contact_phone: null, contact_email: null, zip_codes: [], referral_fee: 0, registered: false,
      clicks: c.clicks, leads: c.creditedClicks, accepted: 0,
      conversionRate: c.clicks > 0 ? Math.round((c.creditedClicks / c.clicks) * 100) : 0,
      grossRevenue: 0, netRevenue: 0,
      trackingUrl: `${siteUrl}/api/track/${slug}`,
    });
  }

  rows.sort((a, b) => b.accepted - a.accepted || b.leads - a.leads || b.clicks - a.clicks);
  return NextResponse.json({ partners: rows });
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_URL) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const body = await req.json();
  const slug = normalizeSlug(body.slug || body.name || "");
  if (!slug) return NextResponse.json({ error: "slug or name required" }, { status: 400 });

  const zip_codes = Array.isArray(body.zip_codes)
    ? body.zip_codes
    : String(body.zip_codes || "").split(/[,\s]+/).map((z: string) => z.trim()).filter(Boolean);

  const { data, error } = await getSupabase().from("partners").insert({
    slug,
    name: body.name || null,
    company: body.company || null,
    type: body.type || "other",
    contact_phone: body.contact_phone || null,
    contact_email: body.contact_email || null,
    status: body.status || "identified",
    zip_codes,
    referral_fee: (body.referral_fee === "" || body.referral_fee == null) ? 25 : Number(body.referral_fee),
    notes: body.notes || null,
    source: body.source || "manual",
  }).select().single();

  if (error) {
    const msg = error.code === "23505" ? "A partner with that slug already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ success: true, partner: data });
}

export async function PATCH(req: NextRequest) {
  if (!process.env.SUPABASE_URL) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = ["name", "company", "type", "contact_phone", "contact_email", "status", "referral_fee", "notes"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
  if (body.zip_codes !== undefined) {
    updates.zip_codes = Array.isArray(body.zip_codes)
      ? body.zip_codes
      : String(body.zip_codes).split(/[,\s]+/).map((z: string) => z.trim()).filter(Boolean);
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const { data, error } = await getSupabase().from("partners").update(updates).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, partner: data });
}
