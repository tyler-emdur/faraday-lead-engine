// CRON: Storm Monitor — runs every 30 min via GitHub Actions (storm-check.yml)
// Vercel daily cron at 8am is a fallback.
//
// When hail hits the Front Range:
//   1. Text Tyler immediately with post templates + lead page link
//   2. Email Tyler full Nextdoor/Facebook post copy ready to paste
//   3. PARTNER STORM ALERTS (Phase 2) — match affected ZIPs → partners assigned
//      to those ZIPs → text/email each their OWN referral link + forwardable
//      homeowner copy so they activate their own client base automatically.
//   4. Log storm opportunity intel
//
// NOTE: The old cold-email B2B blast (Resend → outbound_prospects by city) was
// removed — it violated Resend's AUP (cold outreach) and the partner network
// replaces it with warm, opted-in, attributed referrals.
//
// Requires: CRON_SECRET
// Optional: TYLER_PHONE/TEAM_PHONE, TYLER_EMAIL/TEAM_EMAIL, RESEND_API_KEY,
//           TWILIO_* (partner SMS), SUPABASE_URL

import { NextRequest, NextResponse } from "next/server";
import { fetchColoradoAlerts, fetchColoradoWatches, type StormAlert } from "@/lib/nws";
import { notifyTyler } from "@/lib/notify";
import { cronRunner } from "@/lib/logger";
import { scoreOpportunity, generateAIAnalysis, saveOpportunity, opportunityExists } from "@/lib/intel";

export const maxDuration = 60;

const CRON_INTERVAL_MINUTES = 30;
const WINDOW_MS = (CRON_INTERVAL_MINUTES + 5) * 60 * 1000;
// Don't re-alert the same partner more than once per storm window.
const PARTNER_ALERT_COOLOFF_MS = 12 * 60 * 60 * 1000;

async function isAlertNew(alert: StormAlert): Promise<boolean> {
  if (process.env.SUPABASE_URL) {
    try {
      const { getSupabase } = await import("@/lib/supabase");
      const { data } = await getSupabase()
        .from("storm_alerts")
        .select("id")
        .eq("nws_id", alert.nws_id)
        .maybeSingle();
      return !data;
    } catch {
      // fall through
    }
  }
  const onset = new Date(alert.onset || alert.expires).getTime();
  return Date.now() - onset < WINDOW_MS;
}

async function markAlertProcessed(alert: StormAlert, actionResults?: Record<string, unknown>): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();
    await db.from("storm_alerts").upsert({
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
    await db.from("storm_events").upsert({
      nws_alert_id: alert.nws_id,
      zip_codes: alert.affected_zips || [],
      affected_cities: alert.affected_cities,
      hail_size: alert.hail_size_text || (alert.has_hail ? "hail" : null),
      hail_size_inches: alert.hail_size_inches || null,
      detected_at: new Date().toISOString(),
      actions_triggered: actionResults || null,
    }, { onConflict: "nws_alert_id" });
  } catch (e) {
    console.error("Failed to mark alert processed:", e);
  }
}

function primaryCity(alert: StormAlert): string {
  return alert.affected_cities[0] || alert.areas.split(";")[0].split(",")[0].trim();
}

function hailNote(alert: StormAlert): string {
  if (alert.hail_size_text) return alert.hail_size_text;
  if (alert.hail_size_inches > 0) return `${alert.hail_size_inches}-inch hail`;
  return alert.has_hail ? "hail" : "severe storm";
}

function tylerSms(alert: StormAlert): string {
  const cities = alert.affected_cities.slice(0, 3).join(", ");
  const hail = hailNote(alert);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";
  return [
    `⚡ STORM HIT — Post NOW`,
    `${hail.toUpperCase()} in ${cities}`,
    `→ Templates: ${siteUrl}/storm`,
    `Post to Nextdoor + FB groups within 2 hrs`,
  ].join("\n");
}

function tylerAlertEmail(alert: StormAlert): { subject: string; html: string } {
  const city = primaryCity(alert);
  const hail = hailNote(alert);
  const cities = alert.affected_cities.join(", ") || alert.areas;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";
  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";

  const nextdoorPost = `Hi neighbors! Just a heads up after tonight's storm (${hail} reported in the area):

Many homeowners in ${city} have roof or gutter damage they haven't noticed yet. It often doesn't look bad from the ground but shows up in a professional inspection.

Faraday Construction is offering free inspections specifically for our area this week. They helped my neighbor get $14,000 covered last month — he only paid his deductible.

Don't wait too long — insurance companies get tougher the longer you wait after a storm.

Free inspection: ${siteUrl}
Or call/text: ${phone}`;

  const fbPost = `⚡ ${hail.toUpperCase()} HIT ${city.toUpperCase()} TONIGHT

Homeowners: your roof damage may be FULLY covered by insurance. Most people only pay their deductible.

FREE inspection this week → ${siteUrl}

✓ BBB A+ Rated  ✓ $9K–$22K average claim  ✓ We handle all paperwork

${phone} | Faraday Construction`;

  return {
    subject: `⚡ STORM ALERT: ${hail} in ${cities} — Post templates inside`,
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;">

  <div style="background:#1a1a1a;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="color:#f59e0b;margin:0;font-size:20px;font-weight:900;">⚡ STORM ALERT — Post Now</h1>
    <p style="color:#9ca3af;margin:6px 0 0;font-size:13px;">${alert.event} • ${cities}</p>
  </div>

  <div style="background:#7f1d1d;padding:14px 24px;">
    <p style="color:#fca5a5;margin:0;font-size:14px;font-weight:700;">
      ${hail.toUpperCase()} detected. Post to Nextdoor + Facebook groups within 2 hours.
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

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">
        Speed matters: leads within 6 hours of a storm convert at 2–3x the normal rate.
      </p>
    </div>
  </div>

  <div style="padding:16px 24px;background:#f3f4f6;border-radius:0 0 12px 12px;">
    <p style="margin:0;font-size:12px;color:#6b7280;">
      Auto-detected via National Weather Service. Alert: ${alert.event} — ${alert.headline}
    </p>
  </div>
</div>`,
  };
}

// ── Phase 2: Partner storm alerts ───────────────────────────────────────────
// The forwardable, homeowner-facing message a partner copy/pastes to their
// clients. The partner's referral link is embedded so every resulting lead is
// attributed back to them automatically.
function homeownerForwardCopy(city: string, hail: string, link: string): string {
  return `Hi — after the ${hail} that just hit ${city}, a lot of roofs have damage that's invisible from the ground. I work with Faraday Construction; they're doing free roof inspections this week, and if there's storm damage, insurance usually covers the full replacement minus your deductible. Takes 60 seconds to request one here: ${link}`;
}

function partnerStormSms(name: string, city: string, hail: string, link: string, fee: number): string {
  const earn = fee > 0 ? ` You earn $${fee} per accepted referral.` : "";
  return [
    `⚡ ${hail} just hit ${city}.`,
    `Your clients there likely have roof damage insurance will cover.`,
    `Forward your referral link: ${link}${earn}`,
    `— Faraday`,
  ].join(" ");
}

function partnerStormEmail(name: string, city: string, hail: string, link: string, fee: number): { subject: string; html: string } {
  const forward = homeownerForwardCopy(city, hail, link);
  const earn = fee > 0
    ? `<p style="margin:0 0 14px;font-size:14px;color:#166534;font-weight:600;">You earn $${fee} for every referral that turns into an accepted inspection — no paperwork on your end.</p>`
    : "";
  return {
    subject: `⚡ ${hail} hit ${city} — your clients can get a free roof inspection`,
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#1a1a1a;padding:18px 22px;border-radius:12px 12px 0 0;">
    <h1 style="color:#f59e0b;margin:0;font-size:18px;font-weight:900;">⚡ Storm just hit your area</h1>
    <p style="color:#9ca3af;margin:6px 0 0;font-size:13px;">${hail} reported in ${city}</p>
  </div>
  <div style="padding:22px;background:#f9fafb;border:1px solid #e5e7eb;">
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">Hi ${name},</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">${hail} just came through ${city}. Your clients there probably have roof damage they haven't noticed — and right now is the moment they'll act on it.</p>
    ${earn}
    <p style="margin:0 0 6px;font-size:14px;font-weight:700;">Your referral link:</p>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:12px;margin-bottom:18px;">
      <a href="${link}" style="color:#b45309;font-size:14px;word-break:break-all;">${link}</a>
    </div>
    <p style="margin:0 0 6px;font-size:14px;font-weight:700;">Copy &amp; forward this to your clients:</p>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:14px;">
      <pre style="font-family:inherit;font-size:13px;color:#374151;white-space:pre-wrap;margin:0;line-height:1.6;">${forward}</pre>
    </div>
  </div>
  <div style="padding:14px 22px;background:#f3f4f6;border-radius:0 0 12px 12px;">
    <p style="margin:0;font-size:12px;color:#6b7280;">You're getting this because ${city} is in your service area. Faraday Construction partner network.</p>
  </div>
</div>`,
  };
}

// Match the storm's affected ZIPs to partners assigned to those ZIPs, then send
// each engaged partner their referral link + forwardable copy. Returns count alerted.
async function alertMatchedPartners(alert: StormAlert): Promise<number> {
  if (!process.env.SUPABASE_URL) return 0;
  const zips = (alert.affected_zips || []).filter(Boolean);
  if (zips.length === 0) return 0; // can't target partners without ZIPs

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";
    const city = primaryCity(alert);
    const hail = hailNote(alert);

    // Only partners who've actually opted in (won't cold-blast 'identified' leads).
    const { data: partners } = await db
      .from("partners")
      .select("id, slug, name, contact_phone, contact_email, zip_codes, referral_fee, last_alerted_at, status")
      .in("status", ["interested", "active", "producing"])
      .overlaps("zip_codes", zips);

    if (!partners?.length) return 0;

    const cooloff = Date.now() - PARTNER_ALERT_COOLOFF_MS;
    let alerted = 0;

    for (const p of partners) {
      if (p.last_alerted_at && new Date(p.last_alerted_at).getTime() > cooloff) continue;
      if (!p.contact_phone && !p.contact_email) continue;

      const link = `${siteUrl}/api/track/${p.slug}`;
      const name = p.name || "there";
      const fee = p.referral_fee || 0;
      let delivered = false;

      if (p.contact_phone && process.env.TWILIO_ACCOUNT_SID) {
        const { sendSMS } = await import("@/lib/twilio");
        delivered = await sendSMS(p.contact_phone, partnerStormSms(name, city, hail, link, fee)) || delivered;
      }
      if (p.contact_email && process.env.RESEND_API_KEY) {
        const { sendEmail } = await import("@/lib/resend");
        const { subject, html } = partnerStormEmail(name, city, hail, link, fee);
        delivered = await sendEmail(p.contact_email, subject, html) || delivered;
      }

      if (delivered) {
        await db.from("partners").update({ last_alerted_at: new Date().toISOString() }).eq("id", p.id);
        alerted++;
      }
      await new Promise(r => setTimeout(r, 150));
    }
    return alerted;
  } catch (e) {
    console.error("Partner storm alert failed:", e);
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runner = cronRunner("storm-check");
  const logId = await runner.start();

  const results = {
    alerts_checked: 0,
    new_hail_alerts: 0,
    watch_alerts: 0,
    tyler_notified: false,
    partners_alerted: 0,
  };

  try {
    const [allAlerts, watchAlerts] = await Promise.all([
      fetchColoradoAlerts(),
      fetchColoradoWatches(),
    ]);
    results.alerts_checked = allAlerts.length;

    // Pre-storm watch alerts — notify Tyler to prep posts
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
        `→ Be ready to post within 1 hr of storm`,
      ].join("\n");

      await notifyTyler(prepSms, `⚡ Watch: ${watch.event} — ${cities}`)
        .catch(e => console.error("Watch notify failed:", e));

      if (process.env.SUPABASE_URL) {
        await Promise.allSettled(
          watch.affected_cities.slice(0, 4).map(async (city) => {
            const sourceId = `watch_${watch.nws_id}_${city.replace(/\s+/g, "_")}`;
            if (await opportunityExists(sourceId)) return;
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
              why_it_matters: `Storm watch issued for ${city}. Get positioned in community groups now.`,
              outreach_message: `Storm watch active for ${city}. Pre-stage posts to publish the moment hail falls.`,
            });
          })
        );
      }
    }

    // Active hail warnings — act now
    const hailAlerts = allAlerts.filter(
      a => a.has_hail && a.affected_cities.length > 0 && !a.event.toLowerCase().includes("watch")
    );

    for (const alert of hailAlerts) {
      const isNew = await isAlertNew(alert);
      if (!isNew) continue;

      results.new_hail_alerts++;
      const affectedCities = alert.affected_cities;
      const hailSizeInches = alert.hail_size_inches || 0.75;

      const [notifyResult, emailResult, partnerResult, intelResult] = await Promise.allSettled([

        // 1. Text Tyler with post templates
        notifyTyler(tylerSms(alert), tylerAlertEmail(alert).subject),

        // 2. Email Tyler full post copy
        (async () => {
          const tylerEmail = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;
          if (!tylerEmail) return false;
          const { sendEmail } = await import("@/lib/resend");
          const { html, subject } = tylerAlertEmail(alert);
          return sendEmail(tylerEmail, subject, html);
        })(),

        // 3. Phase 2: alert partners assigned to the affected ZIPs
        alertMatchedPartners(alert),

        // 4. Log intel opportunities
        (async () => {
          if (!process.env.SUPABASE_URL) return;
          const { getSupabase } = await import("@/lib/supabase");
          const db = getSupabase();

          await Promise.allSettled(
            affectedCities.slice(0, 6).map(async (c) => {
              const oppSourceId = `storm_${alert.nws_id}_${c.replace(/\s+/g, "_")}`;
              if (await opportunityExists(oppSourceId)) return;

              const { score, priority } = scoreOpportunity({ source: "storm", hailSizeInches, ageHours: 0 });
              const title = `Hail hit ${c} — ${hailSizeInches >= 1 ? `${hailSizeInches}" hail` : hailNote(alert)}`;
              const body = `NWS alert: ${alert.headline}. Affected area: ${alert.areas.slice(0, 200)}`;
              const analysis = priority !== "low"
                ? await generateAIAnalysis({ title, body, source: "storm", location: c, score, intent: "storm" })
                : null;

              await saveOpportunity({
                source: "storm", source_id: oppSourceId, type: "storm_victim_area", priority,
                title, body, location: c, urgency_score: score, opportunity_score: score,
                why_it_matters: analysis?.why_it_matters,
                close_probability: analysis?.close_probability,
                outreach_message: analysis?.outreach_message,
                follow_up_schedule: analysis?.follow_up_schedule,
              });
            })
          );

          await db.from("activity_log").insert({
            type: "storm_detected",
            description: `Hail in ${affectedCities.join(", ")} — Tyler notified`,
            metadata: { alert_id: alert.nws_id, cities: affectedCities },
          });
        })(),
      ]);

      results.tyler_notified = notifyResult.status === "fulfilled" || emailResult.status === "fulfilled";
      results.partners_alerted = partnerResult.status === "fulfilled" ? (partnerResult.value as number) || 0 : 0;

      const failed = [notifyResult, emailResult, partnerResult, intelResult]
        .filter(r => r.status === "rejected")
        .map(r => (r as PromiseRejectedResult).reason?.message || "unknown");
      if (failed.length > 0) console.error("Storm actions failed:", failed);

      await markAlertProcessed(alert, {
        tyler_notified: results.tyler_notified,
        partners_alerted: results.partners_alerted,
      });

      break; // Only process the first (most severe) new alert to avoid blast spam
    }

    await runner.finish(logId, { actionsCount: results.new_hail_alerts + results.watch_alerts });
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    await runner.finish(logId, { error: String(error) });
    console.error("Storm check error:", error);
    return NextResponse.json({ error: "Storm check failed" }, { status: 500 });
  }
}
