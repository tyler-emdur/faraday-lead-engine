import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { type OpportunityStatus } from "@/lib/intel";

const VALID_STATUSES: OpportunityStatus[] = [
  "new", "contacted", "replied", "inspection_booked", "won", "lost",
];

const STATUS_TIMESTAMP: Partial<Record<OpportunityStatus, string>> = {
  contacted: "contacted_at",
  replied: "replied_at",
  inspection_booked: "booked_at",
  won: "closed_at",
  lost: "closed_at",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status as OpportunityStatus;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  const tsField = STATUS_TIMESTAMP[status];
  if (tsField) update[tsField] = new Date().toISOString();

  if (body.lead_id) update.lead_id = body.lead_id;

  try {
    const { data, error } = await getSupabase()
      .from("opportunities")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ opportunity: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
