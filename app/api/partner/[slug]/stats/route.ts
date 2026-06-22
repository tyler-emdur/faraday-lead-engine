// Phase 4: Partner self-serve stats (public, keyed by the partner's own slug).
// The slug acts as a low-sensitivity access token — it only exposes that partner's
// own counts + masked lead history (no homeowner phone/email/last name).

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { normalizeSlug } from "@/lib/partners";

const LEAD_VALUE = 100;

function maskName(name: string | null): string {
  if (!name) return "A homeowner";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

function tier(accepted: number): string {
  if (accepted >= 25) return "Platinum";
  if (accepted >= 10) return "Gold";
  if (accepted >= 3) return "Silver";
  if (accepted >= 1) return "Bronze";
  return "New";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!process.env.SUPABASE_URL) return NextResponse.json({ error: "No DB" }, { status: 500 });
  const { slug: raw } = await params;
  const slug = normalizeSlug(raw);
  const db = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";

  const { data: partner } = await db
    .from("partners")
    .select("id, slug, name, company, type, referral_fee, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const [{ count: clicks }, { data: leads }] = await Promise.all([
    db.from("partner_clicks").select("id", { count: "exact", head: true }).eq("partner_slug", slug),
    db.from("leads")
      .select("name, city, service, status, accepted, accepted_at, created_at")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const all = leads || [];
  const accepted = all.filter((l) => l.accepted).length;
  const fee = partner.referral_fee || 0;

  return NextResponse.json({
    partner: { name: partner.name, company: partner.company, type: partner.type, status: partner.status },
    referralLink: `${siteUrl}/api/track/${partner.slug}`,
    stats: {
      clicks: clicks || 0,
      leads: all.length,
      accepted,
      pending: all.length - accepted,
      conversionRate: clicks ? Math.round((all.length / clicks) * 100) : 0,
      earnings: accepted * fee,
      feePerLead: fee,
      tier: tier(accepted),
    },
    recentLeads: all.slice(0, 20).map((l) => ({
      name: maskName(l.name),
      city: l.city,
      service: l.service,
      accepted: l.accepted,
      date: l.created_at,
    })),
  });
}
