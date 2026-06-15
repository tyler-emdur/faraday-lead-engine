// POST /api/subscribe/storm-alerts — Storm alert opt-in
// Used by the /storm-alerts landing page to collect subscribers.
// When hail hits their area, the storm-check cron texts them automatically.
// This is 100% TCPA compliant — they opted in.

import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { sendSMS } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, city, zip } = await req.json();

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: "Valid phone number required" }, { status: 400 });
    }

    // Save to storm_subscribers table
    if (process.env.SUPABASE_URL) {
      const { getSupabase } = await import("@/lib/supabase");
      await getSupabase().rpc("add_storm_subscriber", {
        p_phone: normalizedPhone,
        p_name: name || null,
        p_email: email || null,
        p_city: city || null,
        p_zip: zip || null,
        p_source: "web_optin",
      });
    }

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
