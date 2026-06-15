// GET /api/anna/status — War room data feed for the Anna dashboard.
// Aggregates cron activity, outbound pipeline, storm status, intel, and lead counts
// into a single payload that the /anna page polls every 30 seconds.

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getSupabase();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const [
    cronLogsRes,
    leadsRes,
    outboundRes,
    contactQueueRes,
    opportunitiesRes,
    blogRes,
    stormRes,
  ] = await Promise.allSettled([
    db.from("cron_logs")
      .select("cron_name, started_at, finished_at, result, leads_generated, actions_taken, duration_ms, error")
      .order("started_at", { ascending: false })
      .limit(40),

    db.from("leads")
      .select("id, created_at, source, city, score, status")
      .gte("created_at", weekStart.toISOString())
      .order("created_at", { ascending: false }),

    db.from("outbound_prospects")
      .select("id, source, status, follow_up_count, last_contacted_at, company, city"),

    db.from("contact_form_queue")
      .select("id, business_name, website, source, city, drafted_message, status, queued_at")
      .order("queued_at", { ascending: false })
      .limit(30),

    db.from("opportunities")
      .select("id, source, type, title, priority, status, created_at, why_it_matters, urgency_score")
      .order("created_at", { ascending: false })
      .limit(20),

    db.from("blog_posts")
      .select("id, title, slug, published_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5),

    db.from("storm_alerts")
      .select("id, city, state, hail_size_inches, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // Cron logs: last run per job + recent history
  const cronLogs = cronLogsRes.status === "fulfilled" ? (cronLogsRes.value.data ?? []) : [];
  const lastRunByJob: Record<string, (typeof cronLogs)[0]> = {};
  for (const log of cronLogs) {
    if (!lastRunByJob[log.cron_name]) lastRunByJob[log.cron_name] = log;
  }

  const CRON_JOBS = [
    { name: "storm-check",          label: "Storm Monitor",          schedule: "Every 30 min" },
    { name: "reddit-monitor",        label: "Reddit Monitor",         schedule: "Every 15 min" },
    { name: "follow-up",             label: "Lead Follow-up",         schedule: "Every hour" },
    { name: "outbound-prospect",     label: "Outbound Email",         schedule: "Mon/Wed/Fri 9am" },
    { name: "contact-form-targets",  label: "Contact Form Drafts",    schedule: "Monday 7am" },
    { name: "fema-monitor",          label: "FEMA Declarations",      schedule: "8am + 6pm daily" },
    { name: "permit-monitor",        label: "Permit Records",         schedule: "Daily 3pm" },
    { name: "bid-monitor",           label: "Gov Bid Scanner",        schedule: "Daily 7am" },
    { name: "competitor-reviews",    label: "Competitor Reviews",     schedule: "Monday 7am" },
    { name: "listing-monitor",       label: "Listing Monitor",        schedule: "Daily 9am" },
    { name: "blog-generate",         label: "SEO Blog Writer",        schedule: "Monday 9am" },
    { name: "prospect-scraper",      label: "Prospect Scraper",       schedule: "Monday 6am" },
    { name: "weekly-report",         label: "Weekly Report",          schedule: "Monday 2pm" },
    { name: "intel-digest",          label: "Intel Digest",           schedule: "Daily 2pm" },
  ];

  const cronStatus = CRON_JOBS.map(job => ({
    ...job,
    lastRun: lastRunByJob[job.name] || null,
  }));

  // Leads
  const leads = leadsRes.status === "fulfilled" ? (leadsRes.value.data ?? []) : [];
  const leadsToday = leads.filter(l => new Date(l.created_at) >= todayStart).length;
  const leadsThisWeek = leads.length;
  const leadsBySource = leads.reduce<Record<string, number>>((acc, l) => {
    const src = l.source || "unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  // Outbound pipeline
  const prospects = outboundRes.status === "fulfilled" ? (outboundRes.value.data ?? []) : [];
  const outboundByStatus = prospects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const outboundByTouch = prospects
    .filter(p => p.status === "contacted")
    .reduce<Record<string, number>>((acc, p) => {
      const t = `touch_${p.follow_up_count}`;
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
  const outboundBySegment = prospects.reduce<Record<string, number>>((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {});

  // Contact form queue
  const contactQueue = contactQueueRes.status === "fulfilled" ? (contactQueueRes.value.data ?? []) : [];
  const pendingContactForms = contactQueue.filter(q => q.status === "pending_send").length;

  // Intel opportunities
  const opportunities = opportunitiesRes.status === "fulfilled" ? (opportunitiesRes.value.data ?? []) : [];

  // Blog
  const blogPosts = blogRes.status === "fulfilled" ? (blogRes.value.data ?? []) : [];

  // Storms
  const storms = stormRes.status === "fulfilled" ? (stormRes.value.data ?? []) : [];
  const lastStorm = storms[0] || null;
  const hoursAgo = lastStorm
    ? Math.round((now.getTime() - new Date(lastStorm.created_at).getTime()) / 3600000)
    : null;

  // Overall Anna activity score (how busy is she right now)
  const recentCrons = cronLogs.filter(
    l => new Date(l.started_at) >= new Date(now.getTime() - 2 * 3600000)
  ).length;

  return NextResponse.json({
    timestamp: now.toISOString(),
    activity_level: recentCrons >= 6 ? "high" : recentCrons >= 2 ? "medium" : "low",
    recent_cron_count: recentCrons,

    cron_status: cronStatus,
    recent_activity: cronLogs.slice(0, 20),

    leads: {
      today: leadsToday,
      this_week: leadsThisWeek,
      by_source: leadsBySource,
      recent: leads.slice(0, 5),
    },

    outbound: {
      total_prospects: prospects.length,
      by_status: outboundByStatus,
      by_touch: outboundByTouch,
      by_segment: outboundBySegment,
      new: outboundByStatus["new"] || 0,
      in_sequence: outboundByStatus["contacted"] || 0,
      replied: outboundByStatus["replied"] || 0,
    },

    contact_forms: {
      pending: pendingContactForms,
      total: contactQueue.length,
      queue: contactQueue.filter(q => q.status === "pending_send").slice(0, 10),
    },

    opportunities: {
      total: opportunities.length,
      high_priority: opportunities.filter(o => o.priority === "high").length,
      recent: opportunities.slice(0, 8),
    },

    blog: {
      posts_total: blogPosts.length,
      recent: blogPosts,
    },

    storm: {
      last_detected: lastStorm,
      hours_ago: hoursAgo,
      active: lastStorm && hoursAgo !== null && hoursAgo < 72,
    },
  });
}
