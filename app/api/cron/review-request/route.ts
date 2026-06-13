// CRON: Review Requester + Referral Trigger — Runs daily at 10am
// 3 days after job completion: review request SMS
// 10 days after job completion: referral ask SMS
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { reviewRequestText } from "@/lib/templates";

export const maxDuration = 30;

function referralText(name: string, service: string): string {
  const firstName = (name || "there").split(" ")[0];
  const serviceNote = service ? ` on your ${service.replace("_", " ")}` : "";
  return `Hey ${firstName}! Hope everything looks great${serviceNote}. Quick question — do you know any neighbors whose roof might also have storm damage? If so, I'd love to help them get a free inspection. Just pass along (720) 766-1518. Thanks! – Faraday Construction`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();
  const results = { reviews_sent: 0, referrals_sent: 0, failed: 0 };

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // ── 1. Review requests: completed 3+ days ago, not yet requested ──────────
    const { data: reviewJobs } = await db
      .from("jobs")
      .select("*")
      .eq("status", "complete")
      .eq("review_requested", false)
      .lte("completed_at", threeDaysAgo)
      .limit(20);

    for (const job of reviewJobs || []) {
      if (!job.customer_phone) continue;

      const success = await sendSMS(job.customer_phone, reviewRequestText(job.customer_name || "there"));
      if (success) {
        await db.from("jobs").update({
          review_requested: true,
          review_requested_at: new Date().toISOString(),
        }).eq("id", job.id);
        await db.from("activity_log").insert({
          type: "review_requested",
          description: `Review request sent to ${job.customer_name}`,
          metadata: { job_id: job.id },
        });
        results.reviews_sent++;
      } else {
        results.failed++;
      }
    }

    // ── 2. Referral asks: review sent 10+ days ago, no referral yet ───────────
    // Uses review_requested_at to calculate the delay since the review ask
    const { data: referralJobs } = await db
      .from("jobs")
      .select("*")
      .eq("status", "complete")
      .eq("review_requested", true)
      .eq("referral_requested", false)
      .lte("review_requested_at", tenDaysAgo)
      .gte("completed_at", thirtyDaysAgo) // only recent enough to still be relevant
      .limit(20);

    for (const job of referralJobs || []) {
      if (!job.customer_phone) continue;

      const message = referralText(job.customer_name || "", job.service_type || "");
      const success = await sendSMS(job.customer_phone, message);
      if (success) {
        await db.from("jobs").update({
          referral_requested: true,
          referral_requested_at: new Date().toISOString(),
        }).eq("id", job.id);
        await db.from("activity_log").insert({
          type: "referral_requested",
          description: `Referral ask sent to ${job.customer_name}`,
          metadata: { job_id: job.id },
        });
        results.referrals_sent++;
      } else {
        results.failed++;
      }
    }

    console.log(`Review/referral cron: ${results.reviews_sent} reviews, ${results.referrals_sent} referrals`);
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Review/referral cron error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
