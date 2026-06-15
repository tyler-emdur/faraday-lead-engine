// CRON: Storm Monitor — runs every 30 minutes via vercel.json
// When hail hits the Front Range:
//   1. Text Tyler immediately (formatted for action)
//   2. Email Tyler full post templates + ad copy
//   3. Auto-post to Facebook Page (if FACEBOOK_PAGE_ACCESS_TOKEN set)
//   4. Blast opt-in storm subscribers in the affected area
//   5. Trigger immediate blog post (SEO — don't wait for Monday)
//   6. Create Google Ads search campaign targeting storm-specific keywords
//   6b. YouTube pre-roll video campaign (if GOOGLE_ADS_VIDEO_ASSET_ID set)
//   6c. StackAdapt geofencing in storm zip codes (if STACKADAPT_API_KEY set)
//   6d. Buffer social post queued for Instagram/Facebook/LinkedIn
//   7. Re-engage past leads in the storm area via SMS (free money)
//   8. Create intel opportunities per affected city
//
// Requires: TYLER_PHONE or TEAM_PHONE, CRON_SECRET
// Optional: RESEND_API_KEY, FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID,
//           GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_VIDEO_ASSET_ID,
//           STACKADAPT_API_KEY, BUFFER_ACCESS_TOKEN

import { NextRequest, NextResponse } from "next/server";
import { fetchColoradoAlerts, fetchColoradoWatches, type StormAlert } from "@/lib/nws";
import { notifyTyler } from "@/lib/notify";
import { sendSMS } from "@/lib/twilio";
import { postToFacebook } from "@/lib/social";
import { cronRunner } from "@/lib/logger";

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

async function markAlertProcessed(alert: StormAlert, actionResults?: Record<string, unknown>): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();
    // Write to storm_alerts (primary, for existing joins)
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
    // Also write to storm_events for richer tracking
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

// ─── CONTENT GENERATION ───────────────────────────────────────────────────────

function primaryCity(alert: StormAlert): string {
  return alert.affected_cities[0] || alert.areas.split(";")[0].split(",")[0].trim();
}

function hailNote(alert: StormAlert): string {
  if (alert.hail_size_text) return alert.hail_size_text;
  if (alert.hail_size_inches > 0) return `${alert.hail_size_inches}-inch hail`;
  return alert.has_hail ? "hail confirmed" : "severe storm";
}

function tylerSms(alert: StormAlert): string {
  const city = primaryCity(alert);
  const hail = hailNote(alert);
  const cities = alert.affected_cities.slice(0, 3).join(", ");
  return [
    `⚡ STORM HIT — Post NOW`,
    `${hail.toUpperCase()} in ${cities}`,
    `→ Full templates: ${process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com"}/storm`,
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
        Post now → run the ad → check your dashboard for incoming leads.
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

// ─── STORM SUBSCRIBER BLAST ───────────────────────────────────────────────────
// People who opted in via faradaysun.com/storm-alerts to get notified when hail hits

function subscriberBlastSms(
  subscriber: { name: string | null; zip: string | null },
  city: string,
  hailNote: string
): string {
  const firstName = subscriber.name?.split(" ")[0] || "there";
  return `Hey ${firstName}! 🌧 Hail just hit ${city} — ${hailNote}. Your area may qualify for a FREE roof inspection. Insurance usually covers it 100%. Reply YES and I'll set you up with an inspector today. -Anna, Faraday Construction`;
}

async function blastStormSubscribers(
  cities: string[]
): Promise<number> {
  if (!process.env.SUPABASE_URL || cities.length === 0) return 0;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const citiesLower = cities.map(c => c.toLowerCase());

    // Fetch opted-in subscribers near the affected cities
    // storm_subscribers table: id, phone, name, zip, city, status, created_at
    const { data: subscribers } = await getSupabase()
      .from("storm_subscribers")
      .select("phone, name, zip, city")
      .eq("status", "active")
      .not("phone", "is", null);

    if (!subscribers?.length) return 0;

    // Filter to affected area
    const affected = subscribers.filter(s =>
      citiesLower.some(c =>
        (s.city || "").toLowerCase().includes(c) ||
        citiesLower.includes((s.city || "").toLowerCase())
      )
    );

    let sent = 0;
    for (const sub of affected) {
      const city = cities[0];
      const msg = subscriberBlastSms(sub, city, "hail detected");
      await sendSMS(sub.phone, msg).catch(e =>
        console.error(`Subscriber blast failed for ${sub.phone}:`, e)
      );
      sent++;
    }

    return sent;
  } catch (e) {
    console.error("Subscriber blast failed:", e);
    return 0;
  }
}

// ─── IMMEDIATE BLOG TRIGGER ───────────────────────────────────────────────────
// Generates a storm-specific blog post NOW instead of waiting for Monday's cron.
// SEO content for "Westminster hail May 14" — zero competition, ranks fast.

async function triggerStormBlogPost(city: string, hailNote: string, alertDate: string): Promise<boolean> {
  if (!process.env.AI_API_KEY || !process.env.SUPABASE_URL) return false;

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();

    const slug = `${city.toLowerCase().replace(/\s+/g, "-")}-hail-${alertDate.replace(/\s+/g, "-").toLowerCase()}`;
    const { data: existing } = await db.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
    if (existing) return false; // Already published for this storm

    const prompt = `Write an SEO blog post for Faraday Construction about the ${hailNote} hailstorm that just hit ${city}, Colorado on ${alertDate}.

The post should:
- Describe what happened and how to identify hail damage to a roof
- Explain that homeowners insurance typically covers hail damage
- Mention that claim windows close quickly (people need to act within weeks)
- Include Faraday's free inspection offer and phone number (720) 766-1518
- Be 500-700 words, helpful and urgent tone — this just happened
- Use the exact phrase "${city} hail ${alertDate}" naturally in the first paragraph
- Target homeowners who are Googling the specific storm right now

Return ONLY JSON (no backticks):
{"title":"...","meta_description":"...","slug":"${slug}","content":"..."}`;

    const res = await fetch(
      `${(process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim()}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(process.env.AI_API_KEY || "").trim()}`,
        },
        body: JSON.stringify({
          model: (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim(),
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.5,
        }),
      }
    );

    if (!res.ok) return false;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const post = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);

    await db.from("blog_posts").insert({
      title: post.title,
      slug: post.slug || slug,
      content: post.content,
      meta_description: post.meta_description,
      target_keyword: `${city} hail ${alertDate}`,
      target_city: city,
      published: true,
      published_at: new Date().toISOString(),
    });

    console.log(`Storm blog published: ${post.title}`);
    return true;
  } catch (e) {
    console.error("Storm blog generation failed:", e);
    return false;
  }
}

// ─── REENGAGEMENT ─────────────────────────────────────────────────────────────

async function getLeadsForReengagement(
  cities: string[]
): Promise<{ name: string; phone: string; cityZip: string; service: string }[]> {
  if (!process.env.SUPABASE_URL || cities.length === 0) return [];
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: leads } = await getSupabase()
      .from("leads")
      .select("name, phone, city, zip, service, status")
      .not("phone", "is", null)
      .neq("status", "Won")
      .gte("created_at", ninetyDaysAgo)
      .lte("created_at", twoDaysAgo);

    if (!leads) return [];
    const citiesLower = cities.map(c => c.toLowerCase());
    return leads
      .filter(l => l.phone && citiesLower.some(c =>
        (l.city || "").toLowerCase().includes(c) ||
        (l.zip || "").includes(c)
      ))
      .map(l => ({
        name: l.name || "",
        phone: l.phone || "",
        cityZip: [l.city, l.zip].filter(Boolean).join(" "),
        service: l.service || "",
      }));
  } catch (e) {
    console.error("Failed to get reengagement leads:", e);
    return [];
  }
}

// ─── MAIN CRON HANDLER ────────────────────────────────────────────────────────

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
    tyler_sms_sent: false,
    tyler_email_sent: false,
    facebook_posted: false,
    subscribers_blasted: 0,
    leads_reengaged: 0,
    blog_triggered: false,
    google_ads_created: false,
    youtube_ad_created: false,
    geofencing_created: false,
  };

  try {
    const [allAlerts, watchAlerts] = await Promise.all([
      fetchColoradoAlerts(),
      fetchColoradoWatches(),
    ]);
    results.alerts_checked = allAlerts.length;

    // ── Pre-storm watch alerts ────────────────────────────────────────────────
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
              why_it_matters: `Storm watch issued for ${city}. Storm expected in 2–12 hours. Get positioned in community groups now.`,
              outreach_message: `Storm watch active for ${city}. Pre-stage your posts so you can publish the moment hail falls.`,
            });
          })
        );
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

      const affectedCities = alert.affected_cities;
      const city = primaryCity(alert);
      const hail = hailNote(alert);
      const hailSizeInches = alert.hail_size_inches || 0.75;
      const alertDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

      // ── Run all storm actions in parallel with Promise.allSettled ───────────
      const [
        notifyResult,
        emailResult,
        fbResult,
        subscriberResult,
        blogResult,
        adsResult,
        videoResult,
        geofenceResult,
        bufferResult,
        reengageResult,
        intelResult,
      ] = await Promise.allSettled([

        // 1. SMS notify Tyler
        notifyTyler(tylerSms(alert), tylerAlertEmail(alert).subject),

        // 2. Rich email to Tyler with post templates
        (async () => {
          const tylerEmail = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;
          if (!tylerEmail) return false;
          const { sendEmail } = await import("@/lib/resend");
          const { html, subject } = tylerAlertEmail(alert);
          return sendEmail(tylerEmail, subject, html);
        })(),

        // 3. Auto-post to Facebook Page
        postToFacebook(facebookPagePost(alert)),

        // 4. Blast storm subscribers
        blastStormSubscribers(affectedCities),

        // 5. Trigger storm blog post
        triggerStormBlogPost(city, hail, alertDate),

        // 6. Google Ads campaign
        (async () => {
          if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return null;
          const { createStormCampaign } = await import("@/lib/google-ads");
          return createStormCampaign({ city, hailNote: hail, stormDate: alertDate });
        })(),

        // 6b. YouTube pre-roll
        (async () => {
          if (!process.env.GOOGLE_ADS_VIDEO_ASSET_ID) return null;
          const { createStormVideoAd } = await import("@/lib/google-ads");
          return createStormVideoAd({ city, hailNote: hail, stormDate: alertDate });
        })(),

        // 6c. StackAdapt geofencing
        (async () => {
          if (!process.env.STACKADAPT_API_KEY) return null;
          const { createGeofenceCampaign } = await import("@/lib/stackadapt");
          return createGeofenceCampaign({ city, hailNote: hail });
        })(),

        // 6d. Buffer social post
        (async () => {
          if (!process.env.BUFFER_ACCESS_TOKEN) return null;
          const { generateStormPost, queuePost } = await import("@/lib/buffer");
          return queuePost({ text: generateStormPost(city, hail) });
        })(),

        // 7. Re-engage past leads in storm area
        (async () => {
          const oldLeads = await getLeadsForReengagement(affectedCities);
          const sent: string[] = [];
          await Promise.allSettled(
            oldLeads.map(async (lead) => {
              const sms = reengagementSms(lead, city, hail);
              await sendSMS(lead.phone, sms);
              sent.push(lead.phone);
            })
          );
          return sent.length;
        })(),

        // 8. Create intel opportunities per city
        (async () => {
          if (!process.env.SUPABASE_URL) return;
          const { getSupabase } = await import("@/lib/supabase");
          const db = getSupabase();
          const { data: stormRow } = await db.from("storm_alerts").select("id").eq("nws_id", alert.nws_id).maybeSingle();

          await Promise.allSettled(
            affectedCities.slice(0, 6).map(async (c) => {
              const oppSourceId = `storm_${alert.nws_id}_${c.replace(/\s+/g, "_")}`;
              if (await opportunityExists(oppSourceId)) return;

              const { score, priority } = scoreOpportunity({ source: "storm", hailSizeInches, ageHours: 0 });
              const title = `Hail hit ${c} — ${hailSizeInches >= 1 ? `${hailSizeInches}" hail` : hail}`;
              const body = `NWS alert: ${alert.headline}. Affected area: ${alert.areas.slice(0, 200)}`;
              const analysis = priority !== "low"
                ? await generateAIAnalysis({ title, body, source: "storm", location: c, score, intent: "storm" })
                : null;

              const opp = await saveOpportunity({
                source: "storm", source_id: oppSourceId, type: "storm_victim_area", priority,
                title, body, location: c, urgency_score: score, opportunity_score: score,
                why_it_matters: analysis?.why_it_matters,
                close_probability: analysis?.close_probability,
                outreach_message: analysis?.outreach_message,
                follow_up_schedule: analysis?.follow_up_schedule,
              });

              if (stormRow?.id) {
                const severityScore = hailSizeInches >= 2 ? 90 : hailSizeInches >= 1.5 ? 75 : hailSizeInches >= 1 ? 60 : 40;
                await db.from("storm_affected_areas").insert({
                  storm_alert_id: stormRow.id,
                  city: c,
                  hail_size_inches: hailSizeInches,
                  severity_score: severityScore,
                  impact_radius_miles: hailSizeInches >= 1.5 ? 8 : hailSizeInches >= 1 ? 5 : 3,
                  estimated_homes: Math.round(severityScore * 50),
                  opportunity_id: opp?.id ?? null,
                });
              }
            })
          );

          await db.from("activity_log").insert({
            type: "storm_detected",
            description: `Hail in ${affectedCities.join(", ")} — Tyler notified`,
            metadata: { alert_id: alert.nws_id, cities: affectedCities },
          });
        })(),
      ]);

      // Collect results
      results.tyler_sms_sent = notifyResult.status === "fulfilled";
      results.tyler_email_sent = emailResult.status === "fulfilled" && !!emailResult.value;
      results.facebook_posted = fbResult.status === "fulfilled" && !!fbResult.value;
      results.subscribers_blasted = subscriberResult.status === "fulfilled" ? (subscriberResult.value as number) || 0 : 0;
      results.blog_triggered = blogResult.status === "fulfilled" && !!blogResult.value;
      results.google_ads_created = adsResult.status === "fulfilled" && !!adsResult.value;
      results.youtube_ad_created = videoResult.status === "fulfilled" && !!videoResult.value;
      results.geofencing_created = geofenceResult.status === "fulfilled" && !!geofenceResult.value;
      results.leads_reengaged = reengageResult.status === "fulfilled" ? (reengageResult.value as number) || 0 : 0;

      // Log any failures
      const failedActions = [notifyResult, emailResult, fbResult, subscriberResult, blogResult, adsResult, videoResult, geofenceResult, bufferResult, reengageResult, intelResult]
        .filter(r => r.status === "rejected")
        .map(r => (r as PromiseRejectedResult).reason?.message || "unknown");
      if (failedActions.length > 0) console.error("Storm actions failed:", failedActions);

      // Mark alert processed with action results
      await markAlertProcessed(alert, {
        tyler_notified: results.tyler_sms_sent,
        facebook_posted: results.facebook_posted,
        sms_blasts_sent: results.subscribers_blasted,
        leads_reengaged: results.leads_reengaged,
        blog_published: results.blog_triggered,
        ads_created: results.google_ads_created,
        geofence_created: results.geofencing_created,
      });

      // Only process the first (most severe) new hail alert to avoid SMS spam
      break;
    }

    await runner.finish(logId, { actionsCount: results.new_hail_alerts + results.watch_alerts });
    console.log("Storm check:", JSON.stringify(results));
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    await runner.finish(logId, { error: String(error) });
    console.error("Storm check cron error:", error);
    return NextResponse.json({ error: "Storm check failed" }, { status: 500 });
  }
}
