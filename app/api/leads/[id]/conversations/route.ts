import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ conversations: [] });
  }
  const { data } = await getSupabase()
    .from("conversations")
    .select("id, role, content, channel, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true })
    .limit(100);
  return NextResponse.json({ conversations: data || [] });
}
