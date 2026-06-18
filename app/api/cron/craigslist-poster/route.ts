// CRON: Craigslist Daily Poster — runs daily at 8am MT (3pm UTC)
//
// Generates fresh ad copy for 5 CO cities and emails Tyler with:
//   - Ready-to-paste title and body for each city
//   - Direct links to Craigslist's "post" page for each city
// Tyler pastes and posts in under 5 minutes.
//
// Requires: RESEND_API_KEY, TYLER_EMAIL or TEAM_EMAIL, AI_API_KEY
// Optional: CRON_SECRET for auth

import { NextRequest, NextResponse } from "next/server";
import { cronRunner } from "@/lib/logger";

export const maxDuration = 60;

const CITIES = [
  { name: "Denver",          craigslistCode: "den" },
  { name: "Colorado Springs", craigslistCode: "cos" },
  { name: "Fort Collins",    craigslistCode: "ftc" },
  { name: "Boulder",         craigslistCode: "bou" },
  { name: "Pueblo",          craigslistCode: "pue" },
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";
const PHONE = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";

const AD_TEMPLATES = [
  {
    title: "Free Hail Damage Roof Inspection — We Handle Your Insurance Claim",
    body: `Faraday Construction is offering FREE roof inspections across the Front Range this week.

If your home was hit by hail in the past 1–3 years, you may be owed $9,000–$22,000 from your insurance — and most homeowners don't even know it.

✓ Free inspection — we come to you
✓ We handle ALL the insurance paperwork
✓ You only pay your deductible
✓ BBB A+ rated, licensed & insured in Colorado
✓ 200+ 5-star Google reviews

Don't wait — insurance claim windows close after storms.

Get your free inspection: ${SITE_URL}
Or call/text: ${PHONE}`,
  },
  {
    title: "Colorado Homeowners: Your Roof Damage May Be Fully Covered",
    body: `Is your roof showing signs of wear, missing shingles, or storm damage?

Your homeowner's insurance may cover a full replacement — and you only pay your deductible.

Faraday Construction does FREE roof inspections across Colorado:
• Same-day or next-day appointments available
• We document everything and file your claim
• Most Front Range claims: $9,000–$22,000 fully covered
• Zero upfront cost to you

Hundreds of Colorado homeowners have gotten brand new roofs without paying out of pocket.

Schedule now: ${SITE_URL}
Questions? Call/text: ${PHONE}`,
  },
  {
    title: "Free Roof Inspection — Hail Season Is Here. Don't Miss Your Claim Window.",
    body: `Colorado homeowners: hail season is here and insurance claim windows are closing.

If your neighborhood got hit in the last storm season, your roof may have damage that's hard to spot from the ground but fully covered by your policy.

Faraday Construction offers:
→ Free professional roof inspection
→ Insurance claim filing — we handle all paperwork
→ Direct adjuster communication on your behalf
→ Full replacement when covered, you pay deductible only

We've helped 1,200+ Colorado families recover full claim value.

Book your free inspection: ${SITE_URL}
Or call us directly: ${PHONE}

Serving ${CITIES.map(c => c.name).join(", ")} and surrounding areas.`,
  },
];

function todaysTemplate() {
  const idx = new Date().getDate() % AD_TEMPLATES.length;
  return AD_TEMPLATES[idx];
}

function craigslistPostUrl(code: string): string {
  // Direct link to Craigslist's post form for "services offered > skilled trades"
  return `https://${code}.craigslist.org/d/services/post?category=sss`;
}

function buildEmailHtml(cities: typeof CITIES, template: { title: string; body: string }): string {
  const cityRows = cities.map(city => `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;font-size:15px;font-weight:700;color:#1f2937;">${city.name}</h3>
        <a href="${craigslistPostUrl(city.craigslistCode)}"
           style="background:#f59e0b;color:#000;font-weight:700;font-size:12px;padding:6px 12px;border-radius:6px;text-decoration:none;">
          Post on Craigslist →
        </a>
      </div>
    </div>`).join("");

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;">

  <div style="background:#1a1a1a;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="color:#f59e0b;margin:0;font-size:18px;font-weight:900;">📋 Daily Craigslist Posts</h1>
    <p style="color:#9ca3af;margin:6px 0 0;font-size:13px;">Copy title + body below, then click each city link to post. Takes ~5 minutes.</p>
  </div>

  <div style="padding:20px 24px;background:#f9fafb;border:1px solid #e5e7eb;">

    <h2 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">Post Title</h2>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:12px;margin-bottom:16px;">
      <p style="font-family:monospace;font-size:14px;color:#111;margin:0;line-height:1.5;">${template.title}</p>
    </div>

    <h2 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">Post Body</h2>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:12px;margin-bottom:20px;">
      <pre style="font-family:inherit;font-size:13px;color:#374151;white-space:pre-wrap;margin:0;line-height:1.6;">${template.body}</pre>
    </div>

    <h2 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em;">Post in Each City</h2>
    ${cityRows}

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-top:8px;">
      <p style="margin:0;font-size:13px;color:#1e40af;">
        <strong>How to post:</strong> Click a city link → Select "Services Offered" → "Skilled Trades" →
        Paste the title and body above → Add your email → Post.
        Category: skilled trades. Price: free. Location: city name.
      </p>
    </div>
  </div>

  <div style="padding:12px 24px;background:#f3f4f6;border-radius:0 0 12px 12px;">
    <p style="margin:0;font-size:12px;color:#6b7280;">
      Auto-generated by Faraday Lead Engine · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
    </p>
  </div>
</div>`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runner = cronRunner("craigslist-poster");
  const logId = await runner.start();

  const tylerEmail = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;
  if (!tylerEmail || !process.env.RESEND_API_KEY) {
    await runner.finish(logId, { actionsCount: 0 });
    return NextResponse.json({ success: false, message: "Missing TYLER_EMAIL or RESEND_API_KEY" });
  }

  try {
    const { sendEmail } = await import("@/lib/resend");
    const template = todaysTemplate();
    const html = buildEmailHtml(CITIES, template);

    await sendEmail(
      tylerEmail,
      `📋 Daily Craigslist Posts — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      html
    );

    await runner.finish(logId, { actionsCount: CITIES.length });
    return NextResponse.json({ success: true, cities: CITIES.length, template: template.title });
  } catch (error) {
    await runner.finish(logId, { error: String(error) });
    console.error("Craigslist poster error:", error);
    return NextResponse.json({ error: "Failed to send Craigslist post email" }, { status: 500 });
  }
}
