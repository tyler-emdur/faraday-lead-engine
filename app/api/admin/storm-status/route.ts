// GET /api/admin/storm-status — Returns live storm stats for the war room dashboard.
// Polled every 30s from the StormLiveStatus client component.

import { NextResponse } from "next/server";

export const maxDuration = 15;

export async function GET() {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ configured: false });
  }

  const { getSupabase } = await import("@/lib/supabase");
  const db = getSupabase();
  const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

  const [stormsRes, leadsRes, cronRes, subscribersRes] = await Promise.allSettled([
    db.from("storm_alerts").select("id, event, has_hail, affected_cities, detected_at").gte("detected_at", since7d).order("detected_at", { ascending: false }).limit(5),
    db.from("leads").select("id, source, created_at, status").gte("created_at", since24h),
    db.from("cron_logs").select("cron_name, result, leads_generated, actions_taken, started_at, metadata").eq("cron_name", "storm-check").gte("started_at", since24h).order("started_at", { ascending: false }).limit(10),
    db.from("storm_subscribers").select("id").eq("status", "active"),
  ]);

  const storms = stormsRes.status === "fulfilled" ? (stormsRes.value.data || []) : [];
  const leads24h = leadsRes.status === "fulfilled" ? (leadsRes.value.data || []) : [];
  const cronRuns = cronRes.status === "fulfilled" ? (cronRes.value.data || []) : [];
  const subscribers = subscribersRes.status === "fulfilled" ? (subscribersRes.value.data || []) : [];

  // Aggregate action counts from last storm-check cron runs
  let totalSmsBlasts = 0;
  let totalReengaged = 0;
  let adsCreated = 0;

  for (const run of cronRuns) {
    const meta = (run.metadata || {}) as Record<string, unknown>;
    totalSmsBlasts += Number(meta.sms_blasts_sent ?? 0);
    totalReengaged += Number(meta.leads_reengaged ?? 0);
    if (meta.ads_created) adsCreated++;
  }

  // Leads from storm sources in last 24h
  const stormLeads24h = leads24h.filter(l => l.source === "storm_alert" || l.source === "hail_map" || l.source === "storm_subscriber");

  // Most recent active hail storm
  const activeHailStorm = storms.find(s => s.has_hail) || null;

  return NextResponse.json({
    configured: true,
    last_checked: new Date().toISOString(),
    active_hail_storm: activeHailStorm
      ? {
          event: activeHailStorm.event,
          cities: (activeHailStorm.affected_cities || []).slice(0, 4),
          detected_at: activeHailStorm.detected_at,
        }
      : null,
    recent_storms_7d: storms.filter(s => s.has_hail).length,
    storm_leads_24h: stormLeads24h.length,
    total_leads_24h: leads24h.length,
    sms_blasts_sent: totalSmsBlasts,
    leads_reengaged: totalReengaged,
    ads_created: adsCreated,
    active_subscribers: subscribers.length,
    last_storm_check: cronRuns[0]?.started_at || null,
    last_storm_check_result: cronRuns[0]?.result || null,
  });
}
