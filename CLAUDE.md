# Faraday Lead Engine — Rules for Claude

## What this system does

Gets homeowners with roof damage to submit their **name and phone number**. That's it.

Tyler gets paid **$100 per warm lead** (name + phone captured). Nothing else earns money.

Faraday's sales team handles everything after the lead is captured. That is not this system's job.

---

## The three channels that matter

1. **Storm detection** → NWS alert fires → SMS blast to storm subscribers → homeowners visit site → submit form
2. **SEO blog posts** → rank on Google for hail/roof keywords → organic traffic → submit form
3. **B2B referral outreach** → cold email insurance agents, property managers, HOA managers → they refer homeowners → submit form

Every cron, every feature, every line of code should serve one of these three channels.

---

## What is NOT this system's job

- Follow-up drip sequences after lead capture → Faraday's sales team
- Appointment booking → Faraday's sales team
- Review requests → Faraday's sales team
- Re-engaging old leads → Faraday's sales team
- Anything that happens after a phone number is captured

Do not build or suggest features in these areas.

---

## Active crons (15 — once-daily for Vercel Hobby plan)

| Cron | Schedule | Purpose |
|------|----------|---------|
| storm-check | 8am daily | NWS hail detection → subscriber blast + blog + Meta ads |
| reddit-monitor | 9am daily | CO subreddits for homeowners mentioning damage |
| blog-generate | Mon 9am | Weekly SEO blog post on hail/roofing keyword |
| prospect-scraper | Mon 6am | Loads CO referral partners into outbound table (BROKEN — Overpass timeout) |
| outbound-prospect | Weekdays 9am | Cold emails to B2B referral partners |
| contact-form-targets | Mon 7am | Auto-submits contact forms for no-email prospects |
| competitor-reviews | Mon 7am | 1-star reviews on competitors → outreach (NEEDS GOOGLE_PLACES_API_KEY) |
| listing-monitor | 9am daily | Redfin pending homes → listing agents need roof certs |
| permit-monitor | 3pm daily | Denver permits → neighbors of recent roofing jobs |
| fema-monitor | 8am daily | FEMA disaster declarations |
| bid-monitor | 7am daily | Colorado government roofing RFPs → emails Tyler proposals |
| hoa-violations | Wed 10am | HOA management companies + Reddit roof violation posts |
| hail-damage-unclaimed | Mon 8am | Historical storm areas with no permit activity |
| meta-ad-cleanup | Noon daily | Pauses Facebook storm ads after 7 days |
| weekly-report | Mon 2pm | Summary email to Tyler (leads, cron health) |

## High-frequency crons (GitHub Actions — CRON_SECRET added to repo secrets ✓)

| Workflow | Frequency |
|----------|-----------|
| storm-check | Every 30 min |
| reddit-monitor | Every 15 min |
| outbound-prospect | 9am + 2pm weekdays |
| fema-monitor | 8am + 6pm daily |

---

## Current system state

**Leads:** 6 total (4 chat widget, 1 website, 1 test). Delete test leads at /admin.

**Outbound prospects:** 20 seeded — HOA managers, property managers, insurance agents, mortgage brokers, title companies, realtors. Emails NOT sending yet — FROM domain blocked by Wix DNS (can't verify subdomain MX records). On hold until sending domain is resolved.

**Blog:** 2 posts live. Cron generates one per Monday.

**Storm monitoring:** Active every 30 min via GitHub Actions. No storms detected yet.

**What's broken / on hold:**
- Outbound email — Resend can't verify faradaysun.com (Wix DNS limitation). Fix: get a separate sending domain ($10/yr on Namecheap) or get owner approval to move DNS to Cloudflare. Don't touch company DNS without owner approval.
- prospect-scraper — Overpass API times out from Vercel servers. Not urgent; 20 prospects already seeded.
- competitor-reviews — needs GOOGLE_PLACES_API_KEY (requires credit card for Google Cloud)

---

## Immediate next actions (priority order)

1. **Set up Google Search Console** — verify faradaysun.com, check if blog posts are indexed. Free, 10 min. This is the only way to know if SEO is working.
2. **Resolve sending domain** — either buy faradayleads.com (~$10) or get owner approval on Cloudflare DNS migration. Unlocks outbound email to 20 prospects.
3. **Add TWILIO_PHONE_NUMBER to Vercel** — all SMS is broken without it. `vercel env add TWILIO_PHONE_NUMBER` then set Twilio webhook to `https://leads.faradaysun.com/api/inbound/sms`

---

## Key URLs

- Live site: https://leads.faradaysun.com
- Admin: https://leads.faradaysun.com/admin
- War room: https://leads.faradaysun.com/anna
- GitHub: tyler-emdur/faraday-lead-engine

## Tech stack

Next.js 15 App Router · TypeScript · Tailwind · Supabase · Groq (llama-3.3-70b) · Resend · Twilio · Vercel · GitHub Actions
