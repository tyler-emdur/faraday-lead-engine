// CRON: Lead Intelligence Digest — runs daily at 7am MT (2pm UTC)
// Emails Tyler the top 20 opportunities found in the last 24 hours

import { NextRequest, NextResponse } from "next/server";
import { fetchOpportunities, fetchIntelStats, type Opportunity } from "@/lib/intel";

export const maxDuration = 45;

function priorityBadge(p: string) {
  if (p === "high") return "🔴 HIGH";
  if (p === "medium") return "🟡 MED";
  return "⚪ LOW";
}

function sourceBadge(s: string) {
  if (s === "storm") return "Storm";
  if (s === "community_import") return "Community";
  return "Property";
}

function buildDigestEmail(opportunities: Opportunity[], stats: Awaited<ReturnType<typeof fetchIntelStats>>): { subject: string; html: string } {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const high = opportunities.filter(o => o.priority === "high");
  const medium = opportunities.filter(o => o.priority === "medium");
  const low = opportunities.filter(o => o.priority === "low");

  function renderCard(o: Opportunity): string {
    const intelUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/intel`;
    return `
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:12px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
    <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">${sourceBadge(o.source)} · Score ${o.opportunity_score}/100</span>
    ${o.location ? `<span style="font-size:11px;color:#9ca3af;">${o.location}</span>` : ""}
  </div>
  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">${o.title}</p>
  ${o.why_it_matters ? `<p style="margin:0 0 8px;font-size:13px;color:#374151;">${o.why_it_matters}</p>` : ""}
  ${o.outreach_message ? `
  <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:10px 12px;border-radius:0 6px 6px 0;margin-bottom:8px;">
    <p style="margin:0;font-size:12px;font-weight:600;color:#166534;">Suggested outreach:</p>
    <p style="margin:4px 0 0;font-size:12px;color:#166534;">${o.outreach_message}</p>
  </div>` : ""}
  <div style="display:flex;gap:12px;align-items:center;">
    ${o.url ? `<a href="${o.url}" style="font-size:12px;color:#2563eb;">View source →</a>` : ""}
    ${o.close_probability ? `<span style="font-size:12px;color:#6b7280;">Close prob: ${o.close_probability}%</span>` : ""}
  </div>
</div>`;
  }

  function renderSection(label: string, color: string, items: Opportunity[]): string {
    if (!items.length) return "";
    return `
<div style="margin-bottom:28px;">
  <h2 style="font-size:15px;font-weight:800;color:${color};margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px;">${label} (${items.length})</h2>
  ${items.map(renderCard).join("")}
</div>`;
  }

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#1a1a1a;">

  <div style="background:#111827;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="color:#f9fafb;margin:0;font-size:18px;font-weight:900;">Lead Intelligence Digest</h1>
    <p style="color:#9ca3af;margin:4px 0 0;font-size:13px;">${today} · ${opportunities.length} opportunities</p>
  </div>

  <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none;display:flex;gap:24px;">
    <div style="text-align:center;">
      <p style="margin:0;font-size:22px;font-weight:900;color:#ef4444;">${stats.by_priority.high}</p>
      <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">HIGH</p>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;font-size:22px;font-weight:900;color:#f59e0b;">${stats.by_priority.medium}</p>
      <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">MEDIUM</p>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;font-size:22px;font-weight:900;color:#10b981;">${stats.estimated_revenue}</p>
      <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">$ EARNED</p>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;font-size:22px;font-weight:900;color:#6366f1;">${stats.booked_rate}%</p>
      <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">BOOK RATE</p>
    </div>
  </div>

  <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    ${renderSection("🔴 High Priority — Act Today", "#dc2626", high)}
    ${renderSection("🟡 Medium Priority", "#d97706", medium)}
    ${renderSection("Low Priority", "#6b7280", low.slice(0, 5))}

    <div style="margin-top:24px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/intel"
         style="background:#111827;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;">
        Open Intel Dashboard →
      </a>
    </div>
  </div>

</div>`;

  const subject = high.length > 0
    ? `🔴 ${high.length} high-priority leads today — Lead Intel ${today}`
    : opportunities.length > 0
    ? `📊 ${opportunities.length} opportunities today — Lead Intel ${today}`
    : `Lead Intel Digest — ${today} (quiet day)`;

  return { subject, html };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tylerEmail = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;
  if (!tylerEmail) {
    return NextResponse.json({ error: "TYLER_EMAIL not set" }, { status: 503 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [opportunities, stats] = await Promise.all([
    fetchOpportunities({ since, limit: 20 }),
    fetchIntelStats(),
  ]);

  if (opportunities.length === 0 && stats.total === 0) {
    console.log("Intel digest: no opportunities found, skipping email");
    return NextResponse.json({ sent: false, reason: "no opportunities" });
  }

  const { subject, html } = buildDigestEmail(opportunities, stats);

  try {
    const { sendEmail } = await import("@/lib/resend");
    await sendEmail(tylerEmail, subject, html);
    console.log(`Intel digest sent: ${opportunities.length} opportunities`);
    return NextResponse.json({ sent: true, opportunities: opportunities.length });
  } catch (e) {
    console.error("Intel digest email failed:", e);
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}
