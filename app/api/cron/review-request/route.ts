// CRON: Review Requester — Runs daily at 10am
// Auto-texts customers 3 days after job completion asking for Google review
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { reviewRequestText } from "@/lib/templates";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();
  const results = { checked: 0, sent: 0, failed: 0 };

  try {
    // Find completed jobs from 3+ days ago that haven't had a review request
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: eligibleJobs } = await db
      .from("jobs")
      .select("*")
      .eq("status", "complete")
      .eq("review_requested", false)
      .lte("completed_at", threeDaysAgo.toISOString())
      .limit(20);

    if (!eligibleJobs || eligibleJobs.length === 0) {
      return NextResponse.json({ success: true, message: "No review requests needed", ...results });
    }

    for (const job of eligibleJobs) {
      results.checked++;

      if (!job.customer_phone) {
        console.log(`Job ${job.id}: no phone number, skipping`);
        continue;
      }

      const message = reviewRequestText(job.customer_name || "there");
      const success = await sendSMS(job.customer_phone, message);

      if (success) {
        await db
          .from("jobs")
          .update({
            review_requested: true,
            review_requested_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        await db.from("activity_log").insert({
          type: "review_requested",
          description: `Review request sent to ${job.customer_name}`,
          metadata: { job_id: job.id },
        });

        results.sent++;
      } else {
        results.failed++;
      }
    }

    console.log(`Review request cron: ${results.sent} sent, ${results.failed} failed`);
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Review request cron error:", error);
    return NextResponse.json({ error: "Review request cron failed" }, { status: 500 });
  }
}
