// GET /api/anna/status — War room data feed for the Anna dashboard.
// Aggregates all 18 cron jobs, pipeline stage counts, storm status, intel, and leads
// into a single payload the /anna page polls every 30 seconds.

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Pipeline stage → which crons feed it
const PIPELINE_STAGES = [
  {
    id: "detect",
    label: "DETECT",
    description: "Finding signals",
    crons: [
      "storm-check", "permit-monitor", "competitor-reviews",
      "listing-monitor", "hoa-violations", "hail-damage-unclaimed",
      "fema-monitor", "bid-monitor",
    ],
  },
  {
    id: "reach",
    label: "REACH",
    description: "Making contact",
    crons: ["prospect-scraper", "outbound-prospect", "contact-form-targets", "blog-generate"],
  },
  {
    id: "nurture",
    label: "NURTURE",
    description: "Warming up",
    crons: ["follow-up", "intel-digest", "meta-ad-cleanup"],
  },
  {
    id: "win",
    label: "WIN",
    description: "Lead captured",
    crons: ["review-request", "weekly-report"],
  },
];

const CRON_JOBS = [
  // DETECT
  { name: "storm-check",           label: "Storm Monitor",          schedule: "Every 30 min",    stage: "detect" },
  { name: "permit-monitor",         label: "Permit Scanner",         schedule: "Daily 3pm",       stage: "detect" },
  { name: "competitor-reviews",     label: "Competitor Reviews",     schedule: "Monday 7am",      stage: "detect" },
  { name: "listing-monitor",        label: "Pending Sales",          schedule: "Daily 9am",       stage: "detect" },
  { name: "hoa-violations",         label: "HOA Violations",         schedule: "Wednesday 10am",  stage: "detect" },
  { name: "hail-damage-unclaimed",  label: "Unclaimed Damage",       schedule: "Monday 8am",      stage: "detect" },
  { name: "fema-monitor",           label: "FEMA Declarations",      schedule: "8am + 6pm daily", stage: "detect" },
  { name: "bid-monitor",            label: "Gov't Bid Scanner",      schedule: "Daily 7am",       stage: "detect" },
  // REACH
  { name: "prospect-scraper",       label: "Prospect Scraper",       schedule: "Monday 6am",      stage: "reach"  },
  { name: "outbound-prospect",      label: "Cold Email Engine",      schedule: "M/W/F 9am+2pm",  stage: "reach"  },
  { name: "contact-form-targets",   label: "Form Auto-Submitter",    schedule: "Monday 7am",      stage: "reach"  },
  { name: "blog-generate",          label: "SEO Blog Writer",        schedule: "Monday 9am",      stage: "reach"  },
  // NURTURE
  { name: "follow-up",              label: "Lead Follow-up Drip",    schedule: "Every hour",      stage: "nurture"},
  { name: "intel-digest",           label: "Intel Digest",           schedule: "Daily 2pm",       stage: "nurture"},
  { name: "meta-ad-cleanup",        label: "Facebook Ad Manager",    schedule: "Daily noon",      stage: "nurture"},
  // WIN
  { name: "review-request",         label: "Review Harvester",       schedule: "Daily 11am",      stage: "win"   },
  { name: "weekly-report",          label: "Weekly Report",          schedule: "Monday 2pm",      stage: "win"   },
];

export async function GET() {
  const db = getSupabase();
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);

  const [
    cronLogsRes, leadsRes, outboundRes, contactQueueRes,
    opportunitiesRes, blogRes, stormRes, metaAdsRes,
  ] = await Promise.allSettled([
    db.from("cron_logs")
      .select("cron_name, started_at, finished_at, result, leads_generated, actions_taken, duration_ms, error")
      .order("started_at", { ascending: false })
      .limit(60),

    db.from("leads")
      .select("id, created_at, source, city, score, status, phone, name")
      .gte("created_at", weekStart.toISOString())
      .order("created_at", { ascending: false }),

    db.from("outbound_prospects")
      .select("id, source, status, follow_up_count, last_contacted_at, company, city")
      .limit(2000),

    db.from("contact_form_queue")
      .select("id, business_name, website, source, city, drafted_message, status, queued_at, sent_at, submit_method")
      .order("queued_at", { ascending: false })
      .limit(50),

    db.from("opportunities")
      .select("id, source, type, title, priority, status, created_at, why_it_matters, urgency_score, outreach_message, location")
      .order("created_at", { ascending: false })
      .limit(30),

    db.from("blog_posts")
      .select("id, title, slug, published_at, created_at, target_keyword")
      .order("created_at", { ascending: false })
      .limit(8),

    db.from("storm_events")
      .select("id, affected_cities, hail_size_inches, detected_at, zip_codes")
      .order("detected_at", { ascending: false })
      .limit(1),

    db.from("storm_facebook_ads")
      .select("id, zip_code, city, status, daily_budget_cents, pause_at, created_at")
      .eq("status", "active")
      .limit(10),
  ]);

  const cronLogs = cronLogsRes.status === "fulfilled" ? (cronLogsRes.value.data ?? []) : [];
  const leads    = leadsRes.status    === "fulfilled" ? (leadsRes.value.data    ?? []) : [];
  const prospects = outboundRes.status === "fulfilled" ? (outboundRes.value.data ?? []) : [];
  const contactQueue = contactQueueRes.status === "fulfilled" ? (contactQueueRes.value.data ?? []) : [];
  const opportunities = opportunitiesRes.status === "fulfilled" ? (opportunitiesRes.value.data ?? []) : [];
  const blogPosts = blogRes.status === "fulfilled" ? (blogRes.value.data ?? []) : [];
  const stormEvents = stormRes.status === "fulfilled" ? (stormRes.value.data ?? []) : [];
  const metaAds = metaAdsRes.status === "fulfilled" ? (metaAdsRes.value.data ?? []) : [];

  // ── Cron status ──────────────────────────────────────────────────────────────
  const lastRunByJob: Record<string, typeof cronLogs[0]> = {};
  for (const log of cronLogs) {
    if (!lastRunByJob[log.cron_name]) lastRunByJob[log.cron_name] = log;
  }
  const cronStatus = CRON_JOBS.map(job => ({
    ...job,
    lastRun: lastRunByJob[job.name] || null,
  }));

  const recentCrons = cronLogs.filter(
    l => new Date(l.started_at) >= new Date(now.getTime() - 2 * 3600000)
  ).length;

  // ── Leads ─────────────────────────────────────────────────────────────────────
  const leadsToday = leads.filter(l => new Date(l.created_at) >= todayStart).length;
  const leadsWithPhone = leads.filter(l => l.phone).length;
  const leadsBySource = leads.reduce<Record<string, number>>((acc, l) => {
    const src = l.source || "unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  // ── Outbound ──────────────────────────────────────────────────────────────────
  const outboundByStatus = prospects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const outboundBySegment = prospects.reduce<Record<string, number>>((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {});

  // ── Storm ─────────────────────────────────────────────────────────────────────
  const lastStorm = stormEvents[0] || null;
  const stormHoursAgo = lastStorm
    ? Math.round((now.getTime() - new Date(lastStorm.detected_at).getTime()) / 3600000)
    : null;
  const stormActive = !!(lastStorm && stormHoursAgo !== null && stormHoursAgo < 72);

  // ── Pipeline stage counts ────────────────────────────────────────────────────
  const recentOpps = opportunities.filter(
    o => new Date(o.created_at) >= thirtyDaysAgo
  ).length;

  const pipeline = {
    detect: {
      count: recentOpps + opportunities.filter(o => o.priority === "high").length,
      label: "signals found",
      sublabel: `${opportunities.filter(o => o.priority === "high").length} high priority`,
    },
    reach: {
      count: prospects.length,
      label: "prospects loaded",
      sublabel: `${outboundByStatus["contacted"] || 0} in sequence · ${contactQueue.filter(q => q.status === "sent").length} forms sent`,
    },
    nurture: {
      count: (outboundByStatus["contacted"] || 0) + leads.filter(l => !l.phone).length,
      label: "in follow-up",
      sublabel: `${leads.filter(l => !l.phone && new Date(l.created_at) >= todayStart).length} new today`,
    },
    win: {
      count: leadsWithPhone,
      label: "warm leads",
      sublabel: `${leadsToday} today · phone captured`,
    },
  };

  // ── Contact forms ─────────────────────────────────────────────────────────────
  const autoSent = contactQueue.filter(q => q.status === "sent" && q.submit_method).length;
  const pendingManual = contactQueue.filter(q => q.status === "pending_send").length;

  return NextResponse.json({
    timestamp: now.toISOString(),
    activity_level: recentCrons >= 6 ? "high" : recentCrons >= 2 ? "medium" : "low",
    recent_cron_count: recentCrons,

    cron_status: cronStatus,
    recent_activity: cronLogs.slice(0, 25),

    pipeline,

    leads: {
      today: leadsToday,
      this_week: leads.length,
      with_phone: leadsWithPhone,
      by_source: leadsBySource,
      recent: leads.slice(0, 8).map(l => ({
        name: l.name,
        city: l.city,
        source: l.source,
        created_at: l.created_at,
        has_phone: !!l.phone,
        score: l.score,
      })),
    },

    outbound: {
      total_prospects: prospects.length,
      by_status: outboundByStatus,
      by_segment: outboundBySegment,
      new: outboundByStatus["new"] || 0,
      in_sequence: outboundByStatus["contacted"] || 0,
      replied: outboundByStatus["replied"] || 0,
    },

    contact_forms: {
      pending: pendingManual,
      auto_sent: autoSent,
      total: contactQueue.length,
      queue: contactQueue.filter(q => q.status === "pending_send").slice(0, 8),
    },

    opportunities: {
      total: opportunities.length,
      high_priority: opportunities.filter(o => o.priority === "high").length,
      recent: opportunities.filter(o => o.status === "new").slice(0, 10),
    },

    blog: {
      posts_total: blogPosts.length,
      recent: blogPosts,
    },

    storm: {
      last_detected: lastStorm ? {
        cities: lastStorm.affected_cities || [],
        hail_size_inches: lastStorm.hail_size_inches,
        detected_at: lastStorm.detected_at,
      } : null,
      hours_ago: stormHoursAgo,
      active: stormActive,
    },

    meta_ads: {
      active_campaigns: metaAds.length,
      total_daily_budget_cents: metaAds.reduce((s: number, a: { daily_budget_cents?: number }) => s + (a.daily_budget_cents || 0), 0),
      campaigns: metaAds.slice(0, 5),
    },
  });
}
