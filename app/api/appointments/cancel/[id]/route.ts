// POST /api/appointments/cancel/[id]
// Cancels an appointment and notifies both Tyler and the lead.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { notifyTyler } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason: string = (body as { reason?: string }).reason || "cancelled";

  const db = getSupabase();

  const { data: appt, error } = await db
    .from("appointments")
    .update({
      cancelled: true,
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .eq("id", id)
    .select("*, lead:leads(name, phone)")
    .single();

  if (error || !appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const lead = appt.lead as { name?: string; phone?: string } | null;

  if (lead?.phone) {
    const sms = `Hi ${lead.name?.split(" ")[0] || "there"}, your inspection at ${appt.address} has been cancelled. Text us anytime to reschedule — (720) 766-1518. -Anna, Faraday`;
    await sendSMS(lead.phone, sms).catch(() => {});
  }

  await notifyTyler(
    `Appointment cancelled: ${lead?.name || "Unknown"} at ${appt.address}. Reason: ${reason}`,
    `📅 Appointment Cancelled`
  ).catch(() => {});

  return NextResponse.json({ success: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}
