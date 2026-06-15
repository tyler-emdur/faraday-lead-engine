// POST /api/appointments/confirm/[id]
// Tyler hits this link to confirm an appointment.
// Texts the lead a confirmation.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getSupabase();

  const { data: appt, error } = await db
    .from("appointments")
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, lead:leads(name, phone)")
    .single();

  if (error || !appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const lead = appt.lead as { name?: string; phone?: string } | null;
  const dateStr = appt.requested_date
    ? new Date(appt.requested_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "the date we discussed";
  const slot = appt.requested_time_slot || "anytime";

  if (lead?.phone) {
    const sms = `Hi ${lead.name?.split(" ")[0] || "there"}! Your free roof inspection is confirmed for ${dateStr} (${slot}) at ${appt.address}. Faraday will call 30 min before arrival. Reply CANCEL to reschedule. -Anna, Faraday (720) 766-1518`;
    await sendSMS(lead.phone, sms).catch(e => console.error("Confirmation SMS failed:", e));
  }

  return NextResponse.json({ success: true, appointment: appt });
}

// GET also works — Tyler can click a link from email
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}
