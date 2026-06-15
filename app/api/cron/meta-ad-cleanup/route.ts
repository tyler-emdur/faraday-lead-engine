// CRON: Meta Ad Cleanup — runs daily at noon MT
// Pauses any Facebook/Instagram storm ads that have run for their target duration.
// Storm ads are created automatically by storm-check when hail is detected.
// This cron ensures we never waste money running them past the intended window.
//
// Requires: META_ACCESS_TOKEN, SUPABASE_URL
// New storm_facebook_ads table stores the campaign IDs + pause_at timestamp.

import { NextRequest, NextResponse } from "next/server";
import { pauseAdCampaign } from "@/lib/meta-ads";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL || !process.env.META_ACCESS_TOKEN) {
    return NextResponse.json({ success: true, paused: 0, message: "Meta ads not configured" });
  }

  const { getSupabase } = await import("@/lib/supabase");
  const db = getSupabase();

  // Find ads that should have been paused by now
  const { data: ads, error } = await db
    .from("storm_facebook_ads")
    .select("id, campaign_id, zip_code, pause_at")
    .eq("status", "active")
    .lte("pause_at", new Date().toISOString());

  if (error) {
    console.error("Meta ad cleanup query failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!ads || ads.length === 0) {
    return NextResponse.json({ success: true, paused: 0, message: "No ads due for pausing" });
  }

  let paused = 0;

  for (const ad of ads as { id: string; campaign_id: string; zip_code: string; pause_at: string }[]) {
    const ok = await pauseAdCampaign(ad.campaign_id);
    if (ok) {
      await db.from("storm_facebook_ads").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", ad.id);
      paused++;
      console.log(`Paused Meta campaign ${ad.campaign_id} (zip ${ad.zip_code})`);
    } else {
      console.error(`Failed to pause Meta campaign ${ad.campaign_id}`);
    }
  }

  console.log(`Meta ad cleanup: ${paused}/${ads.length} ads paused`);
  return NextResponse.json({ success: true, paused, total_due: ads.length });
}
