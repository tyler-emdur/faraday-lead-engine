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
    `Cold intro: Faraday wants to be the roofing company public adjusters call first on storm damage claims. When a PA takes on a hail claim, they need a roofer who documents damage thoroughly, writes clean adjuster-ready reports, and doesn't create problems during the claim. That's exactly what Faraday does — fast turnaround, detailed measurement reports, no surprises.`,
    `Follow-up #2: Quick follow-up — what does their current roofing referral process look like when working a hail claim? Faraday can have a written damage assessment ready within 24 hours of the call, which helps PAs move claims faster and dispute lowball estimates.`,
    `Follow-up #3: A PA in [city] they work with closed a $34,000 claim last spring partly because Faraday's damage photos and measurement reports were detailed enough to counter the insurance company's initial estimate. Not pushing, just thought that was worth mentioning.`,
    `Break-up email #4: Last note. They're locking in roofing referral partnerships before peak storm season and wanted to give them one last shot before moving on.`,
  ],
  home_inspector: [
    `Cold intro: When a home inspector flags roof damage, buyers need somewhere to turn. Faraday does same-day roof certifications and free inspections — buyers get clarity fast, deals stay on track, and inspectors have a referral that makes them look good. If storm damage is involved, insurance often covers the full replacement.`,
    `Follow-up #2: Quick follow-up — what do they usually recommend when a buyer asks about roof repair after an inspection? Faraday handles the full insurance process if storm damage is involved, which can mean the repair costs the buyer nothing.`,
    `Follow-up #3: An inspector in [city] started referring buyers to Faraday last year — three of those turned into full roof replacements covered 100% by insurance. The buyers left 5-star reviews and credited the inspector for catching it. Worth sharing.`,
    `Break-up email #4: Last note. They have room for one more inspection referral partner before summer season ramps up and wanted to check in one final time.`,
  ],
  restoration_contractor: [
    `Cold intro: Faraday wants to be the roofing company restoration contractors call when a job involves a roof leak. When water gets inside, the roof is usually the source — Faraday can be on-site same day to assess, document, and start the roof claim while the restoration crew handles the interior. One call, two coordinated crews, one clean claim.`,
    `Follow-up #2: Quick follow-up — when they're on a water mitigation job that starts with a roof leak, who do they call for the roof side? Faraday turns around insurance-ready documentation fast so the full claim moves as one.`,
    `Follow-up #3: A restoration company in [city] they partner with texts them whenever a dispatch involves roof penetration — saved both crews time and the homeowner a second deductible. Thought that model might be useful.`,
    `Break-up email #4: Last check-in. They're finalizing roofing referral partnerships for storm season and didn't want to leave them out.`,
  ],
  gutter_company: [
    `Cold intro: Faraday pays $50 per referral for homeowners who get a roof inspection after a gutter job. Gutter crews are often first on a roof after a storm — if they spot hail dents, soft metal, or granule loss, a quick heads-up to the homeowner could save them a lot of money. Faraday handles everything from there.`,
    `Follow-up #2: Quick follow-up — does their crew ever notice roof damage while doing gutter work? Faraday makes it simple: crew mentions what they saw, Faraday does a free inspection, and if it turns into a claim, there's a $50 referral payment.`,
    `Follow-up #3: A gutter company in [city] referred 7 homeowners to Faraday last spring — all 7 had insurance-covered roof damage they didn't know about. The gutter company earned $350 in referral fees and their customers loved them for it.`,
    `Break-up email #4: Last note. They're wrapping up referral partnerships for the season and wanted to reach out one more time before moving on.`,
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
