// Partner network helpers — Phase 1 referral infrastructure.
// A "partner" is anyone who refers homeowners via their own /api/track/<slug> link.
// Attribution flows: click → partner_clicks → lead capture stamps leads.partner_id
// and backfills the most recent matching click with the lead_id.

import { getSupabase } from "@/lib/supabase";

export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export interface Partner {
  id: string;
  slug: string;
  name: string | null;
  company: string | null;
  type: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  zip_codes: string[];
  referral_fee: number;
  notes: string | null;
}

// Resolve a partner record from a tracking slug (case/format-insensitive).
export async function getPartnerBySlug(slug: string): Promise<Partner | null> {
  if (!slug || !process.env.SUPABASE_URL) return null;
  try {
    const { data } = await getSupabase()
      .from("partners")
      .select("*")
      .eq("slug", normalizeSlug(slug))
      .maybeSingle();
    return (data as Partner) || null;
  } catch {
    return null;
  }
}

// Called at lead capture. Given the slug the homeowner arrived through (from the
// UTM source on their referral link), credit the partner: stamp leads.partner_id
// and backfill the most recent un-credited click for that slug.
export async function attributeLeadToPartner(leadId: string, slug: string | null | undefined): Promise<string | null> {
  if (!leadId || !slug || !process.env.SUPABASE_URL) return null;
  const norm = normalizeSlug(slug);
  if (!norm) return null;

  try {
    const db = getSupabase();
    const partner = await getPartnerBySlug(norm);

    // Stamp the lead even if no partner record exists yet (slug is still the credit key).
    if (partner) {
      await db.from("leads").update({ partner_id: partner.id }).eq("id", leadId);
    }

    // Backfill the most recent click for this slug that hasn't been credited yet,
    // so partner-stats can compute click→lead conversion.
    const { data: click } = await db
      .from("partner_clicks")
      .select("id")
      .eq("partner_slug", norm)
      .is("lead_id", null)
      .order("clicked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (click) {
      await db.from("partner_clicks").update({ lead_id: leadId }).eq("id", click.id);
    }

    return partner?.id || null;
  } catch (e) {
    console.error("Partner attribution failed:", e);
    return null;
  }
}
