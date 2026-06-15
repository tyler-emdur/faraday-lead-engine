// CRON: Weekly Report — Runs every Monday at 2pm
// Emails Tyler a comprehensive report of the week's activity.
//
// Requires: RESEND_API_KEY, TYLER_EMAIL or TEAM_EMAIL, SUPABASE_URL

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { cronRunner } from "@/lib/logger";

export const maxDuration = 60;

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;
  if (!to) return NextResponse.json({ success: false, message: "No recipient email configured" });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ success: false, message: "RESEND_API_KEY not set" });
  if (!process.env.SUPABASE_URL) return NextResponse.json({ success: false, message: "SUPABASE_URL not set" });

  const runner = cronRunner("weekly-report");
  const logId = await runner.start();

  const db = getSupabase();
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weekLabel = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Gather data ──────────────────────────────────────────────────────────────
  const [leadsRes, allLeadsRes, stormsRes, postsRes, prospectsRes, cronRes, intelRes] = await Promise.allSettled([
    db.from("leads").select("*").gte("created_at", weekAgo),
    db.from("leads").select("id, score, lead_score, grade, status, source, submitted_to_faraday, submitted_at"),
    db.from("storm_alerts").select("*").gte("detected_at", weekAgo),
    db.from("blog_posts").select("title, slug, target_keyword, published_at").gte("published_at", weekAgo),
    db.from("outbound_prospects").select("status, last_contacted_at").gte("updated_at", weekAgo),
    db.from("cron_logs").select("cron_name, result, leads_generated, started_at").gte("started_at", weekAgo).limit(200),
    db.from("opportunities").select("source, type, status, priority").eq("status", "new"),
  ]);

  const weekLeads = leadsRes.status === "fulfilled" ? (leadsRes.value.data || []) : [];
  const allLeads = allLeadsRes.status === "fulfilled" ? (allLeadsRes.value.data || []) : [];
  const storms = stormsRes.status === "fulfilled" ? (stormsRes.value.data || []) : [];
  const posts = postsRes.status === "fulfilled" ? (postsRes.value.data || []) : [];
  const prospects = prospectsRes.status === "fulfilled" ? (prospectsRes.value.data || []) : [];
  const cronLogs = cronRes.status === "fulfilled" ? (cronRes.value.data || []) : [];
  const intel = intelRes.status === "fulfilled" ? (intelRes.value.data || []) : [];

  // ── Calculations ──────────────────────────────────────────────────────────────
  const allSubmitted = allLeads.filter((l: { submitted_to_faraday?: boolean }) => l.submitted_to_faraday);
  const weekSubmitted = weekLeads.filter(l => l.submitted_to_faraday);
  const statusCounts: Record<string, number> = {};
  for (const l of allLeads) statusCounts[(l.status || "new")] = (statusCounts[l.status || "new"] || 0) + 1;

  const sourceCounts: Record<string, number> = {};
  for (const l of weekLeads) sourceCounts[l.source || "unknown"] = (sourceCounts[l.source || "unknown"] || 0) + 1;

  const topLeads = [...weekLeads]
    .sort((a, b) => (b.lead_score ?? b.score ?? 0) - (a.lead_score ?? a.score ?? 0))
    .slice(0, 5);

  const cronSuccess = cronLogs.filter((c: { result?: string }) => c.result === "success").length;
  const cronError = cronLogs.filter((c: { result?: string }) => c.result === "error").length;

  const intelByCategory: Record<string, number> = {};
  for (const i of intel) intelByCategory[(i.source || "other")] = (intelByCategory[i.source || "other"] || 0) + 1;

  const hailStorms = storms.filter((s: { has_hail?: boolean }) => s.has_hail);

  // ── Email HTML ────────────────────────────────────────────────────────────────
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
<div style="max-width:620px;margin:0 auto;">

  <!-- Header -->
  <div style="background:#1f2937;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #374151;">
    <h1 style="margin:0 0 4px;color:#f59e0b;font-size:22px;font-weight:900;">Anna Weekly Report</h1>
    <p style="margin:0;color:#6b7280;font-size:13px;">Week of ${weekLabel}</p>
  </div>

  <!-- 1. Revenue Summary -->
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">💰 Revenue</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:4px 0;">This week</td>
        <td style="color:#34d399;font-weight:700;text-align:right;">${weekSubmitted.length} submitted = $${weekSubmitted.length * 100}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:4px 0;">All time</td>
        <td style="color:#34d399;font-weight:700;text-align:right;">${allSubmitted.length} submitted = $${allSubmitted.length * 100}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;font-size:13px;padding:4px 0;">New leads this week</td>
        <td style="color:#fff;font-weight:700;text-align:right;">${weekLeads.length}</td>
      </tr>
    </table>
  </div>

  <!-- 2. Lead Pipeline -->
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">📊 Lead Pipeline (All Time)</h2>
    ${Object.entries(statusCounts).map(([s, c]) => `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#9ca3af;font-size:13px;text-transform:capitalize;">${s}</span>
        <span style="color:#fff;font-weight:600;font-size:13px;">${c}</span>
      </div>
    `).join("")}
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #374151;">
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#9ca3af;font-size:13px;">Conversion (submitted/total)</span>
        <span style="color:#f59e0b;font-weight:700;font-size:13px;">${allLeads.length > 0 ? Math.round(allSubmitted.length / allLeads.length * 100) : 0}%</span>
      </div>
    </div>
  </div>

  <!-- 3. Top Leads -->
  ${topLeads.length > 0 ? `
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">🔥 Top Leads This Week</h2>
    ${topLeads.map(l => `
      <div style="padding:10px 0;border-bottom:1px solid #374151;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#fff;font-size:13px;font-weight:600;">${l.name || "Unknown"}</span>
          <span style="background:#7f1d1d;color:#fca5a5;font-size:11px;padding:2px 8px;border-radius:8px;">Score ${l.lead_score ?? l.score ?? 0}</span>
        </div>
        <div style="color:#6b7280;font-size:12px;margin-top:2px;">${l.phone || "no phone"} · ${l.source || "unknown"}</div>
      </div>
    `).join("")}
  </div>
  ` : ""}

  <!-- 4. Channel Performance -->
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">📡 Channel Performance This Week</h2>
    ${Object.keys(sourceCounts).length === 0
      ? '<p style="color:#6b7280;font-size:13px;margin:0;">No new leads this week.</p>'
      : Object.entries(sourceCounts).sort((a,b)=>b[1]-a[1]).map(([src, cnt]) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#9ca3af;font-size:13px;">${src.replace(/_/g, " ")}</span>
          <span style="color:#fff;font-weight:600;font-size:13px;">${cnt}</span>
        </div>
      `).join("")}
  </div>

  <!-- 5. Storm Activity -->
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">⚡ Storm Activity</h2>
    ${hailStorms.length === 0
      ? '<p style="color:#6b7280;font-size:13px;margin:0;">No hail storms detected this week.</p>'
      : hailStorms.map((s: { detected_at: string; affected_cities?: string[]; event: string }) => `
        <div style="padding:8px 0;border-bottom:1px solid #374151;">
          <div style="color:#fca5a5;font-size:13px;font-weight:600;">${s.event}</div>
          <div style="color:#6b7280;font-size:12px;">${s.affected_cities?.join(", ") || "Unknown area"} · ${fmtDate(s.detected_at)}</div>
        </div>
      `).join("")}
  </div>

  <!-- 6. Blog -->
  ${posts.length > 0 ? `
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">📝 Blog Posts This Week</h2>
    ${posts.map((p: { title: string; slug: string; target_keyword?: string; published_at?: string }) => `
      <div style="padding:8px 0;border-bottom:1px solid #374151;">
        <div style="color:#60a5fa;font-size:13px;">${p.title}</div>
        <div style="color:#6b7280;font-size:12px;">Keyword: ${p.target_keyword || "n/a"}</div>
      </div>
    `).join("")}
  </div>
  ` : ""}

  <!-- 7. Outbound -->
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">📤 Outbound This Week</h2>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="color:#9ca3af;font-size:13px;">Prospects contacted</span>
      <span style="color:#fff;font-weight:600;">${prospects.filter((p: { status?: string; last_contacted_at?: string | null }) => p.status === "contacted" && p.last_contacted_at).length}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span style="color:#9ca3af;font-size:13px;">Replied</span>
      <span style="color:#34d399;font-weight:600;">${prospects.filter((p: { status?: string }) => p.status === "replied").length}</span>
    </div>
  </div>

  <!-- 8. Intel -->
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">🎯 Unactioned Intel (${fmt(intel.length)} items)</h2>
    ${Object.entries(intelByCategory).map(([src, cnt]) => `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#9ca3af;font-size:13px;">${src.replace(/_/g, " ")}</span>
        <span style="color:#f59e0b;font-weight:600;">${cnt}</span>
      </div>
    `).join("")}
    ${intel.length > 0 ? `<p style="color:#6b7280;font-size:12px;margin:8px 0 0;"><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com"}/intel" style="color:#f59e0b;">View all intel →</a></p>` : ""}
  </div>

  <!-- 9. Cron Health -->
  <div style="background:#1f2937;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #374151;">
    <h2 style="margin:0 0 12px;color:#fff;font-size:15px;">⚙️ System Health</h2>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="color:#9ca3af;font-size:13px;">Cron runs this week</span>
      <span style="color:#fff;font-weight:600;">${cronLogs.length}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="color:#9ca3af;font-size:13px;">Successful</span>
      <span style="color:#34d399;font-weight:600;">${cronSuccess}</span>
    </div>
    ${cronError > 0 ? `
    <div style="display:flex;justify-content:space-between;">
      <span style="color:#9ca3af;font-size:13px;">Errors</span>
      <span style="color:#f87171;font-weight:600;">${cronError}</span>
    </div>
    ` : ""}
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:16px;color:#4b5563;font-size:11px;">
    Anna Lead Engine · Faraday Construction · <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com"}/admin" style="color:#f59e0b;">View Dashboard</a>
  </div>

</div>
</body>
</html>`;

  const ok = await sendEmail(to, `Anna Weekly Report — Week of ${weekLabel}`, html);
  await runner.finish(logId, { actionsCount: ok ? 1 : 0, error: ok ? undefined : "Email send failed" });

  return NextResponse.json({ success: ok, recipient: to });
}
