import { NextResponse } from "next/server";
export async function GET() {
  const key = (process.env.AI_API_KEY || "").trim();
  const baseUrl = (process.env.AI_BASE_URL || "").trim();
  const model = (process.env.AI_MODEL || "").trim();

  // Test 1: fetch /models
  let modelsTest: string;
  try {
    const res = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` } });
    modelsTest = `HTTP ${res.status}`;
  } catch (e) {
    modelsTest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 2: fetch /chat/completions directly (same as what OpenAI SDK does)
  let chatTest: string;
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 50, messages: [{ role: "user", content: "Say hi" }] }),
    });
    const body = await res.json();
    chatTest = `HTTP ${res.status} — content: ${body.choices?.[0]?.message?.content?.slice(0, 40) ?? JSON.stringify(body).slice(0, 60)}`;
  } catch (e) {
    chatTest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 3: OpenAI SDK
  let sdkTest: string;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: key, baseURL: baseUrl });
    const c = await client.chat.completions.create({
      model, max_tokens: 50,
      messages: [{ role: "user", content: "Say hi" }],
    });
    sdkTest = `OK — ${c.choices[0]?.message?.content?.slice(0, 40)}`;
  } catch (e) {
    sdkTest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({ model, baseUrl, hasKey: !!key, modelsTest, chatTest, sdkTest });
}
