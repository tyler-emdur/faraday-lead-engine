import { NextResponse } from "next/server";
export async function GET() {
  const key = process.env.AI_API_KEY || "";
  const baseUrl = process.env.AI_BASE_URL || "";
  const model = process.env.AI_MODEL || "";

  // Test direct fetch to Groq
  let groqTest: string;
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    groqTest = `HTTP ${res.status}`;
  } catch (e) {
    groqTest = `FETCH ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    model,
    baseUrl: baseUrl.slice(0, 35),
    hasKey: !!key,
    keyPrefix: key.slice(0, 10),
    groqReachable: groqTest,
  });
}
