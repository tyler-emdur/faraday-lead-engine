// Anna — centralized AI brain for Faraday Construction
// Single source of truth for all AI conversations across SMS, email, widget, ManyChat.
//
// Key design:
//   - All channels share the same persona/system prompt core
//   - Channel-specific tweaks (SMS = short, email = full paragraphs)
//   - Structured output for lead extraction (QUALIFIED: signal)
//   - Never blocks callers on partial failures

import OpenAI from "openai";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type AnnaChannel = "sms" | "email" | "widget" | "manychat" | "admin";

export interface ChatParams {
  channel: AnnaChannel;
  leadId?: string;
  incomingMessage: string;
  conversationHistory: ConversationMessage[];
  leadContext?: LeadContext;
}

export interface ChatResult {
  reply: string;
  leadUpdates: Partial<LeadContext>;
  shouldEscalate: boolean;
  appointmentBooked: boolean;
  leadCaptured: boolean;
}

export interface LeadContext {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  zip?: string;
  city?: string;
  hasInsurance?: boolean;
  damageVisible?: boolean;
  isHomeowner?: boolean;
  preferredTime?: string;
  source?: string;
}

export interface QualifyResult {
  score: number;
  extractedFields: LeadContext;
  summary: string;
}

export interface OutboundParams {
  segment:
    | "realtor"
    | "insurance_agent"
    | "hoa_manager"
    | "property_manager"
    | "apartment_complex"
    | "mortgage_broker"
    | "fsbo_seller";
  businessName: string;
  contactName?: string;
  city?: string;
  channel: "sms" | "email";
  touchNumber?: number; // 1 = first touch, 2 = follow-up, 3 = case study, 4 = last
}

export interface StormMessageParams {
  subscriberName: string;
  zip: string;
  city: string;
  hailSize: string;
  date: string;
}

export interface BlogPostResult {
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  keyword: string;
}

// ─── AI Client ───────────────────────────────────────────────────────────────

function getClient(): OpenAI {
  const apiKey = (process.env.AI_API_KEY || "").trim();
  const baseURL = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim();
  return new OpenAI({ apiKey: apiKey || "no-key", baseURL });
}

function getModel(): string {
  return (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();
}

async function complete(
  messages: ConversationMessage[],
  maxTokens = 400,
  temperature = 0.7
): Promise<string> {
  const client = getClient();
  try {
    const res = await client.chat.completions.create({
      model: getModel(),
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: maxTokens,
      temperature,
    });
    return res.choices[0]?.message?.content?.trim() || "";
  } catch (e) {
    console.error("Anna AI call failed:", e);
    return "";
  }
}

// ─── Core System Prompt ───────────────────────────────────────────────────────

const FARADAY_CONTEXT = `You are Anna, an AI assistant for Faraday Construction — Colorado's top hail damage roofing company based in Boulder.

FARADAY FACTS:
- Phone: (720) 766-1518
- Licensed & Insured in Colorado
- BBB A+ rated
- Average insurance claim: $9,000–$22,000 (homeowners usually pay only their deductible)
- Service area: Denver Front Range — Denver, Boulder, Aurora, Westminster, Lakewood, Arvada, Thornton, Fort Collins, Colorado Springs
- Free roof inspections (no obligation)
- We handle ALL insurance paperwork — the homeowner doesn't have to deal with it
- Most jobs take 1–2 days to complete once approved

HOW HAIL CLAIMS WORK (key knowledge):
1. Hail hits the roof — often not visible from the ground
2. Inspector documents damage with photos
3. We submit claim to homeowner's insurance
4. Insurance approves (they almost always do for hail)
5. Homeowner pays deductible only (typically $500–$2,500)
6. We replace the entire roof

YOUR PERSONA:
- Name: Anna
- Warm, conversational, never pushy
- You sound like a knowledgeable friend, not a salesperson
- You genuinely care about helping homeowners protect their biggest investment
- If asked if you're AI: "I'm an AI assistant for Faraday, but I can connect you with a real person anytime — just say the word."
- Never say "roofing company" — say "Faraday" or "we"
- Never use corporate jargon or bullet-point lists in SMS/chat

YOUR GOALS (in order):
1. Understand the homeowner's situation
2. Qualify: Are they a homeowner? Is there visible damage? Do they have homeowner's insurance?
3. Book a FREE inspection (this is your primary CTA)
4. Collect: name, phone, zip code, best time for inspection

OBJECTION HANDLING:
- "Just looking / not sure" → Mention it's free, no commitment, and insurance usually covers it
- "I already have a roofer" → Offer a free second opinion — it costs nothing and confirms they're not missing out on money
- "Too busy" → Offer to text them a link to schedule at their convenience
- "My roof looks fine" → "Hail damage is often invisible from the ground — inspectors find it with equipment. Most homeowners are surprised."
- "I'll wait" → "The longer you wait after a storm, the harder insurance companies make it. We recommend acting within 60 days."`;

function getChannelInstructions(channel: AnnaChannel): string {
  switch (channel) {
    case "sms":
      return `\n\nSMS RULES: Max 2–3 short sentences. No markdown. No bullet points. Sound like a real text. Never send walls of text. End with either a question or a clear CTA.`;
    case "email":
      return `\n\nEMAIL RULES: 3–5 sentences max. Conversational, not formal. Use a warm subject line if generating one. No "Dear [Name]" — just start with their first name. Sign off as "Anna | Faraday Construction"`;
    case "widget":
      return `\n\nWIDGET RULES: 2–4 sentences. Friendly and engaging. You're chatting on a website — be helpful, not sales-y. Ask one question at a time.`;
    case "manychat":
      return `\n\nMANYCHAT RULES: Max 3 sentences. They just commented "HAIL" on social media — high intent. Be warm and direct. Lead with a question about their home.`;
    default:
      return "";
  }
}

// ─── Signals ─────────────────────────────────────────────────────────────────

const LEAD_CAPTURE_INSTRUCTION = `
When you have collected the person's name AND phone number, output this signal on its own line at the END of your response (not visible in the reply):
LEAD_CAPTURED:{"name":"...","phone":"...","city":"...","zip":"..."}

When they agree to an inspection AND provide an address, output:
APPOINTMENT_REQUESTED:{"address":"...","preferredTime":"..."}

When a conversation is clearly high-value and needs Tyler's attention immediately (anger, urgency, large damage), output:
ESCALATE:{"reason":"...","lastMessage":"..."}

These signals are parsed programmatically — keep them on their own line, valid JSON, nothing else on that line.`;

// ─── Main Chat Function ───────────────────────────────────────────────────────

export async function chat(params: ChatParams): Promise<ChatResult> {
  const { channel, incomingMessage, conversationHistory, leadContext } = params;

  const systemPrompt = [
    FARADAY_CONTEXT,
    getChannelInstructions(channel),
    LEAD_CAPTURE_INSTRUCTION,
    leadContext
      ? `\nCURRENT LEAD CONTEXT: ${JSON.stringify(leadContext)}`
      : "",
  ].join("\n");

  const messages: ConversationMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-18), // Last 18 messages for context window
    { role: "user", content: incomingMessage },
  ];

  const raw = await complete(messages, channel === "email" ? 600 : 350);

  // Extract reply (everything before signal lines)
  const lines = raw.split("\n");
  const replyLines: string[] = [];
  let leadUpdates: Partial<LeadContext> = {};
  let shouldEscalate = false;
  let appointmentBooked = false;
  let leadCaptured = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("LEAD_CAPTURED:")) {
      try {
        const data = JSON.parse(trimmed.slice("LEAD_CAPTURED:".length));
        leadUpdates = { ...leadUpdates, ...data };
        leadCaptured = true;
      } catch { /* ignore parse errors */ }
    } else if (trimmed.startsWith("APPOINTMENT_REQUESTED:")) {
      try {
        const data = JSON.parse(trimmed.slice("APPOINTMENT_REQUESTED:".length));
        leadUpdates = { ...leadUpdates, address: data.address, preferredTime: data.preferredTime };
        appointmentBooked = true;
      } catch { /* ignore */ }
    } else if (trimmed.startsWith("ESCALATE:")) {
      shouldEscalate = true;
    } else {
      replyLines.push(line);
    }
  }

  const reply = replyLines.join("\n").trim();

  return { reply, leadUpdates, shouldEscalate, appointmentBooked, leadCaptured };
}

// ─── Lead Qualification ───────────────────────────────────────────────────────

export async function qualifyLead(conversation: ConversationMessage[]): Promise<QualifyResult> {
  const QUALIFY_SYSTEM = `You are an expert lead qualifier for a Colorado roofing company.
Analyze this conversation and extract structured data.

Return ONLY valid JSON (no backticks, no explanation):
{
  "score": 0-100,
  "extractedFields": {
    "name": string|null,
    "phone": string|null,
    "email": string|null,
    "address": string|null,
    "zip": string|null,
    "city": string|null,
    "hasInsurance": boolean|null,
    "damageVisible": boolean|null,
    "isHomeowner": boolean|null,
    "preferredTime": string|null
  },
  "summary": "one-sentence summary of where this lead is in the funnel"
}

Score 0–100 based on:
- Is homeowner: +25
- Has insurance: +20
- Damage visible: +20
- Provided address/zip: +10
- Colorado zip: +5
- Phone provided: +10
- Multiple exchanges: +5
- Agreed to inspection: +5`;

  const conversationText = conversation
    .filter(m => m.role !== "system")
    .map(m => `${m.role === "user" ? "LEAD" : "ANNA"}: ${m.content}`)
    .join("\n");

  const raw = await complete(
    [
      { role: "system", content: QUALIFY_SYSTEM },
      { role: "user", content: conversationText },
    ],
    500,
    0.1
  );

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      extractedFields: parsed.extractedFields || {},
      summary: parsed.summary || "",
    };
  } catch {
    return { score: 0, extractedFields: {}, summary: "Could not qualify" };
  }
}

// ─── Outbound Message Generator ───────────────────────────────────────────────

const SEGMENT_ANGLES: Record<string, Record<number, string>> = {
  realtor: {
    1: "Pitch: same-day roof certification to prevent deal from dying at inspection.",
    2: "Angle: a storm just hit the area — buyers are asking about roofs right now.",
    3: "Angle: share that you saved a deal last week with a same-day cert.",
    4: "Angle: last outreach — offer a one-time free cert for their next listing.",
  },
  insurance_agent: {
    1: "Pitch: be their go-to roofer for storm claims — you handle all paperwork.",
    2: "Angle: storm just hit [city] — their clients are going to be calling.",
    3: "Angle: case study — 14 claims handled last month, zero hassle for agents.",
    4: "Angle: offer to co-brand a storm checklist they can send to clients.",
  },
  hoa_manager: {
    1: "Pitch: free community-wide storm assessment with written report for the board.",
    2: "Angle: storm hit the area — their community may have unreported damage.",
    3: "Angle: board liability angle — unrepaired roofs = HOA lawsuits.",
    4: "Angle: final reach — offer a presentation for next board meeting.",
  },
  property_manager: {
    1: "Pitch: flat roof inspection with written reports for maintenance records.",
    2: "Angle: recent storm — their tenants may be calling about damage.",
    3: "Angle: documentation angle — inspections protect against tenant disputes.",
    4: "Angle: offer bulk inspection pricing for their portfolio.",
  },
  apartment_complex: {
    1: "Pitch: certified flat roof inspection with documentation for maintenance files.",
    2: "Angle: storm in the area — good time to document pre-existing condition.",
    3: "Angle: insurance company often requires periodic inspection documentation.",
    4: "Angle: final reach — multi-unit bulk inspection discount offer.",
  },
  mortgage_broker: {
    1: "Pitch: fast roof certification to clear underwriting before closing.",
    2: "Angle: storm hit recently — appraisers are flagging roofs right now.",
    3: "Angle: closed a deal last week that was about to fall through — same-day cert.",
    4: "Angle: last outreach — offer a 24-hour cert SLA for their future deals.",
  },
  fsbo_seller: {
    1: "Pitch: free cert so roof issues don't kill the deal at inspection.",
    2: "Angle: roof is the #1 thing buyers negotiate down on — get ahead of it.",
    3: "Angle: neighbor had to cut $15K off price over roof — protect your equity.",
    4: "Angle: last outreach — offer to certify before their next open house.",
  },
};

export async function generateOutboundMessage(params: OutboundParams): Promise<string> {
  const { segment, businessName, contactName, city, channel, touchNumber = 1 } = params;
  const angle = SEGMENT_ANGLES[segment]?.[touchNumber] || SEGMENT_ANGLES[segment]?.[1] || "";

  const SYSTEM = `You are Anna from Faraday Construction writing a ${channel === "sms" ? "short SMS (max 160 chars)" : "short email (3-4 sentences, no subject line)"} to a potential referral partner.

Context: ${FARADAY_CONTEXT}

${angle}

Rules:
- Sound like a real person, not a salesperson
- Do NOT use the word "roofing" or "roofing company" — just say "Faraday" or "we"
- No bullet points or markdown
- End with a soft CTA or question
- ${channel === "sms" ? "Must be under 160 characters" : "Conversational email body, 3-4 sentences max"}
- Sign as "Anna | Faraday | (720) 766-1518" for email, just "- Anna" for SMS

Respond with ONLY the message text.`;

  const context = `Business: ${businessName}${contactName ? `, contact: ${contactName}` : ""}${city ? `, city: ${city}` : ""}`;

  return await complete(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: context },
    ],
    channel === "sms" ? 80 : 250,
    0.8
  );
}

// ─── Storm Message Generator ──────────────────────────────────────────────────

export async function generateStormMessage(params: StormMessageParams): Promise<string> {
  const { subscriberName, zip, city, hailSize, date } = params;
  const firstName = subscriberName.split(" ")[0] || "there";

  const SYSTEM = `You are Anna from Faraday Construction writing an SMS storm alert to someone who opted in for hail notifications.

Rules:
- Max 160 characters
- Warm and helpful, not spammy
- Mention the hail size and city
- Offer free inspection
- Include reply instructions (YES to book)
- Sign as "-Anna, Faraday"
- TCPA: they opted in for this, so this is compliant

Respond with ONLY the SMS text.`;

  const context = `Name: ${firstName}, City: ${city}, Zip: ${zip}, Hail size: ${hailSize}, Date: ${date}`;
  const fallback = `Hey ${firstName}! Hail hit ${city} today (${hailSize}). Your area may qualify for a free roof inspection — insurance usually covers it. Reply YES to book. -Anna, Faraday`;

  const result = await complete(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: context },
    ],
    100,
    0.7
  );

  return result || fallback;
}

// ─── Follow-Up Message Generator ──────────────────────────────────────────────

export async function generateFollowUpMessage(
  lead: { name?: string; city?: string; service?: string; source?: string },
  attemptNumber: number
): Promise<string> {
  const firstName = lead.name?.split(" ")[0] || "there";
  const tones: Record<number, string> = {
    1: "Friendly first follow-up — they expressed interest but didn't respond. Light, helpful, no pressure.",
    2: "Value-add second touch — provide useful info about insurance claims or storm season. Not sales-y.",
    3: "Last chance — brief, respectful, acknowledge you'll stop reaching out if they don't respond.",
  };

  const tone = tones[Math.min(attemptNumber, 3)] || tones[3];

  const SYSTEM = `You are Anna from Faraday Construction following up via SMS with someone who inquired but didn't respond.

${tone}

Rules:
- Max 160 characters
- No guilt or pressure
- First name only
- Mention the free inspection
- Ask ONE question

Respond with ONLY the SMS text.`;

  const context = `Name: ${firstName}, City/service: ${lead.city || "Colorado"} / ${lead.service || "hail damage"}, Attempt: ${attemptNumber}`;
  const fallback = attemptNumber >= 3
    ? `Hey ${firstName}, I won't keep bugging you — just wanted to make sure you didn't miss out on a free inspection. If you ever need us, we're here. -Anna, Faraday (720) 766-1518`
    : `Hi ${firstName}! Just checking in — did you get a chance to have your roof looked at? Insurance usually covers hail damage 100%. Free inspection, no commitment. -Anna, Faraday`;

  const result = await complete(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: context },
    ],
    100,
    0.7
  );

  return result || fallback;
}

// ─── Blog Post Generator ──────────────────────────────────────────────────────

export async function generateBlogPost(keyword: string, city = "Colorado"): Promise<BlogPostResult> {
  const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const SYSTEM = `You are a professional SEO content writer for Faraday Construction — a Colorado roofing company specializing in hail damage.

Write a 1,200–1,800 word blog post targeting this keyword: "${keyword}"

STRUCTURE:
1. H1 title (compelling, keyword-rich)
2. Intro paragraph (hook with a local angle)
3. 4–6 H2 sections covering the topic thoroughly
4. Use bullet points in 1–2 sections
5. Mid-post CTA: "Was your home affected? Get a free inspection →" linking to /hail-map
6. Closing paragraph with natural CTA to call (720) 766-1518
7. No promotional fluff — genuinely helpful content

Return ONLY valid JSON (no backticks):
{
  "title": "...",
  "metaDescription": "155-160 char meta description with keyword",
  "content": "full markdown content here"
}`;

  const raw = await complete(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Keyword: "${keyword}", Primary city: ${city}` },
    ],
    3000,
    0.5
  );

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);
    return {
      title: parsed.title || `${keyword} — Faraday Construction`,
      slug,
      content: parsed.content || raw,
      metaDescription: parsed.metaDescription || `Learn about ${keyword} from Colorado's top roofing company.`,
      keyword,
    };
  } catch {
    return {
      title: `${keyword} | Faraday Construction`,
      slug,
      content: raw,
      metaDescription: `${keyword} — expert advice from Colorado's top roofing company.`,
      keyword,
    };
  }
}

// ─── Review Request Generator ─────────────────────────────────────────────────

export async function generateReviewRequest(job: {
  customerName: string;
  serviceType: string;
  city?: string;
}): Promise<string> {
  const firstName = job.customerName.split(" ")[0] || "there";
  const fallback = `Hi ${firstName}! It was great working with you on your ${job.serviceType || "roof"}. Would you mind leaving us a quick Google review? It helps other homeowners find us. https://g.page/r/FaradayConstruction/review — Thanks! -Faraday Construction`;

  const SYSTEM = `You are Anna from Faraday Construction writing a post-job review request SMS.

Rules:
- Max 160 characters
- Warm and genuine — they just had a positive experience
- Reference the job type naturally
- Include Google review link placeholder: [REVIEW_LINK]
- Don't beg — be confident
- Sign as "Faraday Construction"

Respond with ONLY the SMS text.`;

  const result = await complete(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Customer: ${firstName}, Job: ${job.serviceType || "roof work"}, City: ${job.city || "Colorado"}` },
    ],
    100,
    0.7
  );

  return result || fallback;
}

// ─── Conversation Scorer ──────────────────────────────────────────────────────

export function scoreConversation(messages: ConversationMessage[]): number {
  const text = messages.map(m => m.content).join(" ").toLowerCase();
  let score = 0;

  const signals: [RegExp, number][] = [
    [/homeowner|i own|my house|my home/, 20],
    [/insurance|claim|deductible|adjuster/, 15],
    [/damage|crack|leak|missing shingle|hail/, 15],
    [/\b\d{5}\b/, 8],                          // zip code
    [/inspection|come out|schedule|appointment/, 10],
    [/yes|interested|sounds good|let's do it/, 8],
    [/how much|cost|price|quote/, 5],
    [/storm|hail|wind|weather/, 5],
    [/asap|urgent|emergency|right away/, 12],
  ];

  for (const [pattern, points] of signals) {
    if (pattern.test(text)) score += points;
  }

  // Conversation length bonus
  const userMessages = messages.filter(m => m.role === "user").length;
  if (userMessages >= 5) score += 5;
  if (userMessages >= 3) score += 3;

  return Math.min(score, 100);
}
