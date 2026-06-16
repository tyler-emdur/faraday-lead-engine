import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ contactForms: [], prospects: [] });
  }
  const db = getSupabase();

  const [{ data: contactForms }, { data: prospects }] = await Promise.all([
    db
      .from("contact_form_queue")
      .select("*")
      .order("queued_at", { ascending: false })
      .limit(100),
    db
      .from("outbound_prospects")
      .select("id,company,city,source,status,email,follow_up_count,last_contacted_at,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  return NextResponse.json({
    contactForms: contactForms || [],
    prospects: prospects || [],
  });
}

// PATCH /api/admin/outreach — update a contact_form_queue item status
export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  if (!id || !["sent", "skipped", "pending_send"].includes(status)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const db = getSupabase();
  const { error } = await db
    .from("contact_form_queue")
    .update({ status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
