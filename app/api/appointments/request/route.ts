// POST /api/appointments/request
// Called by Anna when a lead agrees to an inspection.
// Creates an appointment record and notifies Tyler.
//
// Body: { leadId, preferredDate?, timeSlot?, address }

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { notifyTyler } from "@/lib/notify";
import { sendSMS } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, preferredDate, timeSlot, address } = body;

    if (!leadId || !address) {
      return NextResponse.json({ error: "leadId and address are required" }, { status: 400 });
    }

    const db = getSupabase();

    // Fetch lead info
    const { data: lead } = await db
      .from("leads")
      .select("id, name, phone, city, zip")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Create appointment
    const { data: appt, error } = await db
      .from("appointments")
      .insert({
        lead_id: leadId,
        requested_date: preferredDate || null,
        requested_time_slot: timeSlot || "anytime",
        address,
        confirmed: false,
        cancelled: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Appointment insert failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Link appointment to lead
    await db.from("leads").update({
      appointment_id: appt.id,
      status: "appointment_set",
    }).eq("id", leadId);

    // Notify Tyler
    const dateStr = preferredDate ? new Date(preferredDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "TBD";
    const slot = timeSlot || "anytime";
    const notifyMsg = [
      `📅 New inspection request`,
      `${lead.name || "Unknown"} — ${lead.phone || "no phone"}`,
      `${address}`,
      `Preferred: ${dateStr} ${slot}`,
      `Confirm: ${process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com"}/admin`,
    ].join("\n");

    await notifyTyler(notifyMsg, `📅 Inspection Request — ${lead.name || "New Lead"}`).catch(() => {});

    return NextResponse.json({ success: true, appointmentId: appt.id });
  } catch (e) {
    console.error("Appointment request error:", e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
