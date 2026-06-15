// POST /api/webhook/lead-platform — Universal speed-to-lead webhook
// Accepts new leads from Angi, HomeAdvisor, Thumbtack, Google LSA, and any
// other platform via webhook. Saves to Supabase and texts the lead within
// 60 seconds — before competing contractors even read the notification.
//
// Setup per platform:
//   Angi:          Webhook URL in your Angi Pro account → Integrations
//   HomeAdvisor:   Account Settings → Notifications → Webhook
//   Thumbtack:     Pro Dashboard → Settings → Webhook
//   Google LSA:    Use Zapier trigger on "New LSA Lead" → POST here
//
// Auth: pass ?secret=CRON_SECRET as a query param (keep this URL private)

import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/twilio";
import { notifyTyler } from "@/lib/notify";
import { normalizePhone } from "@/lib/phone";

export const maxDuration = 30;

interface NormalizedLead {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  zip?: string;
  service?: string;
  source: string;
  notes?: string;
}

// ── Platform payload normalizers ────────────────────────────────────────────
// Each platform sends a different JSON shape. Normalize to a common format.

function normalizeAngi(body: Record<string, unknown>): NormalizedLead {
  const c = (body.consumer || body.customer || body) as Record<string, unknown>;
  return {
    name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || String(c.name || ""),
    phone: String(c.phone || c.phone_number || ""),
    email: String(c.email || ""),
    city: String(c.city || c.service_city || ""),
    zip: String(c.zip || c.zip_code || c.postal_code || ""),
    service: String(body.category || body.service_type || c.task_name || "hail_damage"),
    source: "angi",
    notes: String(body.description || body.details || ""),
  };
}

function normalizeHomeAdvisor(body: Record<string, unknown>): NormalizedLead {
  const l = (body.lead || body) as Record<string, unknown>;
  const customer = (l.customer || l) as Record<string, unknown>;
  return {
    name: String(customer.name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim()),
    phone: String(customer.phone || ""),
    email: String(customer.email || ""),
    city: String(customer.city || ""),
    zip: String(customer.zip_code || ""),
    service: String(l.task_name || l.category_name || "roofing"),
    source: "homeadvisor",
    notes: String(l.task_description || ""),
  };
}

function normalizeThumbtack(body: Record<string, unknown>): NormalizedLead {
  const c = (body.customer || body) as Record<string, unknown>;
  const loc = (c.location || {}) as Record<string, unknown>;
  return {
    name: String(c.name || ""),
    phone: String(c.phone || ""),
    email: String(c.email || ""),
    city: String(loc.city || c.city || ""),
    zip: String(loc.zip || c.zip || ""),
    service: String(body.category || "roofing"),
    source: "thumbtack",
    notes: String(body.description || ""),
  };
}

function normalizeGeneric(body: Record<string, unknown>): NormalizedLead {
  return {
    name: String(
      body.name || body.full_name || body.customer_name ||
      `${body.first_name || ""} ${body.last_name || ""}`.trim() || ""
    ),
    phone: String(body.phone || body.phone_number || body.mobile || ""),
    email: String(body.email || ""),
    city: String(body.city || body.service_city || ""),
    zip: String(body.zip || body.zip_code || body.postal_code || ""),
    service: String(body.service || body.category || body.task || "hail_damage"),
    source: String(body.source || body.platform || "platform_webhook"),
    notes: String(body.notes || body.description || body.message || ""),
  };
}

function detectPlatform(body: Record<string, unknown>, searchParams: URLSearchParams): string {
  const platform = searchParams.get("platform") || "";
  if (platform) return platform.toLowerCase();
  if (body.lead_id && body.consumer) return "angi";
  if (body.lead && (body.lead as Record<string, unknown>).customer) return "homeadvisor";
  if (body.customer && body.category) return "thumbtack";
  return "generic";
}

// ── Speed-to-lead SMS — sent within 60s of lead arriving ──────────────────

function speedToLeadSms(lead: NormalizedLead): string {
  const firstName = lead.name.split(" ")[0] || "there";
  const source = lead.source === "angi" ? "Angi" : lead.source === "homeadvisor" ? "HomeAdvisor" : "Thumbtack";
  return `Hi ${firstName}! I'm Anna from Faraday Construction. I saw your request on ${source} — we'd love to come out and do a FREE inspection this week. Insurance usually covers hail damage at 100%. When's a good time? 📅 Reply or call (720) 766-1518.`;
}

// ── Main handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check — the webhook URL contains ?secret=CRON_SECRET
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platform = detectPlatform(body, url.searchParams);

  let lead: NormalizedLead;
  if (platform === "angi") lead = normalizeAngi(body);
  else if (platform === "homeadvisor") lead = normalizeHomeAdvisor(body);
  else if (platform === "thumbtack") lead = normalizeThumbtack(body);
  else lead = normalizeGeneric(body);

  const phone = normalizePhone(lead.phone);
  if (!phone) {
    return NextResponse.json({ error: "No phone number in lead" }, { status: 400 });
  }

  // ── Save to Supabase ────────────────────────────────────────────────────
  let leadId: string | undefined;
  if (process.env.SUPABASE_URL) {
    try {
      const { getSupabase } = await import("@/lib/supabase");
      const { scoreLead, gradeLead } = await import("@/lib/scoring");
      const score = scoreLead({ phone, city: lead.city, service: lead.service, homeowner: true });
      const { grade } = gradeLead(score);

      const { data } = await getSupabase()
        .from("leads")
        .insert({
          name: lead.name,
          phone,
          email: lead.email || null,
          city: lead.city || null,
          zip: lead.zip || null,
          service: lead.service || "hail_damage",
          homeowner: true,
          score,
          grade,
          notes: lead.notes || null,
          source: lead.source,
          source_detail: platform,
          status: "New",
        })
        .select("id")
        .single();

      leadId = data?.id;

      await getSupabase().from("activity_log").insert({
        type: "lead_captured",
        description: `Platform webhook: ${lead.name} via ${platform}`,
        metadata: { lead_id: leadId, source: platform, phone },
      });
    } catch (e) {
      console.error("Supabase save failed:", e);
    }
  }

  // ── Speed-to-lead SMS (fire immediately) ────────────────────────────────
  const smsSent = await sendSMS(phone, speedToLeadSms(lead)).catch(() => false);

  // ── Notify Tyler ─────────────────────────────────────────────────────────
  const msg = [
    `⚡ PLATFORM LEAD — ${platform.toUpperCase()}`,
    `${lead.name} | ${phone}`,
    `${lead.city || "CO"} | ${lead.service || "roofing"}`,
    smsSent ? `Anna texted them — you should call NOW` : `Call immediately: ${phone}`,
  ].join("\n");

  await notifyTyler(msg, `⚡ ${platform} Lead — ${lead.name}`).catch(() => {});

  return NextResponse.json({
    success: true,
    lead_id: leadId,
    sms_sent: smsSent,
    speed_to_lead_seconds: 0,
  });
}
