// POST /api/leads/[id]/send-message
// Tyler sends a manual message as Anna via admin dashboard.
// Saves to conversations table + sends SMS if lead has a phone number.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const db = getSupabase();

  const { data: lead } = await db
    .from("leads")
    .select("phone, opted_out")
    .eq("id", id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Save to conversations
  await db.from("conversations").insert({
    lead_id: id,
    channel: "admin",
    role: "assistant",
    content: message.trim(),
  });

  // Send SMS if phone available and not opted out
  let smsSent = false;
  if (lead.phone && !lead.opted_out) {
    try {
      await sendSMS(lead.phone, message.trim());
      smsSent = true;
    } catch (e) {
      console.error("Manual SMS send failed:", e);
    }
  }

  return NextResponse.json({ success: true, smsSent });
}
