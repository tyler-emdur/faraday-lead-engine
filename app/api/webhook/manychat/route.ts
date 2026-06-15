// POST /api/webhook/manychat — Comment HAIL → Instant DM funnel
// When someone comments "HAIL" on a Facebook/Instagram post:
//   1. ManyChat fires this webhook with the subscriber info
//   2. Anna generates a personalized DM opener
//   3. We call ManyChat Sending API to deliver it instantly
//
// Setup in ManyChat:
//   1. Create a "Comment Reply" automation for keyword "HAIL"
//   2. Add an "External Request" action pointing to:
//      https://leads.faradaysun.com/api/webhook/manychat?secret=CRON_SECRET
//   3. Pass subscriber data in the request body (ManyChat does this automatically)
//   4. Create a Flow to send the message via ManyChat's API on our response
//
// Requires: MANYCHAT_API_KEY, CRON_SECRET
// ManyChat API docs: https://api.manychat.com/

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 30;

const ANNA_DM_SYSTEM = `You are Anna, AI assistant for Faraday Construction — Colorado's top hail damage roofing company.

Someone just commented "HAIL" on a social media post and you're sending them their very first DM.

Write a short, warm, personal DM opener that:
1. Mentions you saw their comment about hail
2. Asks if they're a homeowner in Colorado
3. Mentions free inspection (keep it casual — don't lead with a pitch)

MAX 3 sentences. No emojis overload. Sound like a human. Never say "roofing company" or "sales."

Respond with ONLY the message text — no JSON, no labels.`;

function getAIClient() {
  return new OpenAI({
    apiKey: (process.env.AI_API_KEY || "no-key").trim(),
    baseURL: (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim(),
  });
}

async function sendManyChat(subscriberId: string, message: string): Promise<boolean> {
  const apiKey = process.env.MANYCHAT_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.manychat.com/fb/sending/sendContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
            messages: [{ type: "text", text: message }],
          },
        },
        message_tag: "NON_PROMOTIONAL_SUBSCRIPTION",
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

async function saveManyChatLead(subscriber: {
  id: string;
  name: string;
  city?: string;
  platform: string;
}): Promise<void> {
  if (!process.env.SUPABASE_URL) return;

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const { saveOpportunity, opportunityExists } = await import("@/lib/intel");

    const sourceId = `manychat_${subscriber.platform}_${subscriber.id}`;
    if (await opportunityExists(sourceId)) return;

    await saveOpportunity({
      source: "community_import",
      source_id: sourceId,
      type: "community_post",
      priority: "high",
      title: `${subscriber.platform} comment "HAIL" — ${subscriber.name}`,
      body: `User commented HAIL on Faraday's ${subscriber.platform} post. Anna sent opening DM. They initiated contact — no TCPA issues.`,
      author: subscriber.name,
      location: subscriber.city || "Colorado",
      urgency_score: 75,
      opportunity_score: 75,
      why_it_matters: `${subscriber.name} actively responded to our storm content on ${subscriber.platform}. They commented HAIL — highest possible intent signal from social. They're a homeowner looking for help right now.`,
      outreach_message: `Follow up in DM if no reply within 24h. They initiated the conversation so you can follow up freely.`,
      close_probability: 40,
      follow_up_schedule: "DM follow-up in 24h, then 3 days if still no reply.",
    });

    await getSupabase().from("activity_log").insert({
      type: "social_lead",
      description: `ManyChat ${subscriber.platform} HAIL comment: ${subscriber.name}`,
      metadata: { subscriber_id: subscriber.id, platform: subscriber.platform, name: subscriber.name },
    });
  } catch (e) {
    console.error("ManyChat lead save failed:", e);
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // ManyChat sends subscriber data in various formats depending on the trigger
    const subscriberId = String(body.subscriber_id || body.id || body.user_id || "");
    const subscriberName = String(body.name || body.full_name || body.first_name || "there");
    const city = String(body.city || body.location?.city || "");
    const platform = String(body.platform || body.channel || "Instagram");
    const commentText = String(body.comment || body.text || "HAIL");

    if (!subscriberId) {
      return NextResponse.json({ error: "No subscriber_id in payload" }, { status: 400 });
    }

    // Generate Anna's DM
    const client = getAIClient();
    const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 150,
      temperature: 0.8,
      messages: [
        { role: "system", content: ANNA_DM_SYSTEM },
        {
          role: "user",
          content: `Subscriber name: ${subscriberName}${city ? `, from ${city}` : ""}. Comment: "${commentText}"`,
        },
      ],
    });

    const dmText = completion.choices[0]?.message?.content?.trim() ||
      `Hey ${subscriberName.split(" ")[0]}! I saw your comment about hail — are you a homeowner in Colorado? We do free roof inspections and insurance usually covers it. 🏠`;

    // Send the DM via ManyChat
    await sendManyChat(subscriberId, dmText);

    // Save as opportunity
    await saveManyChatLead({ id: subscriberId, name: subscriberName, city, platform });

    // Return the message back to ManyChat's External Request handler
    // (ManyChat can use the response to send messages via its own flow)
    return NextResponse.json({
      success: true,
      message: dmText,
      subscriber_id: subscriberId,
    });
  } catch (error) {
    console.error("ManyChat webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
