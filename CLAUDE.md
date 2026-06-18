# Faraday Lead Engine — Rules for Claude

## What this system does

Gets homeowners with roof damage to submit their **name and phone number**. That's it.

Tyler gets paid **$100 per warm lead** (name + phone captured). Nothing else earns money.

Faraday's sales team handles everything after the lead is captured. That is not this system's job.

---

## The only objective

Get strangers to leads.faradaysun.com and submit name + phone + service interest.

Every cron, every feature, every line of code must answer: **does this put more humans on the lead page?**

## The two traffic levers

1. **Direct outreach** → craigslist posts, homeowner email blasts → homeowners click link → lead page
2. **B2B referral pipeline** → outbound-prospect emails B2B partners (insurance agents, PAs, PMs) → they refer clients → lead page

Storm detection supports both: Tyler gets post templates to paste to Nextdoor/FB groups, B2B prospects get storm-urgent emails.

---

## What is NOT this system's job

- Follow-up drip sequences after lead capture → Faraday's sales team
- Appointment booking → Faraday's sales team
- Review requests → Faraday's sales team
- Re-engaging old leads → Faraday's sales team
- Anything that happens after a phone number is captured

Do not build or suggest features in these areas.

---

## Active crons

| Cron | Schedule | Purpose |
|------|----------|---------|
| storm-check | 8am daily (+ every 30 min via GH Actions) | NWS hail → text Tyler post templates + B2B blast |
| outbound-prospect | Weekdays 9am + 2pm (GH Actions) | Cold email B2B referral partners (4-touch sequence) |
| craigslist-poster | Daily 8am MT | Emails Tyler ready-to-paste ad copy + city post links |
| homeowner-blast | Monday 9am MT | Weekly blast to purchased homeowner email list (500/run) |

## Disabled crons (removed — generated zero lead page traffic)

blog-generate, prospect-scraper, contact-form-targets, competitor-reviews, listing-monitor, permit-monitor, fema-monitor, bid-monitor, hoa-violations, hail-damage-unclaimed, meta-ad-cleanup, weekly-report, review-request, follow-up, intel-digest

---

## Current system state

**Leads:** 6 total (4 chat widget, 1 website, 1 test).

**Outbound prospects:** 20 seeded — HOA managers, PMs, insurance agents, mortgage brokers, title companies, realtors. Emails send from `anna@faradayleads.com`.

**Storm monitoring:** Active every 30 min via GitHub Actions.

**Homeowner blast list:** Empty. Needs a purchased CSV uploaded via `POST /api/homeowner-blast/import`.

---

## Immediate next actions (priority order)

1. **Google Search Ads** — create account, 3 campaigns, $50–100/day. Keywords: "hail damage roof inspection colorado", "free roof inspection denver", "roof hail damage colorado". Landing page: leads.faradaysun.com. This is the only channel that reaches people at moment of intent.

2. **Angi + Thumbtack + Yelp + Google Business Profile** — free listings on all four. 1–2 hours. Passive traffic forever.

3. **Buy homeowner email list** — ListGiant.com or Melissa Data. Filter: CO Front Range zip codes, homeowner, single-family. 10,000 records, ~$150. Upload CSV to `/api/homeowner-blast/import` with `Authorization: Bearer $CRON_SECRET`. Weekly blast cron sends 500/week automatically.

4. **Craigslist daily posts** — cron emails Tyler ready-to-paste copy every day at 8am. Tyler clicks 5 links, pastes, done. ~5 min/day.

---

## Key URLs

- Live site: https://leads.faradaysun.com
- Admin: https://leads.faradaysun.com/admin
- War room: https://leads.faradaysun.com/anna
- GitHub: tyler-emdur/faraday-lead-engine

## Tech stack

Next.js 15 App Router · TypeScript · Tailwind · Supabase · Groq (llama-3.3-70b) · Resend · Twilio · Vercel · GitHub Actions
