// POST /api/intel/outreach/[id]
// Triggers Anna to send an outreach message for an intel opportunity.
// For storm opportunities: sends SMS blast to leads in the affected area.
// For reddit/community opportunities: logs and notifies Tyler with the outreach_message.
// Marks opportunity as "contacted" in DB.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { notifyTyler } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const authPassword = req.headers.get("x-admin-password");
  const adminPwd = process.env.ADMIN_PASSWORD || "faraday2024";
  if (authPassword !== adminPwd) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: "SUPABASE_URL not configured" }, { status: 503 });
  }

  const db = getSupabase();

  // Fetch the opportunity
  const { data: opp, error } = await db
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !opp) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  if (opp.status !== "new") {
    return NextResponse.json({ error: "Already contacted", status: opp.status }, { status: 409 });
  }

  const results: Record<string, unknown> = { opportunity_id: id, source: opp.source };
  let actioned = false;

  // ── Storm opportunities: text leads in the affected city ──────────────────
  if (opp.source === "storm" && opp.location) {
    try {
      const { sendSMS } = await import("@/lib/twilio");
      const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();

      const { data: leads } = await db
        .from("leads")
        .select("phone, name, city")
        .not("phone", "is", null)
        .ilike("city", `%${opp.location}%`)
        .neq("status", "Won")
        .gte("created_at", cutoff);

      const smsText = opp.outreach_message
        || `Hi! Hail just hit ${opp.location}. Your Faraday free inspection offer is still open — insurance usually covers it 100%. Reply YES to book. -Anna, Faraday Construction`;

      let sent = 0;
      for (const lead of (leads || [])) {
        if (!lead.phone) continue;
        const name = lead.name?.split(" ")[0] || "there";
        const personalized = smsText.replace(/^Hi!/, `Hi ${name}!`);
        await sendSMS(lead.phone, personalized).catch(() => {});
        sent++;
      }

      results.sms_sent = sent;
      actioned = sent > 0;
    } catch (e) {
      results.sms_error = String(e);
    }
  }

  // ── All opportunities: notify Tyler with the outreach message ─────────────
  if (opp.outreach_message || opp.title) {
    const msg = [
      `🎯 Intel Outreach: ${opp.title}`,
      opp.location ? `Location: ${opp.location}` : null,
      opp.outreach_message ? `\nAnna's suggested message:\n${opp.outreach_message}` : null,
      opp.url ? `\nSource: ${opp.url}` : null,
    ].filter(Boolean).join("\n");

    await notifyTyler(msg, `Intel: ${opp.title}`).catch(() => {});
    actioned = true;
  }

  // ── Mark as contacted ─────────────────────────────────────────────────────
  if (actioned) {
    await db
      .from("opportunities")
      .update({ status: "contacted", contacted_at: new Date().toISOString() })
      .eq("id", id);
    results.status = "contacted";
  }

  return NextResponse.json({ success: true, ...results });
}
