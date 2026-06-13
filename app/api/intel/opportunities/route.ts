import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { type OpportunityPriority, type OpportunityStatus } from "@/lib/intel";

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = req.nextUrl;
  const priority = searchParams.get("priority") as OpportunityPriority | null;
  const status = searchParams.get("status") as OpportunityStatus | null;
  const since = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

  try {
    let query = getSupabase()
      .from("opportunities")
      .select("*")
      .order("opportunity_score", { ascending: false })
      .limit(limit);

    if (priority) query = query.eq("priority", priority);
    if (status) query = query.eq("status", status);
    if (since) query = query.gte("created_at", since);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ opportunities: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
