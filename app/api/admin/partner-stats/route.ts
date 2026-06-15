import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  if (!process.env.SUPABASE_URL) return NextResponse.json({ partners: [] });

  const db = getSupabase();

  const { data: clicks } = await db
    .from("partner_clicks")
    .select("partner_slug, lead_id");

  if (!clicks || clicks.length === 0) return NextResponse.json({ partners: [] });

  // Aggregate by slug
  const stats: Record<string, { clicks: number; leads: number }> = {};
  for (const c of clicks) {
    if (!stats[c.partner_slug]) stats[c.partner_slug] = { clicks: 0, leads: 0 };
    stats[c.partner_slug].clicks++;
    if (c.lead_id) stats[c.partner_slug].leads++;
  }

  const partners = Object.entries(stats).map(([slug, s]) => ({
    slug,
    clicks: s.clicks,
    leads: s.leads,
    conversionRate: s.clicks > 0 ? Math.round((s.leads / s.clicks) * 100) : 0,
    estimatedValue: s.leads * 100,
    trackingUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com"}/api/track/${slug}`,
  }));

  return NextResponse.json({ partners: partners.sort((a, b) => b.leads - a.leads) });
}
