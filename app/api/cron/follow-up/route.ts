// CRON: Follow-Up Sender — Runs every hour
// Checks for pending follow-ups that are due and sends them
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { sendEmail } from "@/lib/resend";
import {
  welcomeEmail,
  insuranceInfoEmail,
  lastChanceEmail,
  introText,
  checkInText,
} from "@/lib/templates";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();
  const results = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    // Get all pending follow-ups that are scheduled for now or earlier
    const { data: pendingFollowUps } = await db
      .from("follow_ups")
      .select("*, leads(*)")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50); // Process 50 at a time to stay within time limits

    if (!pendingFollowUps || pendingFollowUps.length === 0) {
      return NextResponse.json({ success: true, message: "No pending follow-ups", ...results });
    }

    for (const followUp of pendingFollowUps) {
      results.processed++;
      const lead = followUp.leads;

      // Skip if lead has been marked as won or lost (no need to keep following up)
      if (lead?.status === "won" || lead?.status === "lost") {
        await db
          .from("follow_ups")
          .update({ status: "skipped" })
          .eq("id", followUp.id);
        results.skipped++;
        continue;
      }

      const leadInfo = {
        name: lead?.name || "",
        phone: lead?.phone,
        email: lead?.email,
        service: lead?.service,
        city: lead?.city,
        urgency: lead?.urgency,
      };

      let success = false;

      try {
        if (followUp.type === "email" && lead?.email) {
          // Select template based on step
          let template;
          switch (followUp.step) {
            case 1:
              template = welcomeEmail(leadInfo);
              break;
            case 3:
              template = insuranceInfoEmail(leadInfo);
              break;
            case 5:
              template = lastChanceEmail(leadInfo);
              break;
            default:
              template = welcomeEmail(leadInfo);
          }

          success = await sendEmail(lead.email, template.subject, template.html);

          await db
            .from("follow_ups")
            .update({
              status: success ? "sent" : "failed",
              sent_at: success ? new Date().toISOString() : null,
              content: template.subject,
              error_message: success ? null : "Email send failed",
            })
            .eq("id", followUp.id);
        } else if (followUp.type === "sms" && lead?.phone) {
          // Select SMS template based on step
          let message;
          switch (followUp.step) {
            case 2:
              message = introText(leadInfo);
              break;
            case 4:
              message = checkInText(leadInfo);
              break;
            default:
              message = introText(leadInfo);
          }

          success = await sendSMS(lead.phone, message);

          await db
            .from("follow_ups")
            .update({
              status: success ? "sent" : "failed",
              sent_at: success ? new Date().toISOString() : null,
              content: message,
              error_message: success ? null : "SMS send failed",
            })
            .eq("id", followUp.id);
        } else {
          // No valid contact info for this channel — skip
          await db
            .from("follow_ups")
            .update({ status: "skipped", error_message: "No valid contact for channel" })
            .eq("id", followUp.id);
          results.skipped++;
          continue;
        }

        if (success) {
          results.sent++;

          // Log activity
          await db.from("activity_log").insert({
            type: followUp.type === "email" ? "email_sent" : "sms_sent",
            description: `Step ${followUp.step} ${followUp.type} sent to ${lead?.name || "lead"}`,
            metadata: {
              lead_id: lead?.id,
              follow_up_id: followUp.id,
              step: followUp.step,
            },
          });
        } else {
          results.failed++;
        }
      } catch (error) {
        console.error(`Follow-up ${followUp.id} failed:`, error);
        await db
          .from("follow_ups")
          .update({
            status: "failed",
            error_message: String(error),
          })
          .eq("id", followUp.id);
        results.failed++;
      }
    }

    console.log(
      `Follow-up cron: ${results.processed} processed, ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`
    );

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Follow-up cron error:", error);
    return NextResponse.json({ error: "Follow-up cron failed" }, { status: 500 });
  }
}
