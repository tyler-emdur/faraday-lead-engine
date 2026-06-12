// CRON: Weekly Report — Runs every Monday at 8am MT
// Emails the owner a summary: leads, pipeline value, follow-ups, storms, posts
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { emailTeam } from "@/lib/resend";
import { weeklyReportEmail } from "@/lib/templates";
import { estimatePipelineValue } from "@/lib/scoring";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Leads this week
    const { data: leads } = await db
      .from("leads")
      .select("grade, service, score, status")
      .gte("created_at", weekAgo);

    const leadsArr = leads || [];
    const hotLeads = leadsArr.filter((l) => l.grade === "A").length;
    const warmLeads = leadsArr.filter((l) => l.grade === "B").length;
    const coolLeads = leadsArr.filter((l) => l.grade === "C" || l.grade === "D").length;

    // Pipeline value for open leads
    const openLeads = leadsArr.filter((l) => l.status !== "won" && l.status !== "lost");
    const estimatedPipeline = openLeads.reduce((sum, l) => {
      return sum + estimatePipelineValue(l.grade || "D", l.service);
    }, 0);

    // By service
    const byService: Record<string, number> = {};
    for (const lead of leadsArr) {
      const svc = lead.service || "unknown";
      byService[svc] = (byService[svc] || 0) + 1;
    }

    // Follow-ups sent this week
    const { count: followUpsSent } = await db
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", weekAgo);

    // Storms detected this week
    const { count: stormsDetected } = await db
      .from("storm_alerts")
      .select("id", { count: "exact", head: true })
      .gte("detected_at", weekAgo);

    // Blog posts published this week
    const { count: blogPostsPublished } = await db
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("published", true)
      .gte("published_at", weekAgo);

    const stats = {
      totalLeads: leadsArr.length,
      hotLeads,
      warmLeads,
      coolLeads,
      byService,
      followUpsSent: followUpsSent || 0,
      stormsDetected: stormsDetected || 0,
      blogPostsPublished: blogPostsPublished || 0,
      estimatedPipeline,
    };

    const { subject, html } = weeklyReportEmail(stats);
    await emailTeam(subject, html);

    // Log in activity
    await db.from("activity_log").insert({
      type: "email_sent",
      description: `Weekly report sent: ${leadsArr.length} leads, $${estimatedPipeline.toLocaleString()} pipeline`,
      metadata: stats,
    });

    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    console.error("Weekly report error:", error);
    return NextResponse.json({ error: "Weekly report failed" }, { status: 500 });
  }
}
