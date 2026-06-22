// Storm chaser partner tracking links
// /api/track/[slug] → logs click to partner_clicks → redirects with UTM

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

async function logClick(partner: string, ip: string, userAgent: string, referrer: string): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    // Hash the IP for privacy (GDPR-friendly)
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    await getSupabase().from("partner_clicks").insert({
      partner_slug: partner,
      user_agent: userAgent,
      ip_hash: ipHash,
      referrer,
    });
  } catch (e) {
    console.error("Partner click log failed:", e);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partner: string }> }
) {
  const { partner } = await params;
  const slug = partner.toLowerCase().replace(/[^a-z0-9-]/g, "");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "";
  const referrer = req.headers.get("referer") || "";

  // Await the click log before redirecting — on serverless, fire-and-forget work
  // after the response is sent can be dropped, under-counting clicks. logClick
  // swallows its own errors, so awaiting never blocks the redirect on failure.
  await logClick(slug, ip, userAgent, referrer);

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com";
  const dest = new URL("/hail-map", base);
  dest.searchParams.set("utm_source", slug);
  dest.searchParams.set("utm_medium", "referral");
  dest.searchParams.set("utm_campaign", "storm_chaser");

  return NextResponse.redirect(dest.toString(), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
