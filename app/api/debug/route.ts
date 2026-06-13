import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    model: process.env.AI_MODEL || "NOT SET",
    baseUrl: process.env.AI_BASE_URL?.replace(/\/\/.*?@/, "//***@").slice(0, 30) || "NOT SET",
    hasKey: !!process.env.AI_API_KEY,
    keyPrefix: process.env.AI_API_KEY?.slice(0, 10) || "NOT SET",
  });
}
