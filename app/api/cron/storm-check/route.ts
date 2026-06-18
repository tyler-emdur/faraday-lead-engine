// CRON: Storm Monitor — runs every 30 min via GitHub Actions (storm-check.yml)
// Vercel daily cron at 8am is a fallback.
//
// When hail hits the Front Range:
//   1. Text Tyler immediately with post templates + lead page link
//   2. Email Tyler full Nextdoor/Facebook post copy ready to paste
//   3. B2B blast — email all prospects in affected cities while it's hot
//   4. Log storm opportunity intel
//
// Requires: CRON_SECRET
// Optional: TYLER_PHONE/TEAM_PHONE, TYLER_EMAIL/TEAM_EMAIL, RESEND_API_KEY, SUPABASE_URL

import { NextRequest, NextResponse } from "next/server";
import { fetchColoradoAlerts, fetchColoradoWatches, type StormAlert } from "@/lib/nws";
import { notifyTyler } from "@/lib/notify";
import { cronRunner } from "@/lib/logger";
import { scoreOpportunity, generateAIAnalysis, saveOpportunity, opportunityExists } from "@/lib/intel";

export const maxDuration = 60;

const CRON_INTERVAL_MINUTES = 30;
const WINDOW_MS = (CRON_INTERVAL_MINUTES + 5) * 60 * 1000;

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
  return alert.has_hail ? "hail confirmed" : "severe storm";
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

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">
        Speed matters: leads within 6 hours of a storm convert at 2–3x the normal rate.<br>
        Post now → run the ad → check your dashboard.
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

// When hail hits, immediately email every B2B prospect in that area.
// A property manager getting this while residents are texting about damage will respond.
const B2B_STORM_SEGMENTS: Record<string, (company: string, city: string, hail: string) => string> = {
  hoa_manager: (_, city, hail) =>
    `Hi — I'm Anna with Faraday Construction. ${hail} just hit ${city} — your communities may have damage residents haven't spotted yet. We do free community-wide assessments with written reports for the board at no cost to the HOA. Want us to schedule for this week before claim windows close? - Anna`,
  property_manager: (_, city, hail) =>
    `Hi — Anna with Faraday. ${hail} hit ${city} tonight. Several property managers in the area are already booking free post-storm roof assessments — we provide written reports for insurance documentation at no charge. Can we schedule a quick look at your properties this week? - Anna`,
  apartment_manager: (_, city, hail) =>
    `Hi — Anna with Faraday Construction. ${hail} hit ${city} — flat roof damage from hail is easy to miss and can void warranties if not documented quickly. We do free certified inspections with written reports for maintenance records. Interested for this week? - Anna`,
  condo_manager: (_, city, hail) =>
    `Hi — ${hail} just hit ${city}. For condo associations, undocumented hail damage creates shared liability issues. Faraday does free community assessments with board-ready written reports. Worth a quick look this week? - Anna`,
  insurance_agent: (_, city, hail) =>
    `Hi — Anna with Faraday. ${hail} hit ${city} tonight — your clients in the area may be calling you. When they ask about next steps, we'd love to be your go-to referral for free inspections. We make the claim process easy so you look good. - Anna`,
  public_adjuster: (_, city, hail) =>
    `Hi — Anna with Faraday Construction. ${hail} hit ${city} tonight. If you're taking on storm claims in the area, we'd like to be your roofing partner — we document damage thoroughly, turn around written reports fast, and work directly with adjusters. Worth connecting this week? - Anna`,
  home_inspector: (_, city, hail) =>
    `Hi — Anna with Faraday. ${hail} just hit ${city}. If you have inspections coming up in the area, we can provide same-day roof cert letters for deals where the inspector flags storm damage. Would that be a useful referral to have on hand? - Anna`,
  restoration_contractor: (_, city, hail) =>
    `Hi — ${hail} hit ${city} tonight. If you're getting water-intrusion calls from the storm, we're doing free roof assessments this week and can coordinate with restoration crews on-site. Want to link up? - Anna, Faraday Construction`,
  gutter_company: (_, city, hail) =>
    `Hi — Anna with Faraday. ${hail} hit ${city} tonight. If you're up on roofs this week doing gutter work and spot storm damage, we'd love to be your referral — we pay $50 per lead that turns into an inspection. Worth a quick chat? - Anna`,
  general_contractor: (_, city, hail) =>
    `Hi — ${hail} just hit ${city}. If any of your clients are asking about roof damage from tonight's storm, Faraday handles the full insurance process — free inspection, documentation, claim filing. Happy to be your roofing referral. - Anna`,
};

async function blastB2BOnStorm(alert: StormAlert): Promise<number> {
  if (!process.env.SUPABASE_URL || !process.env.RESEND_API_KEY) return 0;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const { sendEmail } = await import("@/lib/resend");
    const db = getSupabase();
    const affectedCities = alert.affected_cities.map(c => c.toLowerCase());
    const hail = hailNote(alert);
    const city = primaryCity(alert);

    const { data: prospects } = await db
      .from("outbound_prospects")
      .select("id, email, name, company, city, source")
      .not("email", "is", null)
      .not("status", "eq", "do_not_contact")
      .not("status", "eq", "unqualified");

    if (!prospects?.length) return 0;

    const targeted = prospects.filter(p => {
      if (!p.city) return false;
      const pCity = p.city.toLowerCase();
      return affectedCities.some(ac =>
        pCity.includes(ac) ||
        (pCity.split(" ")[0].length >= 4 && ac.includes(pCity.split(" ")[0]))
      );
    });

    if (targeted.length === 0) return 0;

    let sent = 0;
    for (const prospect of targeted.slice(0, 30)) {
      const seg = prospect.source || "property_manager";
      const messageFn = B2B_STORM_SEGMENTS[seg] || B2B_STORM_SEGMENTS["property_manager"];
      const body = messageFn(prospect.company || prospect.name || "there", city, hail);
      const subject = `${hail} just hit ${city} — free community assessments this week`;
      try {
        await sendEmail(
          prospect.email!,
          subject,
          `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;max-width:560px;">${body}</div>`
        );
        await db.from("email_threads").upsert({
          prospect_id: prospect.id,
          thread_id: `storm_${alert.nws_id}_${prospect.id}`,
          role: "assistant",
          content: body,
          subject,
        }).catch(() => {});
        sent++;
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`Storm B2B blast failed for ${prospect.email}:`, e);
      }
    }
    return sent;
  } catch (e) {
    console.error("Storm B2B blast failed:", e);
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
    b2b_blasted: 0,
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
      const city = primaryCity(alert);
      const hailSizeInches = alert.hail_size_inches || 0.75;

      const [notifyResult, emailResult, b2bResult, intelResult] = await Promise.allSettled([

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

        // 3. B2B blast to prospects in affected cities
        blastB2BOnStorm(alert),

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
      results.b2b_blasted = b2bResult.status === "fulfilled" ? (b2bResult.value as number) || 0 : 0;

      const failed = [notifyResult, emailResult, b2bResult, intelResult]
        .filter(r => r.status === "rejected")
        .map(r => (r as PromiseRejectedResult).reason?.message || "unknown");
      if (failed.length > 0) console.error("Storm actions failed:", failed);

      await markAlertProcessed(alert, {
        tyler_notified: results.tyler_notified,
        b2b_blasted: results.b2b_blasted,
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
