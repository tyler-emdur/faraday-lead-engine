// CRON: Storm Monitor — runs every 30 minutes via vercel.json
// When hail hits the Front Range:
//   1. Text Tyler immediately (formatted for action)
//   2. Email Tyler full post templates + ad copy
//   3. Auto-post to Facebook Page (if FACEBOOK_PAGE_ACCESS_TOKEN set)
//   4. Re-engage past leads in the storm area via SMS (free money)
//
// Requires: TYLER_PHONE or TEAM_PHONE, CRON_SECRET
// Optional: RESEND_API_KEY, FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID, GOOGLE_SPREADSHEET_ID

import { NextRequest, NextResponse } from "next/server";
import { fetchColoradoAlerts, fetchColoradoWatches, type StormAlert } from "@/lib/nws";
import { notifyTyler } from "@/lib/notify";
import { sendSMS } from "@/lib/twilio";
import { postToFacebook } from "@/lib/social";
import { getLeadsForReengagement } from "@/lib/sheets";
import { scoreOpportunity, generateAIAnalysis, saveOpportunity, opportunityExists } from "@/lib/intel";

export const maxDuration = 60;

// ─── DEDUPLICATION ────────────────────────────────────────────────────────────
// Tracks which alert IDs Tyler has already been notified about.
// Uses Supabase if configured; falls back to onset-time window otherwise.

const CRON_INTERVAL_MINUTES = 30;
const WINDOW_MS = (CRON_INTERVAL_MINUTES + 5) * 60 * 1000; // 35 min window

async function isAlertNew(alert: StormAlert): Promise<boolean> {
  if (process.env.SUPABASE_URL) {
    try {
      const { getSupabase } = await import("@/lib/supabase");
      const { data } = await getSupabase()
        .from("storm_alerts")
        .select("id")
        .eq("nws_id", alert.nws_id)
        .maybeSingle();
      return !data; // New if not found in DB
    } catch {
      // Fall through to time-based check
    }
  }
  // Fallback: consider alert new if onset is within the last 35 minutes
  const onset = new Date(alert.onset || alert.expires).getTime();
  return Date.now() - onset < WINDOW_MS;
}

async function markAlertProcessed(alert: StormAlert): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    await getSupabase()
      .from("storm_alerts")
      .upsert({
        nws_id: alert.nws_id,
        event: alert.event,
        headline: alert.headline,
        severity: alert.severity,
        areas: alert.areas,
        affected_cities: alert.affected_cities,
        description: alert.description,
        onset: alert.onset,
        expires: alert.expires,
        has_hail: alert.has_hail,
        posted_to_facebook: false,
      });
  } catch (e) {
    console.error("Failed to mark alert processed:", e);
  }
}

// ─── CONTENT GENERATION ───────────────────────────────────────────────────────

function primaryCity(alert: StormAlert): string {
  return alert.affected_cities[0] || alert.areas.split(";")[0].split(",")[0].trim();
}

function hailNote(alert: StormAlert): string {
  const desc = alert.description.toLowerCase();
  const match = desc.match(/hail(?:\s+up\s+to)?\s+(\d+(?:\.\d+)?)\s*inch/i);
  if (match) return `${match[1]}-inch hail`;
  return alert.has_hail ? "hail confirmed" : "severe storm";
}

function tylerSms(alert: StormAlert): string {
  const city = primaryCity(alert);
  const hail = hailNote(alert);
  const cities = alert.affected_cities.slice(0, 3).join(", ");
  return [
    `⚡ STORM HIT — Post NOW`,
    `${hail.toUpperCase()} in ${cities}`,
    `→ Full templates: [your-domain]/storm`,
    `Post to Nextdoor + FB groups within 2 hrs`,
    `Then run Facebook ad — $200-500 budget`,
  ].join("\n");
}

function facebookPagePost(alert: StormAlert): string {
  const city = primaryCity(alert);
  const hail = hailNote(alert);
  const cities = alert.affected_cities.slice(0, 3).join(", ");
  const hashtags = alert.affected_cities
    .slice(0, 4)
    .map(c => `#${c.replace(/\s+/g, "")}CO`)
    .join(" ");

  return `⚡ ${hail.toUpperCase()} just hit ${cities}

If you're a homeowner in the affected area, your roof damage may be FULLY covered by insurance — most people only pay their deductible.

Faraday Construction is doing FREE inspections this week. We've helped 1,200+ Colorado families recover $9,000–$22,000 from insurance.

⏰ Don't wait — insurance claim windows close after storms.

👉 [YOUR LINK] | Call (720) 766-1518

Free inspection. No commitment. BBB A+ rated.

${hashtags} #HailDamage #FreeInspection #FaradayConstruction`;
}

function reengagementSms(lead: { name: string; cityZip: string }, city: string, hailNote: string): string {
  const firstName = lead.name.split(" ")[0] || "there";
  return `Hi ${firstName}! Hail just hit ${city} tonight — ${hailNote}. Your Faraday free inspection offer is still open. Reply YES to book this week, or call (720) 766-1518. -Faraday`;
}

function tylerAlertEmail(alert: StormAlert): { subject: string; html: string } {
  const city = primaryCity(alert);
  const hail = hailNote(alert);
  const cities = alert.affected_cities.join(", ") || alert.areas;

  const nextdoorPost = `Hi neighbors! Just a heads up after tonight's storm (${hail} reported in the area):

Many homeowners in ${city} have roof or gutter damage they haven't noticed yet. It often doesn't look bad from the ground but shows up in a professional inspection.

Faraday Construction is offering free inspections specifically for our area this week. They helped my neighbor get $14,000 covered last month — he only paid his deductible.

Don't wait too long — insurance companies get tougher the longer you wait after a storm.

Free inspection: [YOUR LINK]
Or call/text: (720) 766-1518`;

  const fbPost = `⚡ ${hail.toUpperCase()} HIT ${city.toUpperCase()} TONIGHT

Homeowners: your roof damage may be FULLY covered by insurance. Most people only pay their deductible.

FREE inspection this week → [YOUR LINK]

✓ BBB A+ Rated  ✓ $9K–$22K average claim  ✓ We handle all paperwork

(720) 766-1518 | Faraday Construction

#${city.replace(/\s+/g, "")}CO #HailDamage #FreeInspection`;

  const adCopy = `Target: ${city} area homeowners, 30–65 yrs, $60K+ HHI
Budget: $200–500, start within 2 hrs of storm
Objective: Traffic or Leads to [YOUR LINK]

Headline: "${city} Homeowners: ${hail.charAt(0).toUpperCase() + hail.slice(1)} May Cover Your Roof Replacement"
Body: "Average claim $9K–$22K. Free inspection. We handle insurance. Only pay your deductible."
CTA: "Get Free Inspection"`;

  return {
    subject: `⚡ STORM ALERT: ${hail} in ${cities} — Post templates inside`,
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;">

  <div style="background:#1a1a1a;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="color:#f59e0b;margin:0;font-size:20px;font-weight:900;">⚡ STORM ALERT — Act Now</h1>
    <p style="color:#9ca3af;margin:6px 0 0;font-size:13px;">${alert.event} • ${cities}</p>
  </div>

  <div style="background:#7f1d1d;padding:14px 24px;">
    <p style="color:#fca5a5;margin:0;font-size:14px;font-weight:700;">
      ${hail.toUpperCase()} detected. Post to Nextdoor + Facebook groups within 2 hours for best results.
      Then run a $200–500 Facebook ad targeting ${city} area homeowners.
    </p>
  </div>

  <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb;">

    <h2 style="font-size:15px;font-weight:700;color:#1f2937;margin:0 0 8px;">Nextdoor Post (paste this directly)</h2>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:14px;margin-bottom:20px;">
      <pre style="font-family:inherit;font-size:13px;color:#374151;white-space:pre-wrap;margin:0;line-height:1.6;">${nextdoorPost}</pre>
    </div>

    <h2 style="font-size:15px;font-weight:700;color:#1f2937;margin:0 0 8px;">Facebook / Instagram Post</h2>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:14px;margin-bottom:20px;">
      <pre style="font-family:inherit;font-size:13px;color:#374151;white-space:pre-wrap;margin:0;line-height:1.6;">${fbPost}</pre>
    </div>

    <h2 style="font-size:15px;font-weight:700;color:#1f2937;margin:0 0 8px;">Facebook Ad Setup</h2>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:14px;margin-bottom:20px;">
      <pre style="font-family:inherit;font-size:13px;color:#374151;white-space:pre-wrap;margin:0;line-height:1.6;">${adCopy}</pre>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">
        Speed matters: leads that come in within 6 hours of a storm have 2–3x higher close rates.<br>
        Post now → run the ad → check your Google Sheet for incoming leads.
      </p>
    </div>
  </div>

  <div style="padding:16px 24px;background:#f3f4f6;border-radius:0 0 12px 12px;">
    <p style="margin:0;font-size:12px;color:#6b7280;">
      Auto-detected by Faraday Lead Engine via National Weather Service.
      NWS Alert: ${alert.event} — ${alert.headline}
    </p>
  </div>
</div>`,
  };
}

// ─── MAIN CRON HANDLER ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    alerts_checked: 0,
    new_hail_alerts: 0,
    watch_alerts: 0,
    tyler_sms_sent: false,
    tyler_email_sent: false,
    facebook_posted: false,
    leads_reengaged: 0,
  };

  try {
    const [allAlerts, watchAlerts] = await Promise.all([
      fetchColoradoAlerts(),
      fetchColoradoWatches(),
    ]);
    results.alerts_checked = allAlerts.length;

    // ── Pre-storm watch alerts — Front Range watches (6–24 hrs ahead) ─────────
    const frontRangeWatches = watchAlerts.filter(a => a.affected_cities.length > 0);
    for (const watch of frontRangeWatches) {
      const isNew = await isAlertNew(watch);
      if (!isNew) continue;

      results.watch_alerts++;
      await markAlertProcessed(watch);

      const cities = watch.affected_cities.slice(0, 4).join(", ");
      const prepSms = [
        `⚡ STORM WATCH — ${watch.event}`,
        `Affecting: ${cities}`,
        `Storm possible in 2–12 hours. Prep now:`,
        `→ Join Facebook groups for ${watch.affected_cities[0]}`,
        `→ Draft your Nextdoor post`,
        `→ Be ready to run ad within 1 hr of storm`,
        `Check: /storm`,
      ].join("\n");

      await notifyTyler(prepSms, `⚡ Watch: ${watch.event} — ${cities}`)
        .catch(e => console.error("Watch notify failed:", e));

      // Create low-priority opportunity for each affected city
      if (process.env.SUPABASE_URL) {
        for (const city of watch.affected_cities.slice(0, 4)) {
          const sourceId = `watch_${watch.nws_id}_${city.replace(/\s+/g, "_")}`;
          if (await opportunityExists(sourceId)) continue;
          await saveOpportunity({
            source: "storm",
            source_id: sourceId,
            type: "storm_victim_area",
            priority: "medium",
            title: `Storm Watch — ${city} (${watch.event})`,
            body: watch.headline,
            location: city,
            urgency_score: 45,
            opportunity_score: 45,
            why_it_matters: `Storm watch issued for ${city}. Storm expected in 2–12 hours. Get positioned in community groups now.`,
            outreach_message: `Storm watch active for ${city}. Pre-stage your posts so you can publish the moment hail falls.`,
          });
        }
      }
    }

    // Only care about Front Range hail warnings
    const hailAlerts = allAlerts.filter(
      a => a.has_hail && a.affected_cities.length > 0 && !a.event.toLowerCase().includes("watch")
    );

    for (const alert of hailAlerts) {
      const isNew = await isAlertNew(alert);
      if (!isNew) continue;

      results.new_hail_alerts++;
      await markAlertProcessed(alert);

      const affectedCities = alert.affected_cities;

      // ── 1 + 2. Notify Tyler (SMS if Twilio set, email always via Resend) ───
      const { subject, html } = tylerAlertEmail(alert);
      await notifyTyler(tylerSms(alert), subject).catch(e =>
        console.error("Tyler storm notification failed:", e)
      );
      // Also send the full rich email with post templates directly
      const tylerEmail = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;
      if (tylerEmail) {
        const { sendEmail } = await import("@/lib/resend");
        await sendEmail(tylerEmail, subject, html).catch(() => {});
        results.tyler_email_sent = true;
      }
      results.tyler_sms_sent = !!process.env.TWILIO_ACCOUNT_SID;

      // ── 3. Auto-post to Facebook Page ──────────────────────────────────────
      // Uses FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID
      // Tyler should set these to HIS own page credentials, not Faraday's
      const fbPostId = await postToFacebook(facebookPagePost(alert));
      results.facebook_posted = !!fbPostId;
      if (fbPostId) {
        console.log(`Facebook auto-posted for ${primaryCity(alert)}: ${fbPostId}`);
      }

      // ── 4. Re-engage past leads in the storm area ──────────────────────────
      // Reads leads from Google Sheets, finds ones in the affected cities
      // who are 2–90 days old and haven't closed, then re-texts them
      try {
        const oldLeads = await getLeadsForReengagement(affectedCities);
        const city = primaryCity(alert);
        const hail = hailNote(alert);

        for (const lead of oldLeads) {
          const sms = reengagementSms(lead, city, hail);
          await sendSMS(lead.phone, sms).catch(e =>
            console.error(`Re-engagement SMS failed for ${lead.phone}:`, e)
          );
          results.leads_reengaged++;
        }

        if (oldLeads.length > 0) {
          console.log(`Re-engaged ${oldLeads.length} past leads in ${city} area`);
        }
      } catch (e) {
        console.error("Re-engagement step failed:", e);
      }

      // ── 5. Create intelligence opportunities per affected city ────────────
      if (process.env.SUPABASE_URL) {
        try {
          const { getSupabase } = await import("@/lib/supabase");

          // Get the storm_alerts row we just inserted to get its UUID
          const { data: stormRow } = await getSupabase()
            .from("storm_alerts")
            .select("id")
            .eq("nws_id", alert.nws_id)
            .maybeSingle();

          const hailMatch = alert.description.match(/hail(?:\s+up\s+to)?\s+(\d+(?:\.\d+)?)\s*inch/i);
          const hailSizeInches = hailMatch ? parseFloat(hailMatch[1]) : 0.75;

          for (const city of affectedCities.slice(0, 6)) {
            const oppSourceId = `storm_${alert.nws_id}_${city.replace(/\s+/g, "_")}`;
            if (await opportunityExists(oppSourceId)) continue;

            const { score, priority } = scoreOpportunity({
              source: "storm",
              hailSizeInches,
              ageHours: 0,
            });

            const title = `Hail hit ${city} — ${hailSizeInches >= 1 ? `${hailSizeInches}" hail` : hailNote(alert)}`;
            const body = `NWS alert: ${alert.headline}. Affected area: ${alert.areas.slice(0, 200)}`;

            const analysis = priority !== "low"
              ? await generateAIAnalysis({ title, body, source: "storm", location: city, score, intent: "storm" })
              : null;

            const opp = await saveOpportunity({
              source: "storm",
              source_id: oppSourceId,
              type: "storm_victim_area",
              priority,
              title,
              body,
              location: city,
              urgency_score: score,
              opportunity_score: score,
              why_it_matters: analysis?.why_it_matters,
              close_probability: analysis?.close_probability,
              outreach_message: analysis?.outreach_message,
              follow_up_schedule: analysis?.follow_up_schedule,
            });

            // Create storm_affected_area record
            if (stormRow?.id) {
              const severityScore = hailSizeInches >= 2 ? 90 : hailSizeInches >= 1.5 ? 75 : hailSizeInches >= 1 ? 60 : 40;
              await getSupabase().from("storm_affected_areas").insert({
                storm_alert_id: stormRow.id,
                city,
                hail_size_inches: hailSizeInches,
                severity_score: severityScore,
                impact_radius_miles: hailSizeInches >= 1.5 ? 8 : hailSizeInches >= 1 ? 5 : 3,
                estimated_homes: Math.round(severityScore * 50),
                opportunity_id: opp?.id ?? null,
              });
            }
          }

          await getSupabase().from("activity_log").insert({
            type: "storm_detected",
            description: `Hail in ${affectedCities.join(", ")} — Tyler notified, ${results.leads_reengaged} leads re-engaged`,
            metadata: {
              alert_id: alert.nws_id,
              cities: affectedCities,
              facebook_posted: results.facebook_posted,
              leads_reengaged: results.leads_reengaged,
            },
          });
        } catch (e) {
          console.error("Intel opportunity creation failed:", e);
        }
      }

      // Only process the first (most severe) new hail alert to avoid SMS spam
      // if multiple alerts fire simultaneously for adjacent areas
      break;
    }

    console.log("Storm check:", JSON.stringify(results));
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Storm check cron error:", error);
    return NextResponse.json({ error: "Storm check failed" }, { status: 500 });
  }
}
