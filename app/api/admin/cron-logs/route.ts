import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ logs: [] });
  }
  const { data } = await getSupabase()
    .from("cron_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(200);
  return NextResponse.json({ logs: data || [] });
}
