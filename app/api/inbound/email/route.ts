import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { notifyTyler } from "@/lib/notify";
import OpenAI from "openai";

function extractPhone(text: string): string | null {
  const match = text.match(/(\+?1?\s*[-.]?\s*\(?\d{3}\)?[\s.–-]?\d{3}[\s.–-]?\d{4})/);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

// Resend webhooks only include email metadata — the body has to be fetched separately.
async function fetchReceivedEmailText(emailId: string): Promise<string> {
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok) {
      console.error("Failed to fetch received email body:", res.status, await res.text());
      return "";
    }
    const data = await res.json();
    return data.text || data.html || "";
  } catch (e) {
    console.error("Error fetching received email body:", e);
    return "";
  }
}

export const maxDuration = 60;

function getClient() {
  return new OpenAI({
    apiKey: (process.env.AI_API_KEY || "no-key").trim(),
    baseURL: (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim(),
  });
}

const INBOUND_SYSTEM = `You are Anna, a friendly, professional outreach specialist for Faraday Construction in Colorado.
You previously reached out to this property manager/homeowner about getting a free roof inspection due to recent hail storms. They have just replied to you.

YOUR GOAL:
Answer their questions and confidently steer the conversation toward booking a free inspection.
If they say no, politely thank them and end the conversation.
If they say yes, ask for the best phone number so your inspector can coordinate a time.

RULES:
- Keep your replies under 4 sentences.
- Be extremely casual but professional. NO marketing speak.
- Make it sound like a quick note typed out by a human on their phone.
- Never use formatting, bolding, or markdown. Just plain text.

Respond ONLY with a JSON object containing 'body'.
Example:
{"body": "That makes total sense. We can swing by Tuesday to take a quick look, completely free. What's the best cell number for the inspector to reach you at?"}`;

// Webhook payload from Resend
interface ResendWebhook {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload: ResendWebhook = await req.json();

    // Handle bounce events — mark prospect do_not_contact automatically
    if (payload.type === "email.bounced") {
      const bouncedEmail = Array.isArray(payload.data.to) ? payload.data.to[0] : payload.data.to;
      if (bouncedEmail) {
        const db = getSupabase();
        await db.from("outbound_prospects")
          .update({ status: "do_not_contact" })
          .eq("email", bouncedEmail);
        console.log(`Bounce webhook: marked ${bouncedEmail} as do_not_contact`);
      }
      return NextResponse.json({ success: true });
    }

    // Verify it's an email received event
    if (payload.type !== "email.received") {
      return NextResponse.json({ success: true });
    }

    const senderEmail = payload.data.from;
    const incomingText = await fetchReceivedEmailText(payload.data.email_id);

    const db = getSupabase();

    // 1. Find the prospect
    const { data: prospect } = await db
      .from("outbound_prospects")
      .select("*")
      .eq("email", senderEmail)
      .single();

    if (!prospect) {
      // No matching outreach record — still capture the lead if they gave us a phone number
      const unmatchedPhone = extractPhone(incomingText);
      if (unmatchedPhone) {
        const { error: insertErr } = await db.from("leads").insert({
          name: senderEmail.split("@")[0] || "Unknown",
          phone: unmatchedPhone,
          email: senderEmail,
          source: "inbound_email_unmatched",
          service: "roofing",
          status: "new",
          notes: `Inbound email reply with no matching outbound record. Subject: ${payload.data.subject}\n${incomingText.slice(0, 500)}`,
        });
        if (insertErr) console.error("Failed to save unmatched inbound lead:", insertErr.message);

        await notifyTyler(
          `📞 LEAD FROM EMAIL REPLY (unmatched sender)\nEmail: ${senderEmail}\nPhone: ${unmatchedPhone}\nSubject: ${payload.data.subject}`,
          "New Lead — Email Reply"
        );

        return NextResponse.json({ success: true, lead_captured: true, phone: unmatchedPhone });
      }

      console.log(`Received email from unknown sender: ${senderEmail}`);
      return NextResponse.json({ success: true }); // Acknowledge to Resend
    }

    // 2. Save incoming message to thread history
    await db.from("email_threads").insert({
      prospect_id: prospect.id,
      thread_id: prospect.thread_id,
      role: "user",
      content: incomingText,
      subject: payload.data.subject
    });

    // 3. Update prospect status
    await db.from("outbound_prospects").update({
      status: "replied",
      updated_at: new Date().toISOString()
    }).eq("id", prospect.id);

    // 3b. Check if the reply contains a phone number — if so, save the lead and stop
    const phone = extractPhone(incomingText);
    if (phone) {
      const { error: insertErr } = await db.from("leads").insert({
        name: prospect.name || prospect.company || "Unknown",
        phone,
        email: prospect.email,
        city: prospect.city || null,
        source: "outbound_email",
        service: "roofing",
        status: "new",
        notes: `B2B referral reply from ${prospect.company || prospect.email}. Original message:\n${incomingText.slice(0, 500)}`,
      });
      if (insertErr) console.error("Failed to save outbound-reply lead:", insertErr.message);

      await db.from("outbound_prospects").update({
        status: "won",
        updated_at: new Date().toISOString()
      }).eq("id", prospect.id);

      await notifyTyler(
        `📞 LEAD FROM EMAIL REPLY\nName: ${prospect.name || prospect.company}\nPhone: ${phone}\nEmail: ${prospect.email}\nCity: ${prospect.city || "unknown"}\nSource: B2B cold email reply`,
        "New Lead — Email Reply"
      );

      return NextResponse.json({ success: true, lead_captured: true, phone });
    }

    // 4. Fetch conversation history for context
    const { data: history } = await db
      .from("email_threads")
      .select("role, content")
      .eq("thread_id", prospect.thread_id)
      .order("created_at", { ascending: true })
      .limit(10);

    const messages = [
      { role: "system", content: INBOUND_SYSTEM },
      ...(history || []).map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content }))
    ];

    // 5. Generate AI reply
    const client = getClient();
    const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();
    
    const completion = await client.chat.completions.create({
      model,
      max_tokens: 300,
      temperature: 0.7,
      messages: messages as any
    });

    const text = completion.choices[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    
    let replyContent;
    try {
      replyContent = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Invalid JSON from AI");
      replyContent = JSON.parse(match[0]);
    }

    // 6. Send the reply email back
    await sendEmail(
      prospect.email,
      `Re: ${payload.data.subject.replace(/Re:\s*/i, '')}`,
      `<div style="font-family: sans-serif; font-size: 14px; white-space: pre-wrap;">${replyContent.body}</div>`
    );

    // 7. Save the assistant's reply to the thread history
    await db.from("email_threads").insert({
      prospect_id: prospect.id,
      thread_id: prospect.thread_id,
      role: "assistant",
      content: replyContent.body,
      subject: `Re: ${payload.data.subject.replace(/Re:\s*/i, '')}`
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Inbound email webhook failed:", error);
    return NextResponse.json({ error: "Failed to process email" }, { status: 500 });
  }
}
