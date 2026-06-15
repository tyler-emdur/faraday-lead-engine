// CRON: Contact Form Targets — runs weekly on Monday at 7am
// Finds businesses from the outbound_prospects table that:
//   1. Have a website URL
//   2. Do NOT have a guessable email (email is null/empty)
//   3. Haven't been queued yet
//
// For each one, Anna pre-drafts a personalized message that Tyler can submit
// via the business's contact form. These are saved to contact_form_queue.
//
// Why: Some of the best referral partners (small insurance agencies, boutique
// property managers) don't have guessable emails but DO have contact forms.
// This keeps them in the funnel without requiring Tyler to write from scratch.
//
// Requires: SUPABASE_URL, AI_API_KEY (for message drafting)
// Schema: see db/schema-outbound.sql — contact_form_queue table

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const CONTACT_FORM_SYSTEM = `You are Anna, AI assistant for Faraday Construction — Colorado's top hail damage roofing company.

Draft a short, professional message for Tyler to paste into a business's contact form.

Rules:
- 3-4 sentences MAX
- Casual but professional — not salesy
- Mention one specific reason Faraday is useful to THEIR type of business
- End with Tyler's direct line: (720) 766-1518
- Do NOT mention "AI" or "automated" or "mass outreach"
- Sound like Tyler wrote it personally

The message will be pasted into a generic "Contact Us" web form.
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

async function draftMessage(prospect: Prospect): Promise<string> {
  try {
    const client = getAIClient();
    const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();

    const segmentLabel =
      {
        insurance_agent: "independent insurance agent",
        property_manager: "property management company",
        hoa_manager: "HOA / homeowners association management company",
        condo_manager: "condo association management company",
        apartment_manager: "apartment complex manager",
        mortgage_broker: "mortgage broker",
        title_company: "title company",
        realtor: "real estate agent",
      }[prospect.source || ""] || "business";

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

    return (
      completion.choices[0]?.message?.content?.trim() ||
      `Hi! I'm Tyler with Faraday Construction — Colorado's hail damage roofing experts. We frequently work with ${segmentLabel}s in the area and I'd love to connect about how we might be able to help each other's clients. Give me a call at (720) 766-1518 anytime.`
    );
  } catch (e) {
    console.error("Draft message failed for", prospect.name, e);
    return `Hi! I'm Tyler with Faraday Construction — we specialize in hail damage roofing in Colorado and love working with local ${prospect.source || "businesses"}. Would love to connect — call me at (720) 766-1518.`;
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

  // Find prospects with a website but no email, not yet queued
  const { data: prospects, error } = await db
    .from("outbound_prospects")
    .select("id, name, website, source, metadata, city_hint")
    .not("website", "is", null)
    .or("email.is.null,email.eq.")
    .eq("contact_form_queued", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Contact form targets query failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!prospects || prospects.length === 0) {
    return NextResponse.json({ success: true, queued: 0, message: "No new targets" });
  }

  let queued = 0;

  for (const prospect of prospects as Prospect[]) {
    try {
      const message = await draftMessage(prospect);

      // Save to contact_form_queue
      const { error: insertErr } = await db.from("contact_form_queue").insert({
        prospect_id: prospect.id,
        business_name: prospect.name,
        website: prospect.website,
        source: prospect.source,
        city: prospect.city_hint,
        drafted_message: message,
        status: "pending_send",
        queued_at: new Date().toISOString(),
      });

      if (!insertErr) {
        // Mark prospect as queued so we don't draft it again
        await db
          .from("outbound_prospects")
          .update({ contact_form_queued: true })
          .eq("id", prospect.id);

        queued++;
      }
    } catch (e) {
      console.error("Failed to queue", prospect.name, e);
    }
  }

  console.log(`Contact form targets: queued ${queued} new messages`);
  return NextResponse.json({ success: true, queued, total_found: prospects.length });
}
