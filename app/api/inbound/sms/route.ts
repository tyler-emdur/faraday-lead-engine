// POST /api/inbound/sms — Twilio SMS webhook
// Anna handles all inbound texts with full conversation memory.
//
// Twilio webhook: https://leads.faradaysun.com/api/inbound/sms (POST)
// Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/twilio";
import { notifyTyler } from "@/lib/notify";
import { normalizePhone } from "@/lib/phone";
import { chat } from "@/lib/anna";
import type { ConversationMessage } from "@/lib/anna";

export const maxDuration = 30;

// ── Database helpers ──────────────────────────────────────────────────────────

async function getOrCreateLead(phone: string): Promise<{ id: string; name?: string; city?: string; opted_out?: boolean } | null> {
  if (!process.env.SUPABASE_URL) return null;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();

    const { data: existing } = await db
      .from("leads")
      .select("id, name, city, opted_out")
      .eq("phone", phone)
      .maybeSingle();

    if (existing) return existing;

    const { data: created } = await db
      .from("leads")
      .insert({ phone, source: "sms_inbound", status: "new" })
      .select("id, name, city, opted_out")
      .single();

    return created;
  } catch (e) {
    console.error("getOrCreateLead failed:", e);
    return null;
  }
}

async function loadHistory(leadId: string): Promise<ConversationMessage[]> {
  if (!process.env.SUPABASE_URL) return [];
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const { data } = await getSupabase()
      .from("conversations")
      .select("role, content")
      .eq("lead_id", leadId)
      .eq("channel", "sms")
      .order("created_at", { ascending: true })
      .limit(20);

    return (data || []).map(r => ({ role: r.role as "user" | "assistant", content: r.content }));
  } catch {
    return [];
  }
}

async function saveMessage(leadId: string, role: "user" | "assistant", content: string, externalId?: string): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    await getSupabase().from("conversations").insert({
      lead_id: leadId,
      channel: "sms",
      role,
      content,
      external_id: externalId || null,
    });
  } catch {}
}

async function updateLead(leadId: string, updates: Record<string, unknown>): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    await getSupabase().from("leads").update(updates).eq("id", leadId);
  } catch {}
}

async function setOptOut(phone: string, optedOut: boolean): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();
    await Promise.all([
      db.from("leads").update({ opted_out: optedOut, opted_out_at: new Date().toISOString() }).eq("phone", phone),
      optedOut
        ? db.from("storm_subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("phone", phone)
        : db.from("storm_subscribers").update({ status: "active" }).eq("phone", phone),
    ]);
  } catch {}
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const fromRaw = params.get("From") || "";
    const bodyRaw = (params.get("Body") || "").trim();
    const messageSid = params.get("MessageSid") || undefined;

    if (!fromRaw || !bodyRaw) return new NextResponse("", { status: 200 });

    const phone = normalizePhone(fromRaw) || fromRaw;
    const msgLower = bodyRaw.toLowerCase().trim();

    // ── STOP / UNSUBSCRIBE ────────────────────────────────────────────────────
    if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit"].includes(msgLower)) {
      await setOptOut(phone, true);
      await sendSMS(phone, "You've been unsubscribed. Reply START to resubscribe. -Faraday").catch(() => {});
      return new NextResponse("", { status: 200 });
    }

    // ── START / resubscribe ───────────────────────────────────────────────────
    if (msgLower === "start") {
      await setOptOut(phone, false);
      await sendSMS(phone, "You're back on the list! We'll reach out next time hail hits your area. -Anna, Faraday").catch(() => {});
      return new NextResponse("", { status: 200 });
    }

    // ── Get or create lead ────────────────────────────────────────────────────
    const lead = await getOrCreateLead(phone);

    // Check opted out
    if (lead?.opted_out) return new NextResponse("", { status: 200 });

    // Save incoming message
    if (lead) await saveMessage(lead.id, "user", bodyRaw, messageSid);

    // ── Load conversation history ──────────────────────────────────────────────
    const history: ConversationMessage[] = lead ? await loadHistory(lead.id) : [];

    // ── Call Anna ─────────────────────────────────────────────────────────────
    const result = await chat({
      channel: "sms",
      leadId: lead?.id,
      incomingMessage: bodyRaw,
      conversationHistory: history.slice(0, -1), // Anna gets history BEFORE the current message
      leadContext: lead
        ? { name: lead.name || undefined, city: lead.city || undefined, phone }
        : { phone },
    });

    // ── Save Anna's reply ─────────────────────────────────────────────────────
    if (result.reply && lead) await saveMessage(lead.id, "assistant", result.reply);

    // ── Update lead with extracted data ───────────────────────────────────────
    if (lead && Object.keys(result.leadUpdates).length > 0) {
      const updates: Record<string, unknown> = {};
      if (result.leadUpdates.name) updates.name = result.leadUpdates.name;
      if (result.leadUpdates.city) updates.city = result.leadUpdates.city;
      if (result.leadUpdates.zip) updates.zip = result.leadUpdates.zip;
      if (result.leadUpdates.address) updates.address = result.leadUpdates.address;
      if (result.leadUpdates.isHomeowner !== undefined) updates.homeowner = result.leadUpdates.isHomeowner;
      if (result.leadUpdates.hasInsurance !== undefined) updates.has_insurance = result.leadUpdates.hasInsurance;
      if (result.leadUpdates.damageVisible !== undefined) updates.damage_visible = result.leadUpdates.damageVisible;
      if (result.leadCaptured) {
        updates.status = "contacted";
        updates.team_notified = true;
      }
      await updateLead(lead.id, updates);
    }

    // ── Appointment booking ───────────────────────────────────────────────────
    if (result.appointmentBooked && lead && result.leadUpdates.address) {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/appointments/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          address: result.leadUpdates.address,
          timeSlot: result.leadUpdates.preferredTime || "anytime",
        }),
      }).catch(() => {});
    }

    // ── Escalate to Tyler ─────────────────────────────────────────────────────
    if (result.shouldEscalate && lead) {
      const name = result.leadUpdates.name || lead.name || "Unknown";
      await notifyTyler(
        `🚨 Hot lead needs you: ${name} | ${phone}\n"${bodyRaw}"`,
        `🚨 Escalated Lead — ${name}`
      ).catch(() => {});
    }

    // ── Notify Tyler on first lead capture ────────────────────────────────────
    if (result.leadCaptured) {
      const name = result.leadUpdates.name || "Unknown";
      const city = result.leadUpdates.city || "Colorado";
      await notifyTyler(
        `🔥 SMS LEAD — $100 opportunity\n${name} | ${phone}\n${city} | Hail Damage\n→ Call them NOW`,
        `🔥 New SMS Lead — ${name}`
      ).catch(() => {});
    }

    // ── Send SMS reply ────────────────────────────────────────────────────────
    if (result.reply) {
      await sendSMS(phone, result.reply).catch(e =>
        console.error("SMS send failed:", e)
      );
    }

    return new NextResponse("", { status: 200 });
  } catch (error) {
    console.error("Inbound SMS handler error:", error);
    return new NextResponse("", { status: 200 }); // Always 200 to Twilio
  }
}
