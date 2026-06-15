// POST /api/widget/chat — Anna chat API for the embeddable widget
// Partners embed <script src="https://leads.faradaysun.com/anna.js"></script>
// on their site. The widget posts messages here and Anna responds.
//
// CORS: Allow all origins so the widget works on any partner domain.
// Sessions: Tracked by a browser-generated session ID (no auth required).

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 30;

const ANNA_WIDGET_SYSTEM = `You are Anna, a friendly AI assistant for Faraday Construction — Colorado's top-rated hail damage and roofing company.

You're on a partner's website helping their visitors who may have storm damage.

MISSION: Qualify visitors as potential roof inspection leads by collecting their name, phone number, and city. Keep it short and warm.

FLOW:
1. Ask if they're a homeowner with a roof that may have been affected by recent storms
2. If yes — get their city
3. Get their first name and best phone number
4. Confirm: "We'll have an inspector call you within the hour!"

RULES:
- Max 2-3 sentences per reply
- Always be warm, helpful, human — not salesy
- If they say "no" or "not interested" → wish them a good day and offer the phone number
- Use "free inspection" and "insurance usually covers it" naturally
- Phone number to offer if they want to call directly: (720) 766-1518
- Never mention competitors

When you have name + phone + city, reply with exactly this format (nothing else):
LEAD_CAPTURED:{"name":"...","phone":"...","city":"..."}

Otherwise just reply with your conversational message.`;

function getClient() {
  return new OpenAI({
    apiKey: (process.env.AI_API_KEY || "no-key").trim(),
    baseURL: (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim(),
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders();

  try {
    const { messages, session_id, referrer } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      session_id?: string;
      referrer?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages required" }, { status: 400, headers });
    }

    const client = getClient();
    const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 200,
      temperature: 0.7,
      messages: [
        { role: "system", content: ANNA_WIDGET_SYSTEM },
        ...messages.slice(-10), // Keep last 10 messages for context
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Hey! I'm Anna with Faraday Construction. Are you a homeowner in Colorado?";

    // Check for lead capture signal
    if (reply.startsWith("LEAD_CAPTURED:")) {
      try {
        const leadData = JSON.parse(reply.replace("LEAD_CAPTURED:", "").trim());
        const confirmMsg = `Perfect${leadData.name ? `, ${leadData.name}` : ""}! Our inspector will call you at ${leadData.phone} within the hour. We're excited to help! 🏠`;

        // Save lead asynchronously
        if (process.env.SUPABASE_URL) {
          (async () => {
            try {
              const { getSupabase } = await import("@/lib/supabase");
              const { scoreLead, gradeLead } = await import("@/lib/scoring");
              const { normalizePhone } = await import("@/lib/phone");
              const { notifyTyler } = await import("@/lib/notify");

              const phone = normalizePhone(leadData.phone) || leadData.phone;
              const score = scoreLead({ phone, city: leadData.city, service: "hail_damage", homeowner: true });
              const { grade } = gradeLead(score);

              await getSupabase().from("leads").insert({
                name: leadData.name,
                phone,
                city: leadData.city,
                service: "hail_damage",
                homeowner: true,
                score,
                grade,
                source: "widget",
                source_detail: referrer || session_id || "anna_widget",
                status: "New",
              });

              await notifyTyler(
                `🔥 WIDGET LEAD — $100\n${leadData.name} | ${phone}\n${leadData.city} | Hail Damage\nFrom: ${referrer || "partner site"}\n→ Call within 1 hour`,
                `🔥 Widget Lead — ${leadData.name}`
              );
            } catch {}
          })();
        }

        return NextResponse.json({ reply: confirmMsg, lead_captured: true }, { headers });
      } catch {
        // Fall through to normal reply
      }
    }

    return NextResponse.json({ reply }, { headers });
  } catch (error) {
    console.error("Widget chat error:", error);
    return NextResponse.json(
      { reply: "Hey! I'm Anna with Faraday Construction. Having trouble connecting — call us directly at (720) 766-1518 for a free inspection!" },
      { status: 200, headers }
    );
  }
}
