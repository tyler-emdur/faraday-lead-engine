// Automated follow-up templates for Faraday Construction
// These fire automatically on schedule after a lead is captured

export interface LeadInfo {
  name: string;
  phone?: string;
  email?: string;
  service?: string;
  city?: string;
  urgency?: string;
  insurance_filed?: string;
  roof_age?: number;
}

const PHONE = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com";

const SERVICE_LABELS: Record<string, string> = {
  roofing: "roof",
  hail_damage: "hail damage repair",
  windows: "window & door replacement",
  solar: "solar installation",
  multiple: "home exterior project",
};

function svc(lead: LeadInfo): string {
  return SERVICE_LABELS[lead.service || ""] || "project";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const HEADER = (highlight = "#f59e0b") => `
  <div style="background:${highlight};padding:20px 24px;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">FARADAY CONSTRUCTION</h1>
    <p style="color:#000;margin:4px 0 0;font-size:12px;opacity:0.7;">Colorado's Front Range Roofing, Windows & Solar Experts</p>
  </div>`;

const FOOTER = `
  <div style="background:#f5f5f5;padding:16px 24px;font-size:11px;color:#888;border-top:1px solid #e5e5e5;">
    <p style="margin:0;">Faraday Construction · 4165 57th St, Boulder CO 80301 · (720) 766-1518 · info@faradayenterprises.com</p>
    <p style="margin:6px 0 0;">Licensed & Insured in Colorado · BBB A+ Rated · Serving the Front Range since 2012</p>
  </div>`;

// ═══════════════════════════════════════
// EMAIL TEMPLATES — Step 1 (immediate)
// ═══════════════════════════════════════

export function welcomeEmail(lead: LeadInfo) {
  const service = svc(lead);
  const isHail = lead.service === "hail_damage" || lead.service === "multiple";
  const isSolar = lead.service === "solar";

  return {
    subject: `You're all set, ${lead.name || "there"} — here's what happens next`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
        ${HEADER()}
        <div style="padding:32px 24px;">
          <p style="margin:0 0 16px;font-size:16px;">Hey ${lead.name || "there"},</p>
          <p style="margin:0 0 16px;">Thanks for reaching out about your <strong>${service}</strong>! You're in good hands — we've been protecting Colorado homes since 2012.</p>

          <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;margin:24px 0;border-radius:0 8px 8px 0;">
            <p style="margin:0;font-weight:700;font-size:15px;">What happens next:</p>
            <ol style="margin:8px 0 0;padding-left:20px;line-height:1.8;">
              <li>A Faraday specialist calls you <strong>within a few hours</strong> to schedule</li>
              <li>We come out for a <strong>free, no-pressure inspection</strong></li>
              <li>You get a written estimate — zero obligation</li>
            </ol>
          </div>

          ${isHail ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:16px;margin:24px 0;border-radius:8px;">
            <p style="margin:0;font-weight:700;color:#b91c1c;">Important for hail damage claims:</p>
            <p style="margin:8px 0 0;line-height:1.6;">Most hail damage is <strong>fully covered by homeowner's insurance</strong>. Faraday handles the entire claims process — we deal with your adjuster directly. Most customers pay <em>only their deductible</em>. Insurance claims also have deadlines, so acting quickly protects your coverage.</p>
          </div>
          ` : ""}

          ${isSolar ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;padding:16px;margin:24px 0;border-radius:8px;">
            <p style="margin:0;font-weight:700;color:#92400e;">Colorado solar savings you should know about:</p>
            <ul style="margin:8px 0 0;padding-left:20px;line-height:1.8;">
              <li>Federal 30% Investment Tax Credit (ITC) — still active</li>
              <li>Colorado state incentives on top of that</li>
              <li>Most Front Range homeowners eliminate their electric bill entirely</li>
            </ul>
          </div>
          ` : ""}

          <p style="margin:16px 0;">Questions before we call? Reply to this email or reach us directly:</p>
          <p style="margin:0;"><a href="tel:${PHONE}" style="color:#d97706;font-weight:700;text-decoration:none;font-size:16px;">${PHONE}</a></p>
          <p style="margin:24px 0 0;">Talk soon,<br><strong>The Faraday Construction Team</strong></p>
        </div>
        ${FOOTER}
      </div>
    `,
  };
}

// ═══════════════════════════════════════
// EMAIL TEMPLATES — Step 3 (Day 1)
// Service-specific value education
// ═══════════════════════════════════════

export function insuranceInfoEmail(lead: LeadInfo) {
  const isSolar = lead.service === "solar";
  const isWindows = lead.service === "windows";
  const isRoofing = lead.service === "roofing";

  if (isSolar) {
    return {
      subject: `The Colorado solar numbers most homeowners never see`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
          ${HEADER("#f59e0b")}
          <div style="padding:32px 24px;">
            <p style="margin:0 0 16px;">Hey ${lead.name || "there"},</p>
            <p style="margin:0 0 16px;">Following up on your solar interest — wanted to share some numbers that surprise most Colorado homeowners.</p>

            <p style="margin:0 0 16px;font-size:17px;font-weight:700;">Colorado is one of the best states in the country for solar ROI.</p>

            <ul style="margin:0 0 16px;padding-left:20px;line-height:1.9;">
              <li><strong>300+ sunny days per year</strong> — more than Florida and Hawaii</li>
              <li><strong>Federal 30% Investment Tax Credit</strong> — on your full system cost</li>
              <li><strong>Colorado net metering</strong> — sell excess power back to Xcel Energy</li>
              <li>Most Front Range homeowners break even in 6-8 years, then it's <strong>free electricity for 20+ years</strong></li>
            </ul>

            <p style="margin:0 0 24px;">We've designed and installed hundreds of systems across Boulder, Denver, Fort Collins, and the surrounding areas. We'll give you an honest assessment of what solar could do for your specific home.</p>

            <div style="text-align:center;margin:28px 0;">
              <a href="${SITE}/chat" style="background:#f59e0b;color:#000;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;display:inline-block;">Schedule My Free Solar Assessment →</a>
            </div>

            <p style="margin:0;">Or just call us: <a href="tel:${PHONE}" style="color:#d97706;font-weight:700;">${PHONE}</a></p>
            <p style="margin:20px 0 0;">— The Faraday Team</p>
          </div>
          ${FOOTER}
        </div>
      `,
    };
  }

  if (isWindows) {
    return {
      subject: `How much are drafty windows actually costing you each month?`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
          ${HEADER("#f59e0b")}
          <div style="padding:32px 24px;">
            <p style="margin:0 0 16px;">Hey ${lead.name || "there"},</p>
            <p style="margin:0 0 16px;">Following up on your window replacement inquiry — wanted to give you some context that helps with the decision.</p>

            <p style="margin:0 0 16px;font-size:17px;font-weight:700;">Older windows cost Colorado homeowners 25-40% more in heating and cooling every year.</p>

            <p style="margin:0 0 16px;">Colorado's extreme temperature swings — from 15° winter nights to 95° summer days — punish inefficient windows hard. Every draft is money out the window, literally.</p>

            <p style="font-weight:700;margin:0 0 8px;">New triple-pane windows typically deliver:</p>
            <ul style="margin:0 0 16px;padding-left:20px;line-height:1.9;">
              <li>25-40% reduction in heating/cooling costs</li>
              <li>Dramatically less outside noise (especially near roads)</li>
              <li>No more condensation or frost on the interior glass</li>
              <li>Significant bump in home resale value</li>
              <li>Federal energy efficiency tax credits still available</li>
            </ul>

            <div style="text-align:center;margin:28px 0;">
              <a href="${SITE}/chat" style="background:#f59e0b;color:#000;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;display:inline-block;">Schedule My Free Window Assessment →</a>
            </div>

            <p style="margin:0;">Or call us: <a href="tel:${PHONE}" style="color:#d97706;font-weight:700;">${PHONE}</a></p>
            <p style="margin:20px 0 0;">— The Faraday Team</p>
          </div>
          ${FOOTER}
        </div>
      `,
    };
  }

  if (isRoofing) {
    return {
      subject: `The inspection that saves Colorado homeowners thousands`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
          ${HEADER("#f59e0b")}
          <div style="padding:32px 24px;">
            <p style="margin:0 0 16px;">Hey ${lead.name || "there"},</p>
            <p style="margin:0 0 16px;">Following up on your roof — wanted to share something that might be helpful.</p>

            <p style="margin:0 0 16px;font-size:17px;font-weight:700;">Most roof problems in Colorado start invisible and end expensive.</p>

            <p style="margin:0 0 16px;">Colorado's hailstorms, freeze-thaw cycles, and UV intensity punish roofs hard. Damage that starts as a few compromised shingles becomes a $4,000 interior water repair job within 18 months.</p>

            <p style="font-weight:700;margin:0 0 8px;">What our free inspection covers:</p>
            <ul style="margin:0 0 16px;padding-left:20px;line-height:1.9;">
              <li>Full roof deck inspection (we go up, not just look from the ground)</li>
              <li>Flashing, ridge cap, valleys, and penetrations checked</li>
              <li>Photo documentation of every issue found</li>
              <li>Written estimate with no hidden fees</li>
              <li>Insurance claim assistance if damage is found</li>
            </ul>

            <div style="text-align:center;margin:28px 0;">
              <a href="${SITE}/chat" style="background:#f59e0b;color:#000;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;display:inline-block;">Schedule My Free Inspection →</a>
            </div>

            <p style="margin:0;">Or call: <a href="tel:${PHONE}" style="color:#d97706;font-weight:700;">${PHONE}</a></p>
            <p style="margin:20px 0 0;">— The Faraday Team</p>
          </div>
          ${FOOTER}
        </div>
      `,
    };
  }

  // Default: hail damage / multiple
  return {
    subject: `Most Colorado homeowners leave this money on the table (don't be one of them)`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
        ${HEADER()}
        <div style="padding:32px 24px;">
          <p style="margin:0 0 16px;">Hey ${lead.name || "there"},</p>
          <p style="margin:0 0 16px;">Quick follow-up on your ${svc(lead)} — wanted to share something that surprises a lot of homeowners.</p>

          <p style="margin:0 0 16px;font-size:17px;font-weight:700;">Most storm and hail damage is 100% covered by your homeowner's insurance.</p>

          <p style="margin:0 0 16px;">A lot of people either don't know this or assume the process is a headache — so they put it off and end up with bigger problems (and smaller insurance payouts) down the road.</p>

          <p style="font-weight:700;margin:0 0 8px;">Here's exactly what Faraday does for you:</p>
          <ul style="margin:0 0 16px;padding-left:20px;line-height:1.9;">
            <li>Thorough inspection to document every bit of damage</li>
            <li>We file the insurance claim on your behalf</li>
            <li>We meet with your adjuster — so nothing gets missed or lowballed</li>
            <li>We manage the entire repair process start to finish</li>
            <li><strong>You pay only your deductible. That's it.</strong></li>
          </ul>

          <p style="margin:0 0 24px;">We've done this for hundreds of Front Range families. It's one of the things we're known for.</p>

          <div style="text-align:center;margin:28px 0;">
            <a href="${SITE}/chat" style="background:#f59e0b;color:#000;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;display:inline-block;">Schedule My Free Inspection →</a>
          </div>

          <p style="margin:0;">Or just call us: <a href="tel:${PHONE}" style="color:#d97706;font-weight:700;">${PHONE}</a></p>
          <p style="margin:20px 0 0;">— The Faraday Team</p>
        </div>
        ${FOOTER}
      </div>
    `,
  };
}

// ═══════════════════════════════════════
// EMAIL TEMPLATES — Step 5 (Day 7 — Last Chance)
// ═══════════════════════════════════════

export function lastChanceEmail(lead: LeadInfo) {
  return {
    subject: `Still thinking it over, ${lead.name || "there"}? One more thing worth knowing`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
        ${HEADER("#ef4444")}
        <div style="padding:32px 24px;">
          <p style="margin:0 0 16px;">Hey ${lead.name || "there"},</p>
          <p style="margin:0 0 16px;">This is our last follow-up — we don't want to be in your inbox if the timing isn't right. But before we close out your file, wanted to leave you with this:</p>

          <div style="background:#fef2f2;border:1px solid #fecaca;padding:20px;margin:24px 0;border-radius:8px;">
            <p style="margin:0;font-weight:700;font-size:16px;color:#b91c1c;">Why waiting costs more than acting</p>
            <ul style="margin:12px 0 0;padding-left:20px;line-height:1.9;">
              <li>Hail damage hidden today becomes a leaking roof next spring</li>
              <li>Insurance claim windows close — filing late means coverage gaps</li>
              <li>Our inspection calendar fills up fast after storm season</li>
              ${lead.service === "solar" ? "<li>The 30% federal solar tax credit won't last forever — lock it in</li>" : ""}
              ${lead.service === "windows" ? "<li>Every Colorado winter with inefficient windows costs you $300-$600 more in heating</li>" : ""}
            </ul>
          </div>

          <p style="margin:0 0 16px;">If the timing still isn't right, no worries at all. But if you'd like to lock in your <strong>free, no-pressure inspection</strong> before we close out the week, we'd love to help.</p>

          <div style="text-align:center;margin:28px 0;">
            <a href="${SITE}/chat" style="background:#f59e0b;color:#000;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;display:inline-block;">Book My Free Inspection</a>
          </div>

          <p style="margin:0;">Or just reply "yes" and we'll call you back same day.</p>
          <p style="margin:20px 0 0;">Thanks for chatting with us,<br><strong>The Faraday Team</strong><br><a href="tel:${PHONE}" style="color:#d97706;">${PHONE}</a></p>
        </div>
        ${FOOTER}
      </div>
    `,
  };
}

// ═══════════════════════════════════════
// SMS TEMPLATES
// ═══════════════════════════════════════

export function introText(lead: LeadInfo): string {
  return `Hey ${lead.name || "there"}, it's Faraday Construction! Thanks for reaching out about your ${svc(lead)}. A specialist will call you today to set up your free inspection. Questions? Call us: ${PHONE}. Reply STOP to opt out.`;
}

export function checkInText(lead: LeadInfo): string {
  return `Hi ${lead.name || "there"}, Faraday Construction here. Still interested in that free ${svc(lead)} inspection? We have openings this week and can usually do same-day. Reply YES or call ${PHONE}. Reply STOP to opt out.`;
}

export function leadConfirmationSms(lead: { name?: string; service?: string }): string {
  const name = lead.name || "there";
  const service = SERVICE_LABELS[lead.service || ""] || "project";
  return `Hi ${name}! Got your info — a Faraday specialist will reach out within the hour to schedule your free ${service} inspection. Can't wait? Call us now: ${PHONE}. Reply STOP to opt out.`;
}

// ═══════════════════════════════════════
// STORM AUTO-POST TEMPLATES
// ═══════════════════════════════════════

export function facebookStormPost(areas: string, cities: string[]): string {
  const cityList = cities.slice(0, 5).join(", ");
  return `⚠️ Hail just hit ${cityList || areas.slice(0, 100)}!

If you're in the affected area, your roof may have damage you can't see from the ground. Gutters, shingles, and vents take hits that lead to leaks months later.

Faraday Construction is offering FREE roof inspections for affected homeowners this week.

🏠 Most hail damage is fully covered by your homeowner's insurance — we handle the entire claims process. You typically pay only your deductible.

💬 Chat with us now: ${SITE}/chat
📞 Or call: ${PHONE}

Don't wait — insurance claim windows close fast.

#HailDamage #RoofRepair #Colorado #FaradayConstruction ${cities.map(c => `#${c.replace(/\s/g, "")}`).join(" ")}`;
}

export function gbpStormPost(areas: string, cities: string[]): string {
  const cityList = cities.slice(0, 4).join(", ");
  return `Free Hail Damage Inspections — ${cityList || "Colorado Front Range"}

Recent storms brought hail to the area. Our certified inspectors are available this week for free roof assessments.

We handle the complete insurance claims process — most homeowners pay only their deductible. BBB A+ rated, licensed & insured.

Call (720) 766-1518 or chat online for same-day scheduling.`;
}

// ═══════════════════════════════════════
// REVIEW REQUEST TEMPLATE
// ═══════════════════════════════════════

export function reviewRequestText(customerName: string): string {
  return `Hi ${customerName}! It was great working with you — hope you're loving the results! If you have 60 seconds, a Google review would mean the world to us and helps other Colorado homeowners find us: ${SITE}/review — Thank you! Reply STOP to opt out.`;
}

// ═══════════════════════════════════════
// TEAM NOTIFICATION TEMPLATES
// ═══════════════════════════════════════

export function teamNotificationSms(lead: any): string {
  const grade = lead.score >= 75 ? "FIRE HOT" : lead.score >= 55 ? "WARM" : "COOL";
  return `[${grade}] NEW LEAD — Score ${lead.score}/100\n${lead.name || "Unknown"}\n📞 ${lead.phone || "no phone"}\n📧 ${lead.email || "no email"}\nService: ${(lead.service || "").replace("_", " ").toUpperCase()}\nUrgency: ${(lead.urgency || "unknown").toUpperCase()}\nLocation: ${lead.city || lead.zip || "?"}\nInsurance: ${lead.insurance_filed || "unknown"}`;
}

export function teamNotificationEmail(lead: any) {
  const isHot = lead.score >= 75;
  const isWarm = lead.score >= 55;
  const color = isHot ? "#ef4444" : isWarm ? "#f59e0b" : "#3b82f6";
  const label = isHot ? "🔥 HOT LEAD" : isWarm ? "🟡 WARM LEAD" : "🔵 COOL LEAD";

  return {
    subject: `${label}: ${lead.name || "Unknown"} — ${cap((lead.service || "").replace("_", " "))} (Score: ${lead.score}/100)`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;color:#1a1a1a;">
        <div style="background:${color};padding:16px 20px;border-radius:8px 8px 0 0;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:900;">${label} — ${lead.score}/100</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Submitted ${new Date().toLocaleString("en-US", { timeZone: "America/Denver" })} MT</p>
        </div>
        <div style="border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;width:110px;">Name</td><td style="padding:8px 4px;font-weight:600;">${lead.name || "—"}</td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Phone</td><td style="padding:8px 4px;"><a href="tel:${lead.phone}" style="color:${color};font-weight:700;text-decoration:none;">${lead.phone || "—"}</a></td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Email</td><td style="padding:8px 4px;">${lead.email || "—"}</td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Service</td><td style="padding:8px 4px;font-weight:600;">${cap((lead.service || "unknown").replace("_", " "))}</td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Urgency</td><td style="padding:8px 4px;">${cap((lead.urgency || "unknown").replace("_", " "))}</td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Location</td><td style="padding:8px 4px;">${[lead.city, lead.zip].filter(Boolean).join(" ") || "—"}</td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Homeowner</td><td style="padding:8px 4px;">${lead.homeowner === true ? "Yes" : lead.homeowner === false ? "No" : "Unknown"}</td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Damage</td><td style="padding:8px 4px;">${lead.damage_visible === true ? "Visible damage" : lead.damage_visible === false ? "No visible damage" : "Unknown"}</td></tr>
            <tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Insurance</td><td style="padding:8px 4px;">${lead.insurance_filed === "true" ? "Filed" : lead.insurance_filed === "planning_to" ? "Planning to file" : lead.insurance_filed === "false" ? "Not filed" : "Unknown"}</td></tr>
            ${lead.roof_age ? `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Roof age</td><td style="padding:8px 4px;">${lead.roof_age} years</td></tr>` : ""}
            ${lead.damage_description ? `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 4px;color:#666;">Damage notes</td><td style="padding:8px 4px;font-style:italic;">${lead.damage_description}</td></tr>` : ""}
          </table>
          ${lead.conversation ? `
          <details style="margin-top:16px;">
            <summary style="cursor:pointer;font-weight:600;color:#666;font-size:13px;">View full conversation</summary>
            <pre style="font-size:12px;background:#f8f8f8;padding:12px;border-radius:6px;white-space:pre-wrap;margin-top:8px;line-height:1.5;">${lead.conversation}</pre>
          </details>` : ""}
        </div>
      </div>
    `,
  };
}

// ═══════════════════════════════════════
// WEEKLY SUMMARY EMAIL (for owner)
// ═══════════════════════════════════════

export interface WeeklyStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coolLeads: number;
  byService: Record<string, number>;
  followUpsSent: number;
  stormsDetected: number;
  estimatedPipeline: number;
}

export function weeklyReportEmail(stats: WeeklyStats) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const dateRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const serviceRows = Object.entries(stats.byService)
    .filter(([, count]) => count > 0)
    .map(([svc, count]) => `<tr><td style="padding:6px 4px;color:#666;">${cap(svc.replace("_", " "))}</td><td style="padding:6px 4px;font-weight:600;">${count} lead${count !== 1 ? "s" : ""}</td></tr>`)
    .join("");

  return {
    subject: `Weekly Lead Summary — ${dateRange} (${stats.totalLeads} leads, $${stats.estimatedPipeline.toLocaleString()} pipeline)`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;color:#1a1a1a;">
        ${HEADER()}
        <div style="padding:28px 24px;">
          <h2 style="margin:0 0 4px;font-size:20px;">Weekly Lead Report</h2>
          <p style="margin:0 0 24px;color:#666;font-size:14px;">${dateRange}</p>

          <div style="display:grid;gap:12px;margin-bottom:24px;">
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p style="margin:0;font-size:28px;font-weight:900;color:#92400e;">${stats.totalLeads}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#666;">Total Leads Captured</p>
              </div>
              <div style="text-align:right;">
                <p style="margin:0;font-size:22px;font-weight:800;color:#065f46;">$${stats.estimatedPipeline.toLocaleString()}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#666;">Estimated Pipeline</p>
              </div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">🔥 Hot (A-grade)</td>
              <td style="padding:8px 4px;font-weight:700;color:#ef4444;">${stats.hotLeads} leads</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">🟡 Warm (B-grade)</td>
              <td style="padding:8px 4px;font-weight:700;color:#f59e0b;">${stats.warmLeads} leads</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">🔵 Cool (C/D-grade)</td>
              <td style="padding:8px 4px;color:#3b82f6;">${stats.coolLeads} leads</td>
            </tr>
            ${serviceRows}
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;color:#666;">📧📱 Follow-ups sent</td>
              <td style="padding:8px 4px;">${stats.followUpsSent}</td>
            </tr>
            <tr>
              <td style="padding:8px 4px;color:#666;">🌨️ Storms detected</td>
              <td style="padding:8px 4px;">${stats.stormsDetected}</td>
            </tr>
          </table>

          <div style="text-align:center;margin:24px 0;">
            <a href="${SITE}/admin" style="background:#f59e0b;color:#000;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">View Full Dashboard →</a>
          </div>
        </div>
        ${FOOTER}
      </div>
    `,
  };
}
