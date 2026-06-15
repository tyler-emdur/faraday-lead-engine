// CRON: Contact Form Targets — runs weekly on Monday at 7am
// Finds businesses from outbound_prospects with a website but no email.
// Anna:
//   1. Drafts a personalized message (Groq)
//   2. Auto-submits it via the business's contact form (no headless browser needed
//      for most sites; falls back to browserless.io if BROWSERLESS_TOKEN is set)
//   3. Records status: "sent" | "pending_send" (manual) | "skipped"
//
// Requires: SUPABASE_URL, AI_API_KEY
// Optional: BROWSERLESS_TOKEN (for JavaScript-heavy contact forms)

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { submitContactForm } from "@/lib/form-submit";

export const maxDuration = 120;

const CONTACT_FORM_SYSTEM = `You are Anna, AI assistant for Faraday Construction — Colorado's top hail damage roofing company.

Draft a short, professional message for a business's contact form.

Rules:
- 3-4 sentences MAX
- Casual but professional — not salesy
- Mention one specific reason Faraday is useful to THEIR type of business
- End with Tyler's direct line: (720) 766-1518
- Do NOT mention "AI" or "automated" or "mass outreach"
- Sound like Tyler wrote it personally

Respond with ONLY the message text.`;

function getAIClient() {
  return new OpenAI({
    apiKey: (process.env.AI_API_KEY || "no-key").trim(),
    baseURL: (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim(),
  });
}

interface Prospect {
  id: string;
  name: string;
  website: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  city_hint: string | null;
}

const SEGMENT_LABELS: Record<string, string> = {
  insurance_agent: "independent insurance agent",
  property_manager: "property management company",
  hoa_manager: "HOA / homeowners association management company",
  condo_manager: "condo association management company",
  apartment_manager: "apartment complex manager",
  mortgage_broker: "mortgage broker",
  title_company: "title company",
  realtor: "real estate agent",
};

async function draftMessage(prospect: Prospect): Promise<string> {
  const fallback = `Hi! I'm Tyler with Faraday Construction — Colorado's hail damage roofing experts. We frequently work with ${SEGMENT_LABELS[prospect.source || ""] || "businesses"} in the area and I'd love to connect about how we might help each other's clients. Give me a call at (720) 766-1518 anytime.`;

  try {
    const client = getAIClient();
    const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();
    const segmentLabel = SEGMENT_LABELS[prospect.source || ""] || "business";

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 200,
      temperature: 0.7,
      messages: [
        { role: "system", content: CONTACT_FORM_SYSTEM },
        {
          role: "user",
          content: `Business name: ${prospect.name}
Business type: ${segmentLabel}
City: ${prospect.city_hint || "Colorado"}
Website: ${prospect.website}

Draft the contact form message.`,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ success: false, message: "SUPABASE_URL not set" });
  }

  const { getSupabase } = await import("@/lib/supabase");
  const db = getSupabase();

  const { data: prospects, error } = await db
    .from("outbound_prospects")
    .select("id, name, website, source, metadata, city_hint")
    .not("website", "is", null)
    .or("email.is.null,email.eq.")
    .eq("contact_form_queued", false)
    .order("created_at", { ascending: false })
    .limit(15); // lower cap to stay within 120s timeout with auto-submit

  if (error) {
    console.error("Contact form targets query failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!prospects || prospects.length === 0) {
    return NextResponse.json({ success: true, queued: 0, auto_sent: 0, message: "No new targets" });
  }

  let queued = 0;
  let auto_sent = 0;
  let needs_manual = 0;

  for (const prospect of prospects as Prospect[]) {
    if (!prospect.website) continue;

    const message = await draftMessage(prospect);

    // Attempt auto-submission
    const submitResult = await submitContactForm(
      prospect.website,
      message,
      "Tyler Emdur",
      process.env.FROM_EMAIL || "leads@faradayconstruction.com"
    );

    const status = submitResult.success ? "sent" : "pending_send";
    const submitMeta = submitResult.success
      ? { auto_submitted: true, method: submitResult.method }
      : { auto_submitted: false, reason: submitResult.reason, detail: (submitResult as { detail?: string }).detail };

    // Save to contact_form_queue
    const { error: insertErr } = await db.from("contact_form_queue").insert({
      prospect_id: prospect.id,
      business_name: prospect.name,
      website: prospect.website,
      source: prospect.source,
      city: prospect.city_hint,
      drafted_message: message,
      status,
      queued_at: new Date().toISOString(),
      sent_at: submitResult.success ? new Date().toISOString() : null,
    });

    if (!insertErr) {
      await db
        .from("outbound_prospects")
        .update({ contact_form_queued: true })
        .eq("id", prospect.id);

      queued++;
      if (submitResult.success) auto_sent++;
      else needs_manual++;

      console.log(`${prospect.name}: ${status} (${submitResult.success ? (submitResult as { method: string }).method : (submitResult as { reason: string }).reason})`, submitMeta);
    }
  }

  console.log(`Contact form targets: ${queued} queued, ${auto_sent} auto-sent, ${needs_manual} need manual`);
  return NextResponse.json({ success: true, queued, auto_sent, needs_manual, total_found: prospects.length });
}
