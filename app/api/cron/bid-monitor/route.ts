// CRON: Municipal & Government Bid Monitor — runs daily at 7am MT
// Watches Colorado procurement portals for roofing RFPs.
// When a match is found, Groq analyzes the listing and pre-drafts a bid proposal.
// Tyler receives a complete draft by email so he only has to review and submit.
//
// Sources:
//   1. Colorado OSPB (bids.colorado.gov) — state agency bids
//   2. Denver city solicitations — city/county bids
//   3. Jefferson County bids
//
// No API key required — all public data.
// One municipal win = $50k–$500k.

import { NextRequest, NextResponse } from "next/server";
import { notifyTyler } from "@/lib/notify";
import { saveOpportunity, opportunityExists } from "@/lib/intel";
import { sendEmail } from "@/lib/resend";

export const maxDuration = 60;

interface BidOpportunity {
  id: string;
  title: string;
  description: string;
  agency: string;
  url: string;
  closing_date?: string;
  value_estimate?: number;
}

const ROOFING_KEYWORDS = [
  "roof", "roofing", "re-roof", "reroof", "hail damage", "storm damage",
  "building envelope", "flat roof", "membrane roof", "facilities maintenance",
  "exterior renovation", "shingle", "skylight", "gutter", "flashing",
];

function matchesBid(text: string): boolean {
  const lower = text.toLowerCase();
  return ROOFING_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Source 1: Colorado state bids ────────────────────────────────────────────

async function fetchColoradoStateBids(): Promise<BidOpportunity[]> {
  try {
    const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const params = new URLSearchParams({
      "$where": `date_issued >= '${since}'`,
      "$limit": "50",
      "$order": "date_issued DESC",
    });
    const res = await fetch(`https://data.colorado.gov/resource/state-bids.json?${params}`, {
      headers: { "User-Agent": "FaradayLeadBot/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json() as Record<string, string>[];
    return data
      .filter(b => matchesBid(`${b.title || ""} ${b.description || ""}`))
      .map(b => ({
        id: `co_ospb_${b.bid_number || b.id || Math.random().toString(36).slice(2)}`,
        title: b.title || b.solicitation_title || "Colorado State Bid",
        description: b.description || b.scope_of_work || "",
        agency: b.agency || b.department || "Colorado State Agency",
        url: b.url || b.link || "https://bids.colorado.gov",
        closing_date: b.closing_date || b.due_date,
      }));
  } catch { return []; }
}

// ── Source 2: Denver city bids ────────────────────────────────────────────────

async function fetchDenverCityBids(): Promise<BidOpportunity[]> {
  try {
    const res = await fetch(
      "https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Financial-Management/Purchasing/Solicitations",
      { headers: { "User-Agent": "FaradayLeadBot/1.0" }, next: { revalidate: 0 } }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const bids: BidOpportunity[] = [];
    const bidMatches = html.matchAll(/IFB|RFP|RFQ[\s-]*([A-Z0-9-]+)[^<]*<[^>]+>([^<]{10,})</g);
    let i = 0;
    for (const match of bidMatches) {
      const description = match[2]?.trim() || "";
      if (!matchesBid(description)) continue;
      bids.push({
        id: `denver_bid_${match[1] || i++}`,
        title: description.slice(0, 120),
        description,
        agency: "City and County of Denver",
        url: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Financial-Management/Purchasing/Solicitations",
      });
      if (bids.length >= 5) break;
    }
    return bids;
  } catch { return []; }
}

// ── Source 3: Jefferson County ────────────────────────────────────────────────

async function fetchJeffcoBids(): Promise<BidOpportunity[]> {
  try {
    const res = await fetch("https://www.jeffco.us/bids.aspx", {
      headers: { "User-Agent": "FaradayLeadBot/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const bids: BidOpportunity[] = [];
    const matches = html.matchAll(/<a[^>]+href="([^"]*bid[^"]*)"[^>]*>([^<]{10,})<\/a>/gi);
    for (const match of matches) {
      const title = match[2]?.trim() || "";
      if (!matchesBid(title)) continue;
      bids.push({
        id: `jeffco_${Buffer.from(title).toString("base64").slice(0, 20)}`,
        title,
        description: title,
        agency: "Jefferson County, CO",
        url: match[1]?.startsWith("http") ? match[1] : `https://www.jeffco.us${match[1]}`,
      });
      if (bids.length >= 5) break;
    }
    return bids;
  } catch { return []; }
}

// ── Source 4: Colorado eProcurement (COFRS) ──────────────────────────────────

async function fetchCOProcurement(): Promise<BidOpportunity[]> {
  try {
    const res = await fetch(
      "https://www.colorado.gov/pacific/osc/bids-rfps",
      { headers: { "User-Agent": "FaradayLeadBot/1.0" }, next: { revalidate: 0 } }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const bids: BidOpportunity[] = [];
    // Look for RFP/IFB/RFQ links with descriptions
    const matches = html.matchAll(/href="([^"]*(?:rfp|bid|solicitation|procurement)[^"]*)"[^>]*>([^<]{10,})<\/a>/gi);
    for (const match of matches) {
      const title = match[2]?.trim() || "";
      if (!matchesBid(title)) continue;
      bids.push({
        id: `co_proc_${Buffer.from(title).toString("base64").slice(0, 20)}`,
        title,
        description: title,
        agency: "Colorado State Procurement",
        url: match[1]?.startsWith("http") ? match[1] : `https://www.colorado.gov${match[1]}`,
      });
      if (bids.length >= 5) break;
    }
    return bids;
  } catch { return []; }
}

// ── AI bid proposal drafting ─────────────────────────────────────────────────

async function draftBidProposal(bid: BidOpportunity): Promise<string | null> {
  if (!process.env.AI_API_KEY) return null;

  const prompt = `You are helping draft a bid proposal for Faraday Construction, a licensed Colorado roofing and construction company.

Bid details:
Agency: ${bid.agency}
Title: ${bid.title}
Description: ${bid.description.slice(0, 600)}
Closing date: ${bid.closing_date || "not specified"}
Source URL: ${bid.url}

Draft a complete, professional bid proposal document that Tyler can review and submit. Include:
1. Cover letter (to the agency)
2. Company qualifications summary
3. Proposed scope of work (based on bid requirements)
4. Why Faraday is the best choice (BBB A+, local CO contractor, insurance claim expertise, hail damage specialists)
5. Pricing approach (we'll provide a competitive bid after inspection — don't make up numbers)
6. References note (available upon request)
7. Contact info: Tyler Emdur, Faraday Construction, (720) 766-1518, tyler@faradayconstruction.com

Keep it professional and under 600 words. Format as plain text with clear section headers.`;

  try {
    const res = await fetch(
      `${(process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim()}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(process.env.AI_API_KEY || "").trim()}`,
        },
        body: JSON.stringify({
          model: (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim(),
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          temperature: 0.4,
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

function bidEmailHtml(bid: BidOpportunity, proposal: string): string {
  const isUrgent = bid.closing_date && new Date(bid.closing_date).getTime() - Date.now() < 14 * 86400000;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:660px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#1a1a1a;padding:18px 24px;border-radius:10px 10px 0 0;">
    <h1 style="color:#f59e0b;margin:0;font-size:18px;font-weight:900;">🏛 GOV'T BID OPPORTUNITY</h1>
    <p style="color:#9ca3af;margin:4px 0 0;font-size:13px;">${bid.agency}</p>
  </div>
  ${isUrgent ? `<div style="background:#7f1d1d;padding:12px 24px;"><p style="color:#fca5a5;margin:0;font-size:14px;font-weight:700;">⏰ URGENT — Closes ${bid.closing_date}. Submit ASAP.</p></div>` : ""}
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:24px;">
    <h2 style="font-size:16px;font-weight:700;margin:0 0 4px;">${bid.title}</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">${bid.agency}${bid.closing_date ? ` · Closes ${bid.closing_date}` : ""}</p>
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">${bid.description.slice(0, 300)}</p>
    <a href="${bid.url}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;margin-bottom:24px;">View Full Bid →</a>

    <h2 style="font-size:15px;font-weight:700;margin:0 0 8px;border-top:1px solid #e5e7eb;padding-top:16px;">Anna's Draft Proposal</h2>
    <p style="font-size:12px;color:#9ca3af;margin:0 0 12px;">Review, customize pricing/numbers, then submit to the agency.</p>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:16px;">
      <pre style="font-family:inherit;font-size:13px;color:#374151;white-space:pre-wrap;margin:0;line-height:1.7;">${proposal}</pre>
    </div>
  </div>
</div>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { checked: 0, matched: 0, saved: 0, proposals_drafted: 0, emails_sent: 0 };
  const urgentBids: string[] = [];

  const [stateBids, denverBids, jeffcoBids, coProcBids] = await Promise.all([
    fetchColoradoStateBids(),
    fetchDenverCityBids(),
    fetchJeffcoBids(),
    fetchCOProcurement(),
  ]);

  const allBids = [...stateBids, ...denverBids, ...jeffcoBids, ...coProcBids];
  results.checked = allBids.length;

  for (const bid of allBids) {
    results.matched++;
    if (await opportunityExists(bid.id)) continue;

    const hasClosingDate = !!bid.closing_date;
    const isUrgent = hasClosingDate && new Date(bid.closing_date!).getTime() - Date.now() < 14 * 86400000;

    // Draft AI proposal for every match
    const proposal = await draftBidProposal(bid);
    if (proposal) results.proposals_drafted++;

    // Email Tyler the full draft if Resend is configured
    const tylerEmail = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;
    if (proposal && tylerEmail && process.env.RESEND_API_KEY) {
      const sent = await sendEmail(
        tylerEmail,
        `🏛 ${isUrgent ? "URGENT " : ""}Gov't Bid: ${bid.title.slice(0, 80)} — Draft Ready`,
        bidEmailHtml(bid, proposal)
      ).catch(() => false);
      if (sent) results.emails_sent++;
    }

    const opp = await saveOpportunity({
      source: "property_scan",
      source_id: bid.id,
      type: "property_target",
      priority: isUrgent ? "high" : "medium",
      title: `Gov't Bid: ${bid.title.slice(0, 100)}`,
      body: `${bid.agency}\n${bid.description.slice(0, 400)}${bid.closing_date ? `\nCloses: ${bid.closing_date}` : ""}`,
      url: bid.url,
      location: bid.agency,
      urgency_score: isUrgent ? 85 : 60,
      opportunity_score: isUrgent ? 85 : 60,
      why_it_matters: `Government roofing RFP from ${bid.agency}. Municipal contracts are $50k–$500k and create recurring vendor relationships. Anna has drafted a full proposal — Tyler just needs to review and submit.`,
      outreach_message: proposal
        ? `Draft proposal ready — see email. Submit to ${bid.agency} by ${bid.closing_date || "ASAP"}.`
        : `Submit a bid to ${bid.agency} for: ${bid.title.slice(0, 80)}`,
      close_probability: 20,
      follow_up_schedule: `Submit by ${bid.closing_date || "closing date"}. Follow up with agency 3 days before deadline.`,
    });

    if (opp) {
      results.saved++;
      if (isUrgent) urgentBids.push(`${bid.agency}: ${bid.title.slice(0, 60)}`);
    }
  }

  if (urgentBids.length > 0 || results.proposals_drafted > 0) {
    const msg = [
      urgentBids.length > 0 ? `🏛 ${urgentBids.length} URGENT GOV'T BID${urgentBids.length > 1 ? "S" : ""}` : `🏛 ${results.proposals_drafted} gov't bid draft${results.proposals_drafted > 1 ? "s" : ""} ready`,
      ...urgentBids.slice(0, 2).map(b => `• ${b}`),
      results.emails_sent > 0 ? `Proposals emailed to you — review and submit` : `→ Check /intel for details`,
    ].join("\n");
    await notifyTyler(msg, `🏛 Gov't Bid${urgentBids.length > 0 ? " — URGENT" : ""}`).catch(() => {});
  }

  console.log(`Bid monitor: ${results.checked} checked, ${results.matched} matched, ${results.proposals_drafted} drafted, ${results.emails_sent} emailed`);
  return NextResponse.json({ success: true, ...results });
}
