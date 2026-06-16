// POST /api/subscribe/storm-alerts — Storm alert opt-in
// Used by the /storm-alerts landing page to collect subscribers.
// When hail hits their area, the storm-check cron texts them automatically.
// This is 100% TCPA compliant — they opted in.

import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { sendSMS } from "@/lib/twilio";
import { notifyTyler } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, city, zip } = await req.json();

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: "Valid phone number required" }, { status: 400 });
    }

    // Save to storm_subscribers table (best-effort — the underlying table/RPC may not exist
    // in every environment; the leads table below is the source of truth for capture)
    if (process.env.SUPABASE_URL) {
      const { getSupabase } = await import("@/lib/supabase");
      const { error: rpcError } = await getSupabase().rpc("add_storm_subscriber", {
        p_phone: normalizedPhone,
        p_name: name || null,
        p_email: email || null,
        p_city: city || null,
        p_zip: zip || null,
        p_source: "web_optin",
      });
      if (rpcError) console.error("add_storm_subscriber RPC failed:", rpcError.message);

      // Always also capture as a lead so this never depends on storm_subscribers existing
      try {
        const db = getSupabase();
        const { data: existing } = await db.from("leads").select("id").eq("phone", normalizedPhone).maybeSingle();
        if (!existing) {
          await db.from("leads").insert({
            name: name || null,
            phone: normalizedPhone,
            email: email || null,
            city: city || null,
            zip: zip || null,
            source: "storm-alerts",
            service: "hail_damage",
            status: "new",
            notes: "Opted in to free hail alert SMS signups.",
          });
        }
      } catch (e) {
        console.error("Failed to save storm-alerts lead:", e);
      }
    }

    // Notify Tyler immediately — this is a captured lead regardless of subscriber-table state
    await notifyTyler(
      `⚡ Storm Alert Signup — $100 opportunity\n${name || "Unknown"} | ${normalizedPhone}\n${city || "Unknown city"} | wants hail alerts`,
      `⚡ Storm Alert Signup — ${name || normalizedPhone}`
    ).catch(e => console.error("Tyler notification failed:", e));

    // Send opt-in confirmation SMS
    if (process.env.TWILIO_ACCOUNT_SID) {
      const firstName = (name || "there").split(" ")[0];
      const cityNote = city ? ` for ${city}` : " for your area";
      await sendSMS(
        normalizedPhone,
        `Hi ${firstName}! You're signed up for Faraday hail alerts${cityNote}. When hail hits, I'll text you immediately. Text STOP anytime to unsubscribe. – Anna, Faraday Construction`
      ).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Storm subscribe error:", error);
    return NextResponse.json({ error: "Subscription failed" }, { status: 500 });
  }
}
