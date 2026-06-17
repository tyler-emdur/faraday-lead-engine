// CRON: Outbound Prospect — runs Mon/Wed/Fri at 9am MT
// Sends the next touch in a 4-message sequence to each prospect.
// Touch 1: cold intro. Touch 2: follow-up, softer angle. Touch 3: last try.
// Touch 4: break-up email (often gets the most replies).
//
// Rate limit: 40 emails per run, 3s delay between sends to avoid spam flags.
// Prospects: pulled from outbound_prospects table (new or due for follow-up).
//
// Requires: AI_API_KEY, RESEND_API_KEY, SUPABASE_URL

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import OpenAI from "openai";
import { cronRunner } from "@/lib/logger";

export const maxDuration = 60;

const RATE_LIMIT_PER_RUN = 40;
const DELAY_MS = 3000; // 3s between sends

function getClient() {
  return new OpenAI({
    apiKey: (process.env.AI_API_KEY || "no-key").trim(),
    baseURL: (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim(),
  });
}

const BASE_RULES = `
RULES:
- Keep it under 4 sentences.
- Extremely casual but professional. NO marketing speak.
- Sounds like a quick note typed on a phone.
- Always include their name and company.
- Ask a single easy-to-answer question at the end.
- No formatting, no bold, no markdown. Plain text only.
- Sign off as: - Anna

Respond ONLY with a JSON object: {"subject": "...", "body": "..."}`;

// Per-segment angles, differentiated by touch number
const SEGMENT_ANGLES: Record<string, string[]> = {
  insurance_agent: [
    `Cold intro: You refer clients to Faraday for storm damage claims. The pitch: when their clients ask "do you know a good roofer?" they send them to Faraday. Faraday makes the claim process easy so agents look good.`,
    `Follow-up #2: Acknowledge they're probably busy. Remind them the referral relationship is simple — no contracts, no commitment, just a name to give clients when they ask about hail damage.`,
    `Follow-up #3: Share a quick win story — an agent in [city] referred 3 clients after last spring's hailstorms and all of them left 5-star reviews. Keep it brief.`,
    `Break-up email #4: Tell them you don't want to keep bugging them, but you have room for one more referral partner this season and wanted to give them first shot before moving on.`,
  ],
  mortgage_broker: [
    `Cold intro: Faraday does same-day roof certifications for mortgage closings. When an inspector flags a roof issue, Faraday turns around the cert fast so the deal doesn't fall through.`,
    `Follow-up #2: Ask if they've ever had a closing delayed because of a roof issue. That's the exact problem Faraday solves — same-day certs, handles all paperwork.`,
    `Follow-up #3: Mention that they work with several local brokers who keep Faraday's number on speed dial during hail season. Ask if they'd find that useful.`,
    `Break-up email #4: Last note. They have limited cert capacity and want to make sure they can accommodate any broker referrals this season before adding new partners.`,
  ],
  title_company: [
    `Cold intro: Faraday does same-day inspections and certs when a roof issue pops up before closing. Fast turnaround keeps deals on track.`,
    `Follow-up #2: A quick follow-up — is there someone on their team who handles the contractor side of deal-killers? Faraday handles roofs quickly so closings stay on schedule.`,
    `Follow-up #3: Most title companies they work with keep Faraday on call for last-minute roof issues. Ask if that's something they'd want to have as a backup.`,
    `Break-up email #4: Last note from them. They're locking in their title company partnerships for hail season and wanted to check in one more time first.`,
  ],
  realtor: [
    `Cold intro: Faraday does free roof inspections for buyers and same-day certs for listings. Roof issues are the #1 deal-killer in Colorado home inspections — Faraday helps agents avoid that.`,
    `Follow-up #2: Ask if they've ever lost a deal because of a roof issue. Faraday has helped several Front Range agents avoid that — free inspections for buyers, fast certs for listings.`,
    `Follow-up #3: One of their agent partners had a listing in [city] where Faraday's same-day cert saved a $650K deal last spring. Not pushing, just thought it might be relevant.`,
    `Break-up email #4: Last check-in. They're wrapping up their referral partnerships before hail season and wanted to give them one last chance to connect.`,
  ],
  property_manager: [
    `Cold intro: Faraday does free post-storm assessments for property managers with written reports for records. After every hail storm, invisible damage adds up — Faraday catches it early.`,
    `Follow-up #2: Quick follow-up — do they handle storm response for their properties, or does their client handle it? Faraday provides free written assessments that work for insurance documentation.`,
    `Follow-up #3: After last spring's hailstorms, several property managers in [city] used Faraday's free assessments to document damage before insurance windows closed. Saved them a lot of headaches.`,
    `Break-up email #4: Last note. They still have capacity for free assessments this season but wanted to check in one more time before moving on.`,
  ],
  hoa_manager: [
    `Cold intro: Faraday does free community-wide storm assessments for HOAs with written reports for the board. One hail storm can hit every roof in a community — Faraday finds the damage before the board gets blindsided.`,
    `Follow-up #2: A quick follow-up — do they handle storm response for their communities, or does each board handle it separately? Faraday's free community assessments work great for board documentation.`,
    `Follow-up #3: They've worked with several HOA management companies in Colorado who use their assessments to document storm damage before insurance windows close. Wanted to see if that'd be useful.`,
    `Break-up email #4: Last note from them. They're finalizing their HOA partnerships for the season and wanted to reach out one more time before moving on.`,
  ],
  apartment_manager: [
    `Cold intro: Faraday does free flat roof inspections for apartment complexes after storm events with certified reports for insurance documentation. No cost — insurance covers any repairs they find.`,
    `Follow-up #2: Quick follow-up — does their team handle roof inspections after storms, or wait for the property owner? Faraday provides certified flat roof reports that hold up for insurance claims.`,
    `Follow-up #3: A property management company in [city] had Faraday inspect their portfolio after last spring's hailstorm and found damage on 6 of 8 buildings — all covered by insurance. Wanted to share that.`,
    `Break-up email #4: Last message from them. They have open capacity for free inspections this season and didn't want them to miss out.`,
  ],
  condo_manager: [
    `Cold intro: Faraday does free storm damage assessments for condo associations with written reports for boards and insurance. Condo roofs are shared liability — one missed hail hit can turn into a $500k repair.`,
    `Follow-up #2: Quick follow-up — does their team handle storm response for their condo communities, or does the board coordinate separately? Faraday's free written reports work well for board meetings and insurance.`,
    `Follow-up #3: They worked with a condo association in [city] last year that used their assessment report in their board meeting to approve a full roof replacement covered by insurance. Thought that might be relevant.`,
    `Break-up email #4: Last note. They're locking in their condo partnerships for the season and wanted one last check-in.`,
  ],
  public_adjuster: [
    `Cold intro — CASH OFFER, make this the first sentence: "I pay $100 cash for every homeowner you send me — paid the same week we do the inspection, no strings attached." Faraday is a Colorado roofing company. When a PA has a client with an active hail claim and no contractor yet, all they need to do is text us the name and number. We handle everything else. End with: "Are you working any active hail claims right now?"`,
    `Follow-up #2 — keep the cash offer front and center: "Still $100 per referral, no minimum, no contracts." Ask a concrete question: do they have clients right now waiting on a roof estimate? Faraday can be on-site within 24 hours and will send them an adjuster-ready damage report. Make it clear we exist to make their job easier and pay them for it.`,
    `Follow-up #3 — make it real with a number: A PA in [city] texted us 4 client names last spring. All 4 had claims approved. He made $400 in referral fees and all 4 homeowners used him again on their next claim. One relationship, recurring income. Is this something they want to set up before summer storms hit?`,
    `Break-up email #4 — final, direct: "Last note — I'll stop bugging you after this." The offer is still on the table: $100 per homeowner referral, paid same week. If they ever have a client who needs a roofer fast, text the name and number to (720) 766-1518 and Faraday takes it from there. No need to reply.`,
  ],
  home_inspector: [
    `Cold intro — lead with the referral payment: "Faraday pays $100 for every homeowner you refer who gets a roof inspection." When an inspector flags roof damage, buyers ask "who should I call?" Faraday does same-day certs, handles the full insurance process, and if storm damage is involved, the homeowner often pays nothing out of pocket. End with: "Do you flag roof issues often on inspections in [city]?"`,
    `Follow-up #2 — make the math clear: If they do 10 inspections a week and flag roof issues on 3, that's potentially $300/week in referral income just for giving out a phone number. Faraday does the inspection, files the claim, handles everything. Ask: what do they currently tell clients when roof damage shows up?`,
    `Follow-up #3 — story: An inspector in [city] started referring buyers to Faraday last year. Three turned into full insurance-covered replacements. He made $300 in referrals and the buyers credited him in their Google reviews. Ask if they'd want to do a quick call this week.`,
    `Break-up email #4 — final: "Last one, promise." The $100/referral offer doesn't expire. Next time a buyer asks about a bad roof, they can just text the name and address to (720) 766-1518 and Faraday handles the rest. No commitment needed.`,
  ],
  restoration_contractor: [
    `Cold intro — open with the offer: "Faraday pays $100 for every homeowner referral where roof damage is involved." When a restoration crew is on a water mitigation job that started with a roof leak, the homeowner needs a roofer fast. Faraday can be on-site the same day, document the damage, and start the insurance claim while the restoration crew handles the interior. Ask: when they get a roof-related dispatch, who do they usually call for the roof side?`,
    `Follow-up #2 — make the workflow concrete: Text or call Faraday when a dispatch involves roof penetration. We show up same day. The homeowner's claim moves as one coordinated job. And the restoration crew gets $100. Ask if they have active jobs right now where the roof is the source of the damage.`,
    `Follow-up #3 — make it real: A restoration company in [city] texts us whenever they get a roof-source dispatch. Last spring that was 6 jobs — they earned $600 in referral fees and their customers got full roof replacements covered by insurance. Ask if they'd want to set up the same thing.`,
    `Break-up email #4 — keep the door open: "Last note." The $100/referral offer stands indefinitely. If they ever respond to a water damage call where the roof is the source, text the address to (720) 766-1518 and Faraday takes it from there. No contracts, no minimums.`,
  ],
  gutter_company: [
    `Cold intro — lead with the cash: "Faraday pays $50 per referral, cash, every time a homeowner you send us gets a roof inspection." Gutter crews are on roofs constantly. If they spot hail dents, soft metal, or granule loss, they can mention it to the homeowner and give out Faraday's number. That's it — $50 paid the same week. Ask: does their crew ever notice roof damage while on a job?`,
    `Follow-up #2 — make it even simpler: They don't even need to sell it. Just say "you might want to get your roof checked — here's a company that does free inspections." Text Faraday the address and we handle the rest. $50 per referral, no paperwork. Ask: are they doing any gutter jobs this week where they've noticed roof damage?`,
    `Follow-up #3 — story with numbers: A gutter company in [city] referred 7 homeowners to Faraday last spring — all 7 had storm damage they didn't know about. The gutter company earned $350 in referral fees in one month, and every homeowner thanked them for the heads-up. Would they want to set up the same deal?`,
    `Break-up email #4 — final: "Last message." The $50/referral offer doesn't go away. Whenever they're on a roof and see damage, they can text the address to (720) 766-1518. Faraday does the inspection and pays the referral if a claim moves forward. No reply needed.`,
  ],
  general_contractor: [
    `Cold intro: Faraday wants to be the roofing sub general contractors trust for storm damage work. When a GC's client asks about roofing after a hail event, Faraday handles the full insurance process — inspection, documentation, claim filing, replacement — and keeps the GC in the loop. No headaches, full transparency, fast quotes.`,
    `Follow-up #2: Quick follow-up — when a client asks about roofing, do they have a sub they usually call or are they open to new referrals? Faraday turns around quotes and insurance estimates fast so GCs don't lose clients waiting on a roofer.`,
    `Follow-up #3: A GC in [city] started sending Faraday roof clients last year — two became full insurance-covered replacements. The clients gave the GC credit for connecting them. Worth having the number in their phone.`,
    `Break-up email #4: Last note. They're locking in subcontractor relationships for summer and wanted to check in one more time.`,
  ],
};

function buildSystemPrompt(source: string | null, touchNumber: number): string {
  const angles = SEGMENT_ANGLES[source || ""] || [];
  const touchIdx = Math.min(touchNumber - 1, angles.length - 1);
  const angle = angles[touchIdx] || angles[0] || "Cold intro outreach about Faraday Construction roofing services in Colorado.";

  return `You are Anna, outreach specialist for Faraday Construction in Colorado.
Your job: send email outreach to this prospect.

CONTEXT FOR THIS MESSAGE:
${angle}

${BASE_RULES}`;
}

function followUpDelayDays(touchNumber: number): number {
  // Touch 1→2: 3 days. Touch 2→3: 5 days. Touch 3→4: 7 days. After 4: done.
  return [3, 5, 7][touchNumber - 1] || 999;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runner = cronRunner("outbound-prospect");
  const logId = await runner.start();

  const db = getSupabase();
  const now = new Date().toISOString();

  // Fetch prospects due for next touch:
  // - New prospects (touch 1)
  // - Previously contacted with next_follow_up_date <= now (touch 2/3/4)
  // - Max follow_up_count < 4 (stop after 4 touches)
  const { data: prospects, error } = await db
    .from("outbound_prospects")
    .select("*")
    .or(`status.eq.new,and(status.eq.contacted,next_follow_up_date.lte.${now})`)
    .lt("follow_up_count", 4)
    .not("email", "is", null)
    .limit(RATE_LIMIT_PER_RUN);

  if (error || !prospects || prospects.length === 0) {
    await runner.finish(logId, { actionsCount: 0 });
    return NextResponse.json({ success: true, message: "No prospects due for outreach.", prospects_checked: prospects?.length ?? 0 });
  }

  const client = getClient();
  const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();
  const results: { prospect: string; touch: number; success: boolean; error?: string }[] = [];
  let emailsSent = 0;

  for (const prospect of prospects) {
    if (emailsSent >= RATE_LIMIT_PER_RUN) break;

    const touchNumber = (prospect.follow_up_count || 0) + 1;
    const segmentType = prospect.source || (prospect.metadata as Record<string, string>)?.prospect_type || "unknown";

    try {
      const systemPrompt = buildSystemPrompt(segmentType, touchNumber);
      const userMsg = `Write ${touchNumber === 1 ? "a cold intro email" : `follow-up #${touchNumber} email`} to:\nName: ${prospect.name || "there"}\nCompany: ${prospect.company || prospect.name || "your company"}\nCity: ${prospect.city || "Colorado"}`;

      const completion = await client.chat.completions.create({
        model,
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
      });

      const text = completion.choices[0]?.message?.content || "";
      const clean = text.replace(/```json|```/g, "").trim();
      let emailContent: { subject: string; body: string };
      try {
        emailContent = JSON.parse(clean);
      } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI returned invalid JSON");
        emailContent = JSON.parse(match[0]);
      }

      // Add follow-up count to subject on touch 2+
      const subject = touchNumber > 1
        ? `Re: ${emailContent.subject}`
        : emailContent.subject;

      await sendEmail(
        prospect.email,
        subject,
        `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${emailContent.body}</div>`
      );
      emailsSent++;

      const nextTouch = touchNumber + 1;
      const nextFollowUpDate = nextTouch <= 4
        ? new Date(Date.now() + followUpDelayDays(touchNumber) * 86400000).toISOString().split("T")[0]
        : null;

      const threadId = prospect.thread_id || `thread_${Date.now()}_${prospect.id}`;
      await db.from("outbound_prospects").update({
        status: "contacted",
        last_contacted_at: new Date().toISOString(),
        last_message_sent: emailContent.body,
        follow_up_count: touchNumber,
        next_follow_up_date: nextFollowUpDate,
        thread_id: threadId,
      }).eq("id", prospect.id);

      // Save to email thread history
      await db.from("email_threads").upsert({
        prospect_id: prospect.id,
        thread_id: threadId,
        role: "assistant",
        content: emailContent.body,
        subject,
      });

      results.push({ prospect: prospect.email, touch: touchNumber, success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to contact ${prospect.email} (touch ${touchNumber}):`, msg);
      results.push({ prospect: prospect.email, touch: touchNumber, success: false, error: msg });
    }

    // Rate limit delay between sends
    if (emailsSent < RATE_LIMIT_PER_RUN && emailsSent < prospects.length) {
      await sleep(DELAY_MS);
    }
  }

  await runner.finish(logId, { actionsCount: emailsSent });
  return NextResponse.json({
    success: true,
    emails_sent: emailsSent,
    results,
  });
}
