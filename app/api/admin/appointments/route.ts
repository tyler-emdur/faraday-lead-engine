import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ appointments: [] });
  }
  const { data } = await getSupabase()
    .from("appointments")
    .select("*, lead:leads(id, name, phone, city, zip)")
    .eq("cancelled", false)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ appointments: data || [] });
}
